"""
===================================================================
JWT + ABAC (属性ベースのアクセス制御) 学習用モックサーバー
===================================================================

このサーバーは2つの役割を担う学習用モックアプリです:

【役割1】 IdP (Identity Provider) モック
  - OktaやAuth0のようなアイデンティティプロバイダーをシミュレート
  - RSA秘密鍵でJWTに署名して発行する
  - エンドポイント: POST /idp/token

【役割2】 APIサーバーモック
  - JWTを受け取り、公開鍵で署名を検証する (Gateway/App層)
  - JWT内のクレーム（属性）に基づいて認可制御を行う (ABAC)
  - エンドポイント群: /api/*

──────────────────────────────────────────────
【JWTの基本構造 (RFC 7519)】

  JWT = Base64URL(Header) + "." + Base64URL(Payload) + "." + Base64URL(Signature)

  ┌────────────────────────────────────────────┐
  │ Header   {"alg": "RS256", "typ": "JWT"}    │ ← アルゴリズムの宣言
  │ Payload  {"sub": "u001", "user.role": ...} │ ← ユーザー属性（クレーム）
  │ Signature RSASHA256(header.payload, 秘密鍵) │ ← 改ざん検知
  └────────────────────────────────────────────┘

【なぜRS256（非対称暗号）を使うのか】
  HS256（対称）: 署名も検証も同じ鍵 → APIサーバーに秘密鍵を渡す必要があり危険
  RS256（非対称）: 署名=秘密鍵(IdPのみ) / 検証=公開鍵(APIサーバー)
  → 公開鍵は誰に渡してもOK。秘密鍵は絶対に外部に出さない。

【ABAC (Attribute-Based Access Control)】
  ユーザーの属性（role, team, rag.access, cost.budget）をJWTに埋め込み、
  APIサーバー側でその値を読み取って認可判断する仕組み。
  RBAC (Role-Based) よりも細粒度な制御が可能。
===================================================================
"""

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.backends import default_backend
import jwt  # PyJWT
import time
import secrets
import base64
from cryptography.hazmat.primitives.serialization import load_pem_public_key

# ─────────────────────────────────────────────────────────
# FastAPIアプリの初期化
# ─────────────────────────────────────────────────────────
app = FastAPI(
    title="JWT + ABAC 学習用モックサーバー",
    description="JWTの発行・検証・ABAC認可の仕組みを学ぶためのモックAPI",
    version="1.0.0",
)

# CORS設定: Viteはポート使用中の場合5174,5175...と順にずらすため複数許可
# 本番環境では allow_origins を特定のドメインに限定すること
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
# RSAキーペアの生成（サーバー起動時に1回だけ実行）
# ─────────────────────────────────────────────────────────
# 【なぜ起動時に生成するのか】
# 本番環境では秘密鍵はHSMやAWS KMS等で管理するが、
# この学習用アプリではメモリ上に保持するシンプルな構成とする。
# サーバーを再起動すると新しいキーペアが生成され、
# 以前のJWTは無効になる（これも学習ポイント）。

def generate_rsa_keypair() -> tuple[str, str]:
    """
    RSA-2048ビットのキーペアを生成し、PEM形式の文字列として返す。

    RSA (Rivest–Shamir–Adleman) 非対称暗号方式:
    - 秘密鍵と公開鍵は数学的に対になっている（片方から他方は計算困難）
    - 秘密鍵で署名 → 公開鍵で検証　という使い方がJWT RS256の核心

    Returns:
        (private_key_pem, public_key_pem) のタプル
    """
    print("\n" + "=" * 55)
    print("🔑 RSA-2048キーペアを生成しています...")

    private_key = rsa.generate_private_key(
        public_exponent=65537,
        # 65537 = フェルマー数 F4 = 2^16 + 1
        # セキュリティと演算効率のバランスが良く業界標準として広く使われる
        key_size=2048,
        # 2048ビット = 256バイトの鍵長
        # NIST SP 800-57は2030年まで2048ビットを推奨
        # より高セキュリティが必要な場合は4096ビットを選択
        backend=default_backend(),
    )

    # PEM (Privacy Enhanced Mail) 形式でシリアライズ
    # -----BEGIN PRIVATE KEY----- / -----END PRIVATE KEY----- で囲まれた
    # Base64エンコード形式。ファイルやAPIで鍵をやり取りする際の標準フォーマット。
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,          # 標準フォーマット
        encryption_algorithm=serialization.NoEncryption(), # 学習用のためパスフレーズなし
    ).decode("utf-8")

    public_pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,  # X.509/SPKI標準
    ).decode("utf-8")

    print("✅ キーペア生成完了（秘密鍵はこのサーバーのメモリ内にのみ存在します）")
    print("=" * 55 + "\n")
    return private_pem, public_pem


