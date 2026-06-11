export interface KeyEntry {
  kid: string
  label: string
  status: 'active' | 'retired' | 'revoked'
  created_at: number
  in_jwks: boolean
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
  _meta: { active_count: number; total_count: number; active_kids: string[] }
}

export interface IssuedToken {
  token: string
  kid: string
  key_status: string
  issued_at: number
  expires_at: number
}

export interface VerifyResult {
  valid: boolean
  error?: string
  kid?: string
  key_status?: string
  message: string
  payload?: Record<string, unknown>
  jwks_kids?: string[]
}
