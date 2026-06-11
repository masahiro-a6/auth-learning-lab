"""
===================================================================
JWKS + 鍵ローテーション 学習用モックサーバー  (port 8001)
===================================================================

【このサーバーで学ぶこと】

1. JWKS（JSON Web Key Set）
   - 公開鍵をJSON形式で公開するエンドポイント
   - 複数の鍵を同時に持てる
   - kid（Key ID）でJWTのHeaderと照合する

2. 鍵のライフサイクル
   active  → JWKSに公開中。この鍵で署名されたJWTは検証できる。
   retired → JWKSから除外。この鍵で署名されたJWTは検証不可になる。
   revoked → 失効済み（漏洩対応）。即座にJWKSから除外される。

3. ローテーションの流れ
   ① 通常: key-001のみ active
   ② 移行: key-001(active) + key-002(active) → 両方検証可能
   ③ 完了: key-001 retired → key-001のJWTは検証不可に

【App 1（jwt-oidc-auth-lab）との違い】
   App 1: JWKS/kidの基本概念をOIDCフローの中で学ぶ
   App 2: 複数鍵・ローテーション・失効という鍵管理の運用面を学ぶ
===================================================================
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.serialization import load_pem_public_key
import jwt
import time
import secrets
import base64
from typing import Literal

app = FastAPI(
    title="JWKS + 鍵ローテーション 学習用モックサーバー",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────
# 鍵エントリー（インメモリ）
# ─────────────────────────────────────────────────────────
class KeyEntry:
    def __init__(self, kid: str, private_pem: str, public_pem: str, label: str = ""):
        self.kid        = kid
        self.private_pem = private_pem
        self.public_pem  = public_pem
        self.created_at  = int(time.time())
        self.status: Literal["active", "retired", "revoked"] = "active"
        self.label       = label or kid


KEYS: dict[str, KeyEntry] = {}
_key_counter = [1]   # ミュータブルなカウンター


# ─────────────────────────────────────────────────────────
# ヘルパー
# ─────────────────────────────────────────────────────────
def _generate_key(label: str = "") -> KeyEntry:
    """RSA-2048キーペアを生成して KeyEntry を返す"""
    kid = f"key-{_key_counter[0]:03d}"
    _key_counter[0] += 1

    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend(),
    )
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode()
    public_pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode()

    return KeyEntry(kid=kid, private_pem=private_pem, public_pem=public_pem, label=label)


def _to_jwk(entry: KeyEntry) -> dict:
    """KeyEntry → JWK（JSON Web Key）形式に変換"""
    public_key = load_pem_public_key(entry.public_pem.encode())
    pub_numbers = public_key.public_numbers()

    def int_to_b64url(n: int) -> str:
        byte_len = (n.bit_length() + 7) // 8
        return base64.urlsafe_b64encode(n.to_bytes(byte_len, "big")).rstrip(b"=").decode()

    return {
        "kty": "RSA",
        "use": "sig",
        "alg": "RS256",
        "kid": entry.kid,
        "n": int_to_b64url(pub_numbers.n),
        "e": int_to_b64url(pub_numbers.e),
    }


# ─────────────────────────────────────────────────────────
# サーバー起動時に最初の鍵を生成
# ─────────────────────────────────────────────────────────
_initial = _generate_key("最初の鍵（初期状態）")
KEYS[_initial.kid] = _initial
print(f"\n✅ 初期鍵を生成しました: kid = {_initial.kid}\n")


# ─────────────────────────────────────────────────────────
# OIDCディスカバリ / JWKS
# ─────────────────────────────────────────────────────────
@app.get("/.well-known/openid-configuration")
def openid_configuration():
    """
    OIDCディスカバリドキュメント。
    クライアントはまずここを取得して jwks_uri を知る。
    OKTAでは https://{domain}/.well-known/openid-configuration
    """
    base = "http://localhost:8001"
    return {
        "issuer": base,
        "jwks_uri": f"{base}/.well-known/jwks.json",
        "token_endpoint": f"{base}/tokens/issue",
        "_note": "クライアントはここから jwks_uri を取得して公開鍵を取りに行く",
    }


@app.get("/.well-known/jwks.json")
def get_jwks():
    """
    JWKS エンドポイント。active な鍵のみ公開する。

    【ポイント】
    - retired/revoked な鍵はここから除外される
    - 複数の鍵を同時に公開できる（ローテーション移行期間中）
    - クライアントはここから全公開鍵を取得し、JWTのkidで照合する
    """
    active = [k for k in KEYS.values() if k.status == "active"]
    return {
        "keys": [_to_jwk(k) for k in active],
        "_meta": {
            "active_count": len(active),
            "total_count": len(KEYS),
            "active_kids": [k.kid for k in active],
        },
    }


# ─────────────────────────────────────────────────────────
# 鍵管理
# ─────────────────────────────────────────────────────────
@app.get("/keys")
def list_keys():
    """全鍵の一覧（管理UI用）"""
    return {
        "keys": [
            {
                "kid":        k.kid,
                "label":      k.label,
                "status":     k.status,
                "created_at": k.created_at,
                "in_jwks":    k.status == "active",
            }
            for k in KEYS.values()
        ]
    }


class AddKeyBody(BaseModel):
    label: str = ""


@app.post("/keys")
def add_key(body: AddKeyBody):
    """
    新しい鍵ペアを生成して JWKS に追加する。

    【ローテーションでこの操作が重要な理由】
    新しい鍵を追加する前に古い鍵を削除してしまうと、
    古い鍵で発行済みのJWTが即座に無効になってしまう。
    移行期間中は両方の鍵を JWKS に公開しておくことで
    既存トークンと新規トークンの両方を検証できる。
    """
    entry = _generate_key(body.label or "")
    KEYS[entry.kid] = entry
    return {
        "kid":        entry.kid,
        "label":      entry.label,
        "status":     entry.status,
        "created_at": entry.created_at,
        "message":    f"✅ 新しい鍵 {entry.kid} を生成しました。JWKSに追加されました。",
    }


@app.delete("/keys/{kid}")
def retire_key(kid: str):
    """
    鍵を JWKS から除外する（retired）。

    この鍵で署名されたJWTは以降検証できなくなる。
    ローテーション完了後に古い鍵を除外するために使う。
    （鍵データ自体はサーバーに残るが公開しない）
    """
    if kid not in KEYS:
        raise HTTPException(status_code=404, detail=f"鍵 {kid} が見つかりません")
    if KEYS[kid].status != "active":
        raise HTTPException(status_code=400, detail=f"鍵 {kid} は既に {KEYS[kid].status} 状態です")

    KEYS[kid].status = "retired"
    return {
        "kid":     kid,
        "status":  "retired",
        "message": f"🗑 {kid} を JWKS から除外しました（retired）。この鍵で署名された JWT は検証できなくなります。",
    }


@app.post("/keys/{kid}/revoke")
def revoke_key(kid: str):
    """
    鍵を即座に失効させる（revoked）。

    鍵が漏洩した場合の緊急対応として使う。
    retired との違いは「意図的なローテーション」か「緊急無効化」かという意味的な違い。
    どちらも技術的にはJWKSから除外される。
    """
    if kid not in KEYS:
        raise HTTPException(status_code=404, detail=f"鍵 {kid} が見つかりません")
    if KEYS[kid].status == "revoked":
        raise HTTPException(status_code=400, detail="既に失効済みです")

    KEYS[kid].status = "revoked"
    return {
        "kid":     kid,
        "status":  "revoked",
        "message": f"🚨 {kid} を失効しました（revoked）。JWKS から即座に除外されます。",
    }


# ─────────────────────────────────────────────────────────
# JWT 発行・検証
# ─────────────────────────────────────────────────────────
class IssueTokenBody(BaseModel):
    kid: str
    sub: str = "user-001"
    expires_in: int = 3600


@app.post("/tokens/issue")
def issue_token(body: IssueTokenBody):
    """
    指定した kid の秘密鍵で JWT を署名して返す。
    retired/revoked な鍵でも発行できる（意図的に動作確認できるように）。
    """
    if body.kid not in KEYS:
        raise HTTPException(status_code=400, detail=f"鍵 {body.kid} が見つかりません")

    entry = KEYS[body.kid]
    now = int(time.time())
    payload = {
        "iss": "http://localhost:8001",
        "sub": body.sub,
        "iat": now,
        "exp": now + body.expires_in,
        "jti": f"tok-{secrets.token_hex(6)}",
    }
    token = jwt.encode(
        payload,
        entry.private_pem,
        algorithm="RS256",
        headers={"kid": body.kid},
    )
    return {
        "token":       token,
        "kid":         body.kid,
        "key_status":  entry.status,
        "issued_at":   now,
        "expires_at":  now + body.expires_in,
        "_note":       f"Header の kid={body.kid} を見て、検証側は JWKS から対応する公開鍵を探す",
    }


class VerifyTokenBody(BaseModel):
    token: str


@app.post("/tokens/verify")
def verify_token(body: VerifyTokenBody):
    """
    JWT を現在の JWKS で検証する。

    【検証の流れ】
    1. JWT の Header から kid を取得
    2. JWKS（active な鍵のみ）で同じ kid を探す
    3. 見つかった公開鍵で RSA 署名を検証
    4. exp が未来かを確認
    """
    try:
        header = jwt.get_unverified_header(body.token)
    except Exception as e:
        return {"valid": False, "error": "parse_error", "message": f"JWT のパースに失敗: {e}"}

    kid = header.get("kid")
    if not kid:
        return {"valid": False, "error": "missing_kid", "message": "JWT の Header に kid がありません"}

    # キーストアから検索
    entry = KEYS.get(kid)

    if not entry:
        return {
            "valid":       False,
            "error":       "kid_not_found",
            "kid":         kid,
            "message":     f"kid '{kid}' はキーストアに存在しません",
            "jwks_kids":   [k.kid for k in KEYS.values() if k.status == "active"],
        }

    if entry.status == "retired":
        return {
            "valid":       False,
            "error":       "key_retired",
            "kid":         kid,
            "key_status":  "retired",
            "message":     f"kid '{kid}' の鍵は JWKS から除外済み（retired）です。ローテーション完了後は検証できません。",
        }

    if entry.status == "revoked":
        return {
            "valid":       False,
            "error":       "key_revoked",
            "kid":         kid,
            "key_status":  "revoked",
            "message":     f"kid '{kid}' の鍵は失効しています（revoked）。漏洩対応等で無効化されました。",
        }

    # 署名検証
    try:
        payload = jwt.decode(
            body.token,
            entry.public_pem,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
        return {
            "valid":       True,
            "kid":         kid,
            "key_status":  "active",
            "payload":     payload,
            "message":     f"✅ 検証成功。kid={kid} の公開鍵で署名を確認しました。",
        }
    except jwt.ExpiredSignatureError:
        return {"valid": False, "error": "token_expired",      "kid": kid, "message": "JWT の有効期限が切れています（exp）"}
    except jwt.InvalidSignatureError:
        return {"valid": False, "error": "invalid_signature",  "kid": kid, "message": "署名の検証に失敗しました"}
    except Exception as e:
        return {"valid": False, "error": "verify_error",       "kid": kid, "message": str(e)}