# モジュールレベルでキーペアをインメモリ保持
PRIVATE_KEY_PEM, PUBLIC_KEY_PEM = generate_rsa_keypair()

# JWKS で使う鍵ID（複数鍵のローテーションを識別するためのID）
KEY_ID = "mock-key-001"

# HTTP Bearer認証スキーム
# "Authorization: Bearer <token>" ヘッダーを自動的に解析してくれるFastAPIの仕組み
security = HTTPBearer()

# ─────────────────────────────────────────────────────────
# ダミーデータ（インメモリDB）
# ─────────────────────────────────────────────────────────
# 営業Mgrが見られる完全な顧客データ
CUSTOMERS_FULL = [
    {
        "id": "C001",
        "name": "株式会社テクノソリューション",
        "contact": "田中 一郎",
        "email": "tanaka@techno.example.com",
        "phone": "03-1234-5678",
        "annual_revenue": 5_000_000,
        "contract_status": "契約中",
        "notes": "主要クライアント。Q3に大型案件を予定。競合比較なし。",
        "last_contact": "2024-05-20",
    },
    {
        "id": "C002",
        "name": "グローバル商事株式会社",
        "contact": "鈴木 花子",
        "email": "suzuki@global.example.com",
        "phone": "06-2345-6789",
        "annual_revenue": 12_000_000,
        "contract_status": "契約中",
        "notes": "新規事業部との連携強化中。来期の予算増額見込み。",
        "last_contact": "2024-05-25",
    },
    {
        "id": "C003",
        "name": "フューチャーイノベーション株式会社",
        "contact": "佐藤 次郎",
        "email": "sato@future.example.com",
        "phone": "052-3456-7890",
        "annual_revenue": 3_200_000,
        "contract_status": "交渉中",
        "notes": "競合他社との比較検討中。15%値引きで成約見込み。",
        "last_contact": "2024-05-28",
    },
]

# RAGアクセスレベル別のナレッジデータ（Tier番号が大きいほど機密度が高い）
RAG_DATA_BY_TIER: dict[str, str] = {
    "Tier1": "📖 公開情報: 製品カタログ・FAQ・プレスリリース・一般的なガイドライン",
    "Tier2": "📋 社内情報: 内部手順書・営業トークスクリプト・製品ロードマップ",
    "Tier3": "🔒 機密情報: 顧客リスト・競合分析レポート・価格戦略ドキュメント",
    "Tier4": "🔐 極秘情報: M&A計画・未公開財務データ・個人情報を含む顧客詳細",
    "Tier5": "🛡️ 役員限定: 取締役会議事録・株主情報・未発表経営戦略書",
    "Tier6": "⚠️ 最高機密: 全社情報へのフルアクセス（システム管理者専用）",
}

# ─────────────────────────────────────────────────────────
# Pydanticモデル定義（リクエスト/レスポンスのスキーマ）
# ─────────────────────────────────────────────────────────
class TokenRequest(BaseModel):
    """JWT発行リクエストのスキーマ"""
    sub: str = "user-001"             # Subject: ユーザーの識別子
    user_role: str = "営業Member"      # user.role クレーム
    user_team: str = "東京営業チーム"  # user.team クレーム
    rag_access: str = "Tier2"         # rag.access クレーム
    cost_budget: int = 100_000        # cost.budget クレーム（円）
    expires_in: int = 3600            # 有効期限（秒）


# ─────────────────────────────────────────────────────────
# 共通エンドポイント
# ─────────────────────────────────────────────────────────
@app.get("/")
def health_check():
    """ヘルスチェック"""
    return {"status": "ok", "server": "JWT + ABAC 学習用モックサーバー v1.0"}


@app.get("/public-key")
def get_public_key():
    """
    公開鍵を返す（学習用JWKSの簡易版）。

    実際のOktaなどのOIDCプロバイダーでは:
      1. /.well-known/openid-configuration から jwks_uri を取得
      2. jwks_uri から JWKS (JSON Web Key Set) 形式で公開鍵を取得
    APIサーバーはこの公開鍵をキャッシュしてJWT検証に使用する。

    このエンドポイントはその簡易版。PEM形式で公開鍵を返す。
    """
    return {
        "algorithm": "RS256",
        "public_key": PUBLIC_KEY_PEM,
        "note": "この公開鍵でJWT署名を検証します。対応する秘密鍵はこのサーバーのメモリ内にのみ存在します。",
    }


