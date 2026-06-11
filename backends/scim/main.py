import uuid
import time
from typing import Optional
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="SCIM Provisioning Mock", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── SCIM ユーザーストア（インメモリ）─────────────────────────────────────────

USERS: dict[str, dict] = {}

EVENT_LOG: list[dict] = []  # 操作ログ（フロントに表示）


def _log(method: str, path: str, req_body: dict | None, res_body: dict, status: int, note: str = ""):
    EVENT_LOG.insert(0, {
        "id": str(uuid.uuid4())[:8],
        "ts": int(time.time()),
        "method": method,
        "path": path,
        "status": status,
        "note": note,
        "req": req_body,
        "res": res_body,
    })
    if len(EVENT_LOG) > 50:
        EVENT_LOG.pop()


def _scim_user(u: dict) -> dict:
    """内部データを SCIM 2.0 形式に変換"""
    return {
        "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
        "id": u["id"],
        "userName": u["userName"],
        "name": {
            "givenName": u.get("givenName", ""),
            "familyName": u.get("familyName", ""),
            "formatted": f"{u.get('familyName', '')} {u.get('givenName', '')}".strip(),
        },
        "emails": [{"value": u["email"], "primary": True, "type": "work"}],
        "displayName": u.get("displayName", u["userName"]),
        "active": u.get("active", True),
        "title": u.get("title", ""),
        "department": u.get("department", ""),
        "meta": {
            "resourceType": "User",
            "created": u["created"],
            "lastModified": u["lastModified"],
            "location": f"/scim/v2/Users/{u['id']}",
        },
    }


# ─── Pydantic リクエストモデル ─────────────────────────────────────────────────

class ScimName(BaseModel):
    givenName: str = ""
    familyName: str = ""

class ScimEmail(BaseModel):
    value: str
    primary: bool = True

class ScimUserCreate(BaseModel):
    schemas: list[str] = ["urn:ietf:params:scim:schemas:core:2.0:User"]
    userName: str
    name: Optional[ScimName] = None
    emails: list[ScimEmail] = []
    displayName: str = ""
    active: bool = True
    title: str = ""
    department: str = ""

class ScimUserPatch(BaseModel):
    schemas: list[str] = ["urn:ietf:params:scim:schemas:api:messages:2.0:PatchOp"]
    Operations: list[dict]


# ─── SCIM エンドポイント ───────────────────────────────────────────────────────

@app.get("/scim/v2/ServiceProviderConfig")
def service_provider_config():
    return {
        "schemas": ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
        "patch": {"supported": True},
        "bulk": {"supported": False, "maxOperations": 0, "maxPayloadSize": 0},
        "filter": {"supported": True, "maxResults": 200},
        "changePassword": {"supported": False},
        "sort": {"supported": False},
        "etag": {"supported": False},
        "authenticationSchemes": [
            {"type": "oauthbearertoken", "name": "OAuth Bearer Token", "description": "Authentication using Bearer token"}
        ],
        "meta": {"resourceType": "ServiceProviderConfig", "location": "/scim/v2/ServiceProviderConfig"},
    }


@app.get("/scim/v2/Users")
def list_users(filter: str = ""):
    users = list(USERS.values())

    # OKTA が使う filter=userName eq "xxx" の簡易パース
    if filter and 'eq' in filter:
        parts = filter.split('eq')
        if len(parts) == 2:
            attr = parts[0].strip()
            val = parts[1].strip().strip('"')
            if attr == "userName":
                users = [u for u in users if u["userName"] == val]

    resources = [_scim_user(u) for u in users]
    result = {
        "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
        "totalResults": len(resources),
        "startIndex": 1,
        "itemsPerPage": len(resources),
        "Resources": resources,
    }
    _log("GET", "/scim/v2/Users", None, result, 200, "ユーザー一覧取得")
    return result


@app.get("/scim/v2/Users/{user_id}")
def get_user(user_id: str):
    u = USERS.get(user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    result = _scim_user(u)
    _log("GET", f"/scim/v2/Users/{user_id}", None, result, 200, "ユーザー取得")
    return result


@app.post("/scim/v2/Users", status_code=201)
def create_user(body: ScimUserCreate):
    # 重複チェック
    for u in USERS.values():
        if u["userName"] == body.userName:
            raise HTTPException(status_code=409, detail=f"userName '{body.userName}' は既に存在します")

    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    uid = str(uuid.uuid4())
    email = body.emails[0].value if body.emails else f"{body.userName}@example.com"
    USERS[uid] = {
        "id": uid,
        "userName": body.userName,
        "givenName": body.name.givenName if body.name else "",
        "familyName": body.name.familyName if body.name else "",
        "email": email,
        "displayName": body.displayName or body.userName,
        "active": body.active,
        "title": body.title,
        "department": body.department,
        "created": now,
        "lastModified": now,
    }
    result = _scim_user(USERS[uid])
    _log("POST", "/scim/v2/Users", body.model_dump(), result, 201,
         f"ユーザー作成: {body.userName}")
    return result


@app.put("/scim/v2/Users/{user_id}")
def replace_user(user_id: str, body: ScimUserCreate):
    if user_id not in USERS:
        raise HTTPException(status_code=404, detail="User not found")
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    email = body.emails[0].value if body.emails else USERS[user_id]["email"]
    USERS[user_id].update({
        "userName": body.userName,
        "givenName": body.name.givenName if body.name else "",
        "familyName": body.name.familyName if body.name else "",
        "email": email,
        "displayName": body.displayName or body.userName,
        "active": body.active,
        "title": body.title,
        "department": body.department,
        "lastModified": now,
    })
    result = _scim_user(USERS[user_id])
    _log("PUT", f"/scim/v2/Users/{user_id}", body.model_dump(), result, 200,
         f"ユーザー更新（全置換）: {body.userName}")
    return result


@app.patch("/scim/v2/Users/{user_id}")
def patch_user(user_id: str, body: ScimUserPatch):
    if user_id not in USERS:
        raise HTTPException(status_code=404, detail="User not found")
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    note_parts = []
    for op in body.Operations:
        op_type = op.get("op", "").lower()
        path = op.get("path", "")
        value = op.get("value")
        if op_type == "replace":
            if path == "active":
                USERS[user_id]["active"] = bool(value)
                note_parts.append(f"active={value}")
            elif isinstance(value, dict):
                for k, v in value.items():
                    if k in USERS[user_id]:
                        USERS[user_id][k] = v
                        note_parts.append(f"{k}={v}")
            elif path and path in USERS[user_id]:
                USERS[user_id][path] = value
                note_parts.append(f"{path}={value}")
    USERS[user_id]["lastModified"] = now
    result = _scim_user(USERS[user_id])
    _log("PATCH", f"/scim/v2/Users/{user_id}", body.model_dump(), result, 200,
         f"ユーザー部分更新: {', '.join(note_parts)}")
    return result


@app.delete("/scim/v2/Users/{user_id}", status_code=204)
def delete_user(user_id: str):
    u = USERS.pop(user_id, None)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    _log("DELETE", f"/scim/v2/Users/{user_id}", None, {}, 204,
         f"ユーザー削除: {u['userName']}")


# ─── 管理用（フロントエンド向け）───────────────────────────────────────────────

@app.get("/admin/users")
def admin_list_users():
    return {"users": [_scim_user(u) for u in USERS.values()]}


@app.get("/admin/events")
def admin_events():
    return {"events": EVENT_LOG}


@app.delete("/admin/reset")
def admin_reset():
    USERS.clear()
    EVENT_LOG.clear()
    return {"message": "リセットしました"}
