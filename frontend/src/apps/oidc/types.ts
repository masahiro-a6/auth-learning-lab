// ─── JWT発行リクエスト ───────────────────────────────────────
export interface TokenRequest {
  sub: string
  user_role: string
  user_team: string
  rag_access: string
  cost_budget: number
  expires_in: number
}

// ─── JWT発行レスポンス ───────────────────────────────────────
export interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  issued_at: number
  expires_at: number
  debug_payload: Record<string, unknown>
}

// ─── フロントエンドでデコードしたJWT ────────────────────────
export interface DecodedJWT {
  header: {
    alg: string
    typ: string
    [key: string]: unknown
  }
  payload: {
    iss?: string
    sub?: string
    aud?: string
    iat?: number
    exp?: number
    jti?: string
    'user.role'?: string
    'user.team'?: string
    'rag.access'?: string
    'cost.budget'?: number
    [key: string]: unknown
  }
  // Raw Base64URLエンコード済みパーツ（署名検証の学習用）
  rawHeader: string
  rawPayload: string
  rawSignature: string
}

// ─── API呼び出し結果 ──────────────────────────────────────────
export interface ApiCallResult {
  status: number
  statusText: string
  data: unknown
  durationMs: number
}

// ─── エンドポイント定義 ───────────────────────────────────────
export interface EndpointDef {
  method: 'GET'
  path: string
  label: string
  description: string
  abacNote: string
}

// ─── OIDC フロー用型定義 ─────────────────────────────────────

export interface MockUser {
  sub: string
  name: string
  email: string
  role: string
  team: string
}

export interface AuthParams {
  clientId: string
  redirectUri: string
  state: string        // CSRF対策トークン
  nonce: string        // リプレイ攻撃防止トークン
  scope: string
  responseType: string
}

export interface AuthCodeResponse {
  code: string
  state: string
  redirect_uri_with_code: string
  expires_in_seconds: number
  _note: { code: string; state: string }
}

export interface OidcTokenResponse {
  access_token: string
  id_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  scope: string
  _token_guide: { access_token: string; id_token: string; refresh_token: string }
}

export interface JwkKey {
  kty: string
  use: string
  alg: string
  kid: string
  n: string
  e: string
}

export interface JwksResponse {
  keys: JwkKey[]
}

export const ENDPOINTS: EndpointDef[] = [
  {
    method: 'GET',
    path: '/api/me',
    label: '自分のクレームを確認',
    description: 'JWT内の全クレームを返す（検証用）',
    abacNote: '認証のみ。認可制御なし。',
  },
  {
    method: 'GET',
    path: '/api/customers',
    label: '顧客情報を取得',
    description: 'ロールによってデータ量が変わる',
    abacNote: 'user.role = "営業Mgr" → 全詳細 / "営業Member" → サマリーのみ',
  },
  {
    method: 'GET',
    path: '/api/rag/search',
    label: 'RAGナレッジを検索',
    description: 'アクセスTierによって見えるデータが変わる',
    abacNote: 'rag.access のTier番号以下のデータにアクセス可能（累積モデル）',
  },
  {
    method: 'GET',
    path: '/api/budget/approve',
    label: '予算承認権限を確認',
    description: 'ロール×予算額の複合条件で権限判定',
    abacNote: 'user.role × cost.budget の AND 条件による細粒度制御',
  },
]