# ─────────────────────────────────────────────────────────
# IdPモック: JWT発行エンドポイント
# ─────────────────────────────────────────────────────────
@app.post("/idp/token")
def issue_token(req: TokenRequest):
    """
    JWTを発行するIdPモックエンドポイント。

    ──────────────────────────────────────────
    【JWTペイロード（クレーム）の種類】

    ① 登録済みクレーム (Registered Claims) ─ RFC 7519で定義
      iss (Issuer)      : トークンの発行者 (このサーバーのURL)
      sub (Subject)     : トークンの主体 (ユーザーID)
      aud (Audience)    : トークンの受信者 (フロントエンドのURL)
      exp (Expiration)  : 有効期限 (UNIXタイムスタンプ)
      iat (Issued At)   : 発行日時 (UNIXタイムスタンプ)
      jti (JWT ID)      : トークンの一意識別子 (リプレイ攻撃防止)

    ② プライベートクレーム (Private Claims) ─ アプリ独自の属性
      user.role   : ユーザーのロール (認可制御に使用)
      user.team   : 所属チーム
      rag.access  : RAGアクセスレベル (Tier1〜Tier6)
      cost.budget : 予算承認権限 (円)

    ──────────────────────────────────────────
    【RS256署名の仕組み】

    1. Header    = {"alg":"RS256","typ":"JWT"}
    2. Payload   = 上記クレーム群
    3. message   = Base64URL(Header) + "." + Base64URL(Payload)
    4. hash      = SHA-256(message)
    5. signature = RSA_PKCS1v15_Sign(秘密鍵, hash)
    6. JWT       = message + "." + Base64URL(signature)

    検証側は: RSA_PKCS1v15_Verify(公開鍵, hash, signature) で確認
    ──────────────────────────────────────────
    """
    now = int(time.time())

    # ペイロード（クレーム）の組み立て
    payload: dict = {
        # ─── 登録済みクレーム ───
        "iss": "http://localhost:8000",       # この学習サーバーが発行者
        "sub": req.sub,                        # ユーザーID
        "aud": "http://localhost:5173",        # フロントエンドが受信者
        "iat": now,                            # 発行日時
        "exp": now + req.expires_in,           # 有効期限
        "jti": f"mock-jwt-{now}-{req.sub}",    # 一意ID（タイムスタンプ+subで生成）

        # ─── プライベートクレーム（カスタム属性） ───
        # ドット区切りでネームスペースを表現するのが慣習
        "user.role":   req.user_role,
        "user.team":   req.user_team,
        "rag.access":  req.rag_access,
        "cost.budget": req.cost_budget,
    }

    # PyJWTでRS256署名付きJWTを生成
    # headers={"kid": KEY_ID} でどの公開鍵で検証すべきかをJWKSと紐付ける
    token: str = jwt.encode(payload, PRIVATE_KEY_PEM, algorithm="RS256", headers={"kid": KEY_ID})

    return {
        "access_token": token,
        "token_type": "Bearer",
        "expires_in": req.expires_in,
        "issued_at": now,
        "expires_at": now + req.expires_in,
        # 学習用: デコード済みペイロードも返す（本番では絶対に返さない）
        "debug_payload": payload,
    }


# ─────────────────────────────────────────────────────────
# JWT検証（依存性注入として実装）
# ─────────────────────────────────────────────────────────
def verify_jwt(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """
    JWTを検証してデコード済みペイロードを返す依存性関数。

    FastAPIの Depends() を使って各エンドポイントに注入することで、
    認証ロジックを一元管理できる（DRY原則）。

    ──────────────────────────────────────────
    【検証ステップ】

    Step 1: "Authorization: Bearer <token>" ヘッダーを解析
    Step 2: "<token>" を "." で3分割 → headerB64 / payloadB64 / signatureB64
    Step 3: Base64URLデコード
    Step 4: 公開鍵で署名を検証
             RSA_PKCS1v15_Verify(公開鍵, SHA256(header.payload), signature)
             → 検証成功 = この秘密鍵保持者が署名したことが証明される
    Step 5: exp が現在時刻より未来であることを確認
    Step 6: 問題なければデコードされたペイロードを返す

    ──────────────────────────────────────────
    【改ざん検知の仕組み】

    もしペイロードの "user.role" を "営業Mgr" に書き換えて再送しても:
    - Signatureは元の秘密鍵で生成された値のまま
    - 公開鍵で検証すると hash(改ざん後のPayload) ≠ RSA_decrypt(signature, 公開鍵)
    - → InvalidSignatureError が発生して拒否される
    ──────────────────────────────────────────
    """
    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            PUBLIC_KEY_PEM,           # 署名検証に使う公開鍵（秘密鍵は不要）
            algorithms=["RS256"],     # 許可するアルゴリズムをリストで指定（固定推奨）
            options={"verify_aud": False},  # 学習用にaudience検証を緩和
        )
        return payload

    except jwt.ExpiredSignatureError:
        # exp が現在のUNIXタイムスタンプより過去の場合
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "token_expired",
                "message": "JWTの有効期限が切れています (exp クレームを確認してください)",
            },
        )
    except jwt.InvalidSignatureError:
        # 公開鍵で署名検証に失敗した場合（改ざんや別サーバーが発行したトークン）
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "invalid_signature",
                "message": "JWT署名が無効です。トークンが改ざんされているか、このサーバーが発行したものではありません",
            },
        )
    except jwt.DecodeError as e:
        # JWTのフォーマットが不正な場合（3パーツに分割できない等）
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "decode_error", "message": f"JWTのデコードに失敗しました: {e}"},
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "auth_error", "message": str(e)},
        )


# ─────────────────────────────────────────────────────────
# 保護されたAPIエンドポイント群 (Depends(verify_jwt)で保護)
# ─────────────────────────────────────────────────────────

@app.get("/api/me")
def get_me(payload: dict = Depends(verify_jwt)):
    """
    JWT検証後の全クレームを返す確認用エンドポイント。
    どんなクレームが入っているかを確認するのに使う。
    """
    return {
        "message": "✅ JWT検証成功",
        "all_claims": payload,
        "summary": {
            "subject":    payload.get("sub"),
            "role":       payload.get("user.role"),
            "team":       payload.get("user.team"),
            "rag_access": payload.get("rag.access"),
            "budget":     payload.get("cost.budget"),
        },
    }


@app.get("/api/customers")
def get_customers(payload: dict = Depends(verify_jwt)):
    """
    顧客情報API — ロールベースABAC の例。

    ──────────────────────────────────────────
    【認可ロジック (ABAC: user.role属性による分岐)】

    JWT内の "user.role" クレームの値で返すデータを変える:

      "営業Mgr"    → 全顧客詳細（売上・連絡先・担当者メモ含む）
      "営業Member" → 顧客名とステータスのみのサマリー
      それ以外     → 403 Forbidden

    これがABACの基本:
    「ユーザーが持つ属性（role）に基づいてリソースへのアクセスを制御する」
    ──────────────────────────────────────────
    """
    role = payload.get("user.role", "")
    team = payload.get("user.team", "不明")

    if role == "営業Mgr":
        # マネージャーには全詳細データを返す
        return {
            "access_level": "full_detail",
            "role": role,
            "team": team,
            "total_count": len(CUSTOMERS_FULL),
            "total_annual_revenue": sum(c["annual_revenue"] for c in CUSTOMERS_FULL),
            "customers": CUSTOMERS_FULL,
            "message": f"🔓 [{team}] マネージャー権限で全顧客データを取得しました",
        }
    elif role == "営業Member":
        # メンバーにはサマリーのみ返す（機密情報を除外）
        summary = [
            {"id": c["id"], "name": c["name"], "contract_status": c["contract_status"]}
            for c in CUSTOMERS_FULL
        ]
        return {
            "access_level": "summary_only",
            "role": role,
            "team": team,
            "total_count": len(summary),
            "customers": summary,
            "message": f"🔒 [{team}] メンバー権限でサマリーのみ取得しました（詳細は営業Mgr権限が必要）",
        }
    else:
        # 認可されていないロール → 403
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "forbidden",
                "message": f"ロール '{role}' は顧客データへのアクセス権を持ちません",
                "required_roles": ["営業Mgr", "営業Member"],
                "your_role": role,
            },
        )


@app.get("/api/rag/search")
def rag_search(payload: dict = Depends(verify_jwt)):
    """
    RAG検索API — 段階的Tierレベルによるアクセス制御の例。

    ──────────────────────────────────────────
    【認可ロジック (ABAC: rag.access属性の数値比較)】

    "rag.access" クレームのTier番号以下のデータにアクセス可能。
    例: Tier3を持つユーザーはTier1, Tier2, Tier3のデータを取得できる。

    これはABACにおける「属性値の大小比較による段階的許可」の例。
    ロールだけでなく、数値・レベル・タグ等も認可条件にできるのがABACの強み。
    ──────────────────────────────────────────
    """
    rag_tier = payload.get("rag.access", "Tier1")

    try:
        tier_num = int(str(rag_tier).replace("Tier", ""))
    except (ValueError, AttributeError):
        tier_num = 1
        rag_tier = "Tier1"

    # 自分のTier以下のデータを全て収集（累積アクセスモデル）
    accessible = {
        f"Tier{i}": RAG_DATA_BY_TIER[f"Tier{i}"]
        for i in range(1, tier_num + 1)
        if f"Tier{i}" in RAG_DATA_BY_TIER
    }
    inaccessible = [f"Tier{i}" for i in range(tier_num + 1, 7)]

    return {
        "your_rag_access": rag_tier,
        "accessible_tiers": list(accessible.keys()),
        "inaccessible_tiers": inaccessible,
        "results": accessible,
        "message": f"🔍 {rag_tier}権限で {len(accessible)} 階層のナレッジにアクセスできます",
    }


@app.get("/api/budget/approve")
def budget_approve(payload: dict = Depends(verify_jwt)):
    """
    予算承認API — 複数属性の組み合わせによる細粒度制御の例。

    ──────────────────────────────────────────
    【認可ロジック (ABAC: role × budget の組み合わせ)】

    "cost.budget" の数値と "user.role" を組み合わせて承認権限を判定。
    同じ予算額でもロールによって承認可否が変わる。

    これはABACにおける「複数属性の AND 条件による認可」の例。
    RBAC（ロールのみ）よりも細粒度な制御が実現できる。
    ──────────────────────────────────────────
    """
    budget: int = payload.get("cost.budget", 0)
    role: str = payload.get("user.role", "")
    sub: str = payload.get("sub", "不明")

    # 予算額に応じた承認権限レベルの判定
    if budget >= 10_000_000:
        approval_level = "自己承認可（上長不要）"
        can_self_approve = True
        note = "1,000万円以上の承認権限を持つ最高レベルの予算権限です"
    elif budget >= 1_000_000:
        approval_level = "部長承認が必要"
        can_self_approve = False
        note = f"¥{budget:,}の案件には部長の承認が必要です"
    elif budget >= 100_000:
        # 同じ予算帯でもロールによって自己承認可否が分かれる
        can_self_approve = (role == "営業Mgr")
        approval_level = "マネージャー承認が必要"
        who = "あなた（営業Mgr）が承認できます" if can_self_approve else "営業Mgrの承認が必要です（あなたのロールでは不可）"
        note = f"¥{budget:,}の案件: {who}"
    else:
        approval_level = "チームリーダー承認で可"
        can_self_approve = True
        note = f"¥{budget:,}の案件はチームリーダーレベルで承認可能です"

    return {
        "sub": sub,
        "role": role,
        "budget": budget,
        "formatted_budget": f"¥{budget:,}",
        "approval_level": approval_level,
        "can_self_approve": can_self_approve,
        "note": note,
        "message": f"💰 予算権限を確認しました: {approval_level}",
    }


# ═══════════════════════════════════════════════════════════
# OIDC Authorization Code Flow モック
# ═══════════════════════════════════════════════════════════
#
# 実際のOKTAが実装しているOIDCフローをサーバーサイドで再現する。
# ブラウザリダイレクトは学習UIで「シミュレート」するため、
# 各エンドポイントはリダイレクトではなくJSONを返す設計にしている。
#
# フロー概要:
#   ① クライアントが /auth/authorize に認可リクエスト
#   ② ユーザーがIdP（このサーバー）でログイン（ユーザー選択）
#   ③ IdPが認可コード（code）を発行 → redirect_uriに返す
#   ④ クライアントのバックエンドが /auth/token でコードをトークンに交換
#   ⑤ access_token で /api/* を呼び出す
# ═══════════════════════════════════════════════════════════

# ─────────────────────────────────────────────────────────
# モックユーザーDB（OKTAのユーザーストアに相当）
# ─────────────────────────────────────────────────────────
MOCK_USERS: dict[str, dict] = {
    "u001": {
        "sub": "u001",
        "name": "田中 一郎",
        "email": "tanaka@biz.example.com",
        "user.role": "営業Mgr",
        "user.team": "東京営業チーム",
        "rag.access": "Tier3",
        "cost.budget": 500_000,
    },
    "u002": {
        "sub": "u002",
        "name": "鈴木 花子",
        "email": "suzuki@biz.example.com",
        "user.role": "営業Member",
        "user.team": "東京営業チーム",
        "rag.access": "Tier2",
        "cost.budget": 100_000,
    },
    "u003": {
        "sub": "u003",
        "name": "佐藤 次郎",
        "email": "sato@infra.example.com",
        "user.role": "admin",
        "user.team": "情報基盤チーム",
        "rag.access": "Tier6",
        "cost.budget": 10_000_000,
    },
}

# ─────────────────────────────────────────────────────────
# 認可コードのインメモリストア
# 本番では Redis 等の短命なストアを使う
# ─────────────────────────────────────────────────────────
AUTH_CODES: dict[str, dict] = {}

# ─────────────────────────────────────────────────────────
# クライアントアプリの登録情報（OKTAのApplication設定に相当）
# ─────────────────────────────────────────────────────────
OIDC_CLIENT_ID = "demo-client-001"
OIDC_CLIENT_SECRET = "demo-secret-xyz-9999"
OIDC_REDIRECT_URI = "http://localhost:5173"


# ─────────────────────────────────────────────────────────
# ヘルパー: RSA公開鍵をJWK形式に変換
# ─────────────────────────────────────────────────────────
def public_pem_to_jwk(pem: str, kid: str) -> dict:
    """
    PEM形式の公開鍵をJWK（JSON Web Key）形式に変換する。

    JWKの構造:
      kty: キーの種類 (RSA)
      use: 用途 (sig = 署名検証)
      alg: アルゴリズム (RS256)
      kid: このキーを識別するID（JWTのHeaderの kid と照合する）
      n:   RSA modulus（公開鍵の主要パラメータ）Base64URL
      e:   RSA public exponent（通常65537）Base64URL

    検証側は:
      1. JWTのHeaderから kid を取得
      2. JWKSから同じ kidを持つキーを探す
      3. そのキーのn,eからRSA公開鍵を再構成して署名検証
    """
    public_key = load_pem_public_key(pem.encode())
    pub_numbers = public_key.public_numbers()

    def int_to_base64url(n: int) -> str:
        byte_length = (n.bit_length() + 7) // 8
        return base64.urlsafe_b64encode(
            n.to_bytes(byte_length, "big")
        ).rstrip(b"=").decode()

    return {
        "kty": "RSA",
        "use": "sig",
        "alg": "RS256",
        "kid": kid,
        "n": int_to_base64url(pub_numbers.n),
        "e": int_to_base64url(pub_numbers.e),
    }


# ─────────────────────────────────────────────────────────
# OIDC Pydanticモデル
# ─────────────────────────────────────────────────────────
class AuthorizeBody(BaseModel):
    """認可エンドポイントへのリクエスト"""
    sub: str           # IdPで選択したユーザーID
    client_id: str     # アプリのID（OKTAのClient IDに相当）
    redirect_uri: str  # コードを返す先のURL
    state: str         # CSRF対策：クライアントが生成したランダム値
    nonce: str         # リプレイ攻撃対策：id_tokenに埋め込まれる


class OidcTokenBody(BaseModel):
    """トークンエンドポイントへのリクエスト"""
    grant_type: str    # "authorization_code" 固定
    code: str          # /auth/authorize で受け取ったコード
    client_id: str
    client_secret: str  # サーバーサイドでのみ使う秘密（ブラウザには渡さない）
    redirect_uri: str   # 認可時と同じURIでないと拒否される（なりすまし防止）


# ─────────────────────────────────────────────────────────
# OIDCディスカバリ・エンドポイント
# ─────────────────────────────────────────────────────────
@app.get("/.well-known/openid-configuration")
def openid_configuration():
    """
    OIDCディスカバリドキュメント。

    OKTAやAuth0はこのURLを公開しており、
    クライアントライブラリはここを最初に取得して
    各エンドポイントのURLを動的に解決する（ハードコード不要）。

    例: https://{okta-domain}/.well-known/openid-configuration
    """
    base = "http://localhost:8000"
    return {
        "issuer": base,
        "authorization_endpoint": f"{base}/auth/authorize",
        "token_endpoint": f"{base}/auth/token",
        "userinfo_endpoint": f"{base}/auth/userinfo",
        "jwks_uri": f"{base}/.well-known/jwks.json",
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code", "refresh_token"],
        "subject_types_supported": ["public"],
        "id_token_signing_alg_values_supported": ["RS256"],
        "scopes_supported": ["openid", "profile", "email"],
        "token_endpoint_auth_methods_supported": ["client_secret_post"],
        "claims_supported": [
            "sub", "iss", "aud", "exp", "iat", "nonce",
            "name", "email",
            "user.role", "user.team", "rag.access", "cost.budget",
        ],
        "_note": "OKTAなどのOIDCプロバイダーが公開する標準ドキュメント。クライアントはここから各エンドポイントURLを自動取得する。",
    }


@app.get("/.well-known/jwks.json")
def get_jwks():
    """
    JSON Web Key Set（JWKS）エンドポイント。

    APIサーバー（リソースサーバー）はここから公開鍵を取得し、
    受け取ったJWTの署名を検証する。

    JWTのHeaderに含まれる "kid" でどのキーを使うかを特定する：
      JWT Header: {"alg":"RS256","kid":"mock-key-001"}
      JWKS: { "keys": [{"kid":"mock-key-001","n":"...","e":"..."}] }
      → kidが一致するキーでRSA署名検証

    複数のキーを持てる理由: 鍵のローテーション時に
    古いトークンも引き続き検証できるよう両方を公開しておく。
    """
    return {
        "keys": [public_pem_to_jwk(PUBLIC_KEY_PEM, KEY_ID)],
        "_note": "kidでJWTのHeaderと照合して署名検証に使う公開鍵を特定する",
    }


# ─────────────────────────────────────────────────────────
# STEP ① ユーザー一覧（IdPのログイン画面に表示するユーザー）
# ─────────────────────────────────────────────────────────
@app.get("/auth/users")
def list_mock_users():
    """学習用: IdPのログイン選択画面に表示するモックユーザー一覧"""
    return {
        "users": [
            {
                "sub": u["sub"],
                "name": u["name"],
                "email": u["email"],
                "role": u["user.role"],
                "team": u["user.team"],
            }
            for u in MOCK_USERS.values()
        ]
    }


# ─────────────────────────────────────────────────────────
# STEP ② 認可コード発行
# ─────────────────────────────────────────────────────────
@app.post("/auth/authorize")
def authorize(body: AuthorizeBody):
    """
    認可コードを発行する。

    実際のOKTAでは:
      - このエンドポイントはブラウザのリダイレクトで呼ばれる
      - レスポンスはHTMLのログイン画面 or リダイレクトレスポンス
      - redirect_uri?code=xxx&state=xxx にリダイレクト

    このモックでは:
      - ユーザー選択済みという前提でJSONで返す
      - フロントエンドが「リダイレクトを受け取った」ことをシミュレート

    【認可コードの特性】
      - 有効期限: 60秒（OKTAは通常5分）
      - 1回限り使い捨て（used=Trueになったら再利用不可）
      - ブラウザのURLに乗って渡される（傍受されてもトークンではないので安全）
    """
    if body.client_id != OIDC_CLIENT_ID:
        raise HTTPException(
            status_code=400,
            detail={"error": "invalid_client", "message": f"未登録のclient_id: {body.client_id}"},
        )
    if body.sub not in MOCK_USERS:
        raise HTTPException(
            status_code=400,
            detail={"error": "invalid_user", "message": f"ユーザーが見つかりません: {body.sub}"},
        )

    now = int(time.time())
    code = secrets.token_urlsafe(24)

    AUTH_CODES[code] = {
        "sub": body.sub,
        "nonce": body.nonce,
        "redirect_uri": body.redirect_uri,
        "expires_at": now + 60,
        "used": False,
    }

    return {
        "code": code,
        "state": body.state,
        "redirect_uri_with_code": f"{body.redirect_uri}?code={code}&state={body.state}",
        "expires_in_seconds": 60,
        "_note": {
            "code": "60秒・1回限りの使い捨てコード。ブラウザURLに乗るが短命なので傍受されても被害が限定的。",
            "state": "クライアントが送った値がそのまま返ってくる。値が変わっていたらCSRF攻撃を意味する。",
        },
    }


# ─────────────────────────────────────────────────────────
# STEP ③ トークン交換
# ─────────────────────────────────────────────────────────
@app.post("/auth/token")
def oidc_token(body: OidcTokenBody):
    """
    認可コード → トークンセット（access_token + id_token + refresh_token）に交換する。

    【なぜサーバーサイドでコードを交換するのか】
      - client_secret をブラウザに持たせると漏洩リスクがある
      - このリクエストはサーバー→サーバー間（ブラウザを経由しない）
      - → client_secret が安全に使える

    【3種類のトークンの役割】
      access_token  : APIサーバーへの「入場証」。短命（1時間）。
                      認可クレーム(user.role等)が入っている。
      id_token      : クライアントアプリへの「本人証明書」。
                      nonce（リプレイ攻撃防止）が入っている。
                      APIサーバーには送らない。
      refresh_token : 新しいaccess_tokenを再ログインなしで取得するための長命なトークン。
                      厳重に管理する必要がある（漏れると長期間なりすまし可能）。
    """
    if body.grant_type != "authorization_code":
        raise HTTPException(status_code=400, detail={"error": "unsupported_grant_type"})
    if body.client_id != OIDC_CLIENT_ID or body.client_secret != OIDC_CLIENT_SECRET:
        raise HTTPException(
            status_code=401,
            detail={"error": "invalid_client", "message": "client_id または client_secret が不正です"},
        )

    code_data = AUTH_CODES.get(body.code)
    if not code_data:
        raise HTTPException(
            status_code=400,
            detail={"error": "invalid_grant", "message": "認可コードが見つかりません"},
        )
    if code_data["used"]:
        raise HTTPException(
            status_code=400,
            detail={"error": "invalid_grant", "message": "認可コードは既に使用済みです（1回限り使い捨て）"},
        )
    if int(time.time()) > code_data["expires_at"]:
        raise HTTPException(
            status_code=400,
            detail={"error": "invalid_grant", "message": "認可コードの有効期限切れ（60秒以内に交換が必要）"},
        )
    if body.redirect_uri != code_data["redirect_uri"]:
        raise HTTPException(
            status_code=400,
            detail={"error": "invalid_grant", "message": "redirect_uri が認可時と一致しません（なりすまし防止）"},
        )

    AUTH_CODES[body.code]["used"] = True

    now = int(time.time())
    user = MOCK_USERS[code_data["sub"]]
    hdr = {"kid": KEY_ID}

    # ① access_token: リソースサーバー（/api/*）に提示するトークン
    access_payload = {
        "iss": "http://localhost:8000",
        "sub": user["sub"],
        "aud": "http://localhost:8000",   # 受け取るのはAPIサーバー
        "iat": now,
        "exp": now + 3600,
        "jti": f"at-{secrets.token_hex(8)}",
        "token_use": "access",
        "scope": "openid profile",
        # カスタムクレーム（認可判断に使う）
        "user.role": user["user.role"],
        "user.team": user["user.team"],
        "rag.access": user["rag.access"],
        "cost.budget": user["cost.budget"],
    }
    access_token = jwt.encode(access_payload, PRIVATE_KEY_PEM, algorithm="RS256", headers=hdr)

    # ② id_token: クライアントアプリが「誰がログインしたか」を確認するためのトークン
    id_payload = {
        "iss": "http://localhost:8000",
        "sub": user["sub"],
        "aud": OIDC_CLIENT_ID,            # 受け取るのはクライアントアプリ
        "iat": now,
        "exp": now + 3600,
        "jti": f"id-{secrets.token_hex(8)}",
        "token_use": "id",
        "nonce": code_data["nonce"],      # 認可リクエスト時のnonceと一致することを確認する
        # プロファイル情報（認証の証明のみ。認可クレームは含めない）
        "name": user["name"],
        "email": user["email"],
    }
    id_token = jwt.encode(id_payload, PRIVATE_KEY_PEM, algorithm="RS256", headers=hdr)

    # ③ refresh_token: 新しいaccess_tokenを取得するための長命なトークン
    refresh_payload = {
        "iss": "http://localhost:8000",
        "sub": user["sub"],
        "iat": now,
        "exp": now + 30 * 24 * 3600,     # 30日
        "jti": f"rt-{secrets.token_hex(8)}",
        "token_use": "refresh",
    }
    refresh_token = jwt.encode(refresh_payload, PRIVATE_KEY_PEM, algorithm="RS256", headers=hdr)

    return {
        "access_token": access_token,
        "id_token": id_token,
        "refresh_token": refresh_token,
        "token_type": "Bearer",
        "expires_in": 3600,
        "scope": "openid profile",
        "_token_guide": {
            "access_token": "APIサーバーに渡す。user.role等の認可クレームが入っている。有効期限1時間。",
            "id_token": "クライアントアプリが『誰がログインしたか』を確認するためのみ使う。nonceでリプレイ攻撃を防ぐ。",
            "refresh_token": "access_tokenが切れたとき再ログインなしで更新するための長命（30日）トークン。漏洩に注意。",
        },
    }


@app.get("/auth/userinfo")
def userinfo(payload: dict = Depends(verify_jwt)):
    """
    access_tokenを提示してユーザー情報を取得するOIDC標準エンドポイント。
    id_tokenを持っていない場合でも、このエンドポイントでユーザー情報を取得できる。
    """
    sub = payload.get("sub")
    user = MOCK_USERS.get(sub, {})
    return {
        "sub": sub,
        "name": user.get("name", "不明"),
        "email": user.get("email", "不明"),
        "team": user.get("user.team", "不明"),
        "role": user.get("user.role", "不明"),
    }
