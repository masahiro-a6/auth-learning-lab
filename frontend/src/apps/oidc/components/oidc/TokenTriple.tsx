// access_token / id_token / refresh_token を並べてデコード表示するコンポーネント
// 3つのトークンの「役割の違い」を視覚的に理解するための比較ビュー

import type { OidcTokenResponse } from '../../types'

interface TokenDef {
  key: keyof Pick<OidcTokenResponse, 'access_token' | 'id_token' | 'refresh_token'>
  label: string
  color: string
  bg: string
  border: string
  desc: string
  audience: string
}

const TOKEN_DEFS: TokenDef[] = [
  {
    key: 'access_token',
    label: 'access_token',
    color: 'var(--accent)',
    bg: 'var(--accent-dim)',
    border: 'rgba(59,130,246,0.3)',
    desc: 'APIサーバーに提示するトークン。Bearer認証で使う。',
    audience: '→ /api/* エンドポイント',
  },
  {
    key: 'id_token',
    label: 'id_token',
    color: 'var(--jwt-payload-color)',
    bg: 'var(--jwt-payload-bg)',
    border: 'var(--jwt-payload-bd)',
    desc: 'クライアントアプリが「誰がログインしたか」を確認するためのトークン。APIには送らない。',
    audience: '→ クライアントアプリのみ',
  },
  {
    key: 'refresh_token',
    label: 'refresh_token',
    color: 'var(--warn)',
    bg: 'var(--warn-dim)',
    border: 'rgba(245,158,11,0.3)',
    desc: 'access_tokenが期限切れになったとき、再ログインなしで新しいaccess_tokenを取得するために使う。',
    audience: '→ トークンエンドポイントのみ',
  },
]

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const padding = '='.repeat((4 - (parts[1].length % 4)) % 4)
    const base64 = (parts[1] + padding).replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64))
  } catch {
    return null
  }
}

function decodeJwtHeader(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const padding = '='.repeat((4 - (parts[0].length % 4)) % 4)
    const base64 = (parts[0] + padding).replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64))
  } catch {
    return null
  }
}

// 重要なクレームを説明付きで表示するための辞書
const CLAIM_NOTES: Record<string, string> = {
  iss: '発行者（Issuer）: どのIdPが発行したか',
  sub: '主体（Subject）: ユーザーID',
  aud: '受信者（Audience）: このトークンを受け取る想定の相手',
  iat: '発行日時（Issued At）: UNIXタイムスタンプ',
  exp: '有効期限（Expiration）: UNIXタイムスタンプ',
  jti: 'JWTのユニークID: リプレイ攻撃防止',
  nonce: '認可リクエスト時に送ったnonceと一致するか確認する（リプレイ攻撃防止）',
  token_use: 'このモック独自のクレーム: access / id / refresh を区別する',
  'user.role': 'カスタムクレーム: アプリの認可制御に使う',
  'user.team': 'カスタムクレーム: チーム情報',
  'rag.access': 'カスタムクレーム: RAGアクセスTier',
  'cost.budget': 'カスタムクレーム: 予算承認権限',
  kid: 'JWKS照合のためのKey ID（Headerに入る）',
}

const CUSTOM_CLAIM_KEYS = new Set(['user.role', 'user.team', 'rag.access', 'cost.budget', 'token_use'])

interface ClaimRowProps {
  name: string
  value: unknown
}

function ClaimRow({ name, value }: ClaimRowProps) {
  const isCustom = CUSTOM_CLAIM_KEYS.has(name)
  const note = CLAIM_NOTES[name]

  const valStr = typeof value === 'number'
    ? (name === 'iat' || name === 'exp'
        ? `${value} (${new Date(value * 1000).toLocaleString('ja-JP')})`
        : String(value))
    : JSON.stringify(value)

  return (
    <div
      title={note}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0 8px',
        padding: '3px 6px',
        borderRadius: 4,
        background: isCustom ? 'rgba(192,132,252,0.08)' : 'transparent',
        borderLeft: isCustom ? '2px solid var(--jwt-payload-color)' : '2px solid transparent',
        cursor: note ? 'help' : 'default',
        marginBottom: 2,
        fontSize: '0.72rem',
        fontFamily: "'JetBrains Mono','Fira Code',monospace",
        lineHeight: 1.7,
      }}
    >
      <span style={{ color: 'var(--text-secondary)' }}>{name}:</span>
      <span style={{
        color: typeof value === 'number' ? '#93c5fd' : '#86efac',
        wordBreak: 'break-all',
      }}>
        {valStr}
      </span>
      {note && (
        <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', width: '100%', marginTop: 1 }}>
          ↳ {note}
        </span>
      )}
    </div>
  )
}

interface Props {
  tokens: OidcTokenResponse
}

export function TokenTriple({ tokens }: Props) {
  return (
    <div>
      <div style={{
        padding: '10px 14px',
        background: 'var(--bg-inner)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-sm)',
        fontSize: '0.8rem',
        color: '#93c5fd',
        marginBottom: 16,
      }}>
        3種類のトークンが返ってきました。それぞれ<strong>受け取る相手（aud）</strong>と<strong>用途</strong>が異なります。
        クレーム名にマウスを当てると説明が表示されます。<strong>紫の行</strong>がカスタムクレームです。
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: 14,
      }}>
        {TOKEN_DEFS.map(def => {
          const rawToken = tokens[def.key]
          const header  = decodeJwtHeader(rawToken)
          const payload = decodeJwtPayload(rawToken)

          return (
            <div key={def.key} style={{
              background: def.bg,
              border: `1px solid ${def.border}`,
              borderRadius: 'var(--r-md)',
              overflow: 'hidden',
            }}>
              {/* ヘッダー */}
              <div style={{
                padding: '10px 14px',
                borderBottom: `1px solid ${def.border}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontFamily: "'JetBrains Mono',monospace",
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: def.color,
                  }}>
                    {def.label}
                  </span>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{def.desc}</div>
                <div style={{ fontSize: '0.7rem', color: def.color, fontWeight: 600 }}>{def.audience}</div>
              </div>

              {/* コンテンツ */}
              <div style={{ padding: '10px 14px' }}>
                {/* Header セクション */}
                {header && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{
                      fontSize: '0.62rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: 'var(--jwt-header-color)',
                      marginBottom: 4,
                    }}>
                      Header
                    </div>
                    {Object.entries(header).map(([k, v]) => (
                      <ClaimRow key={k} name={k} value={v} />
                    ))}
                  </div>
                )}

                <hr style={{ border: 'none', borderTop: `1px solid ${def.border}`, margin: '8px 0' }} />

                {/* Payload セクション */}
                {payload && (
                  <div>
                    <div style={{
                      fontSize: '0.62rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: 'var(--jwt-payload-color)',
                      marginBottom: 4,
                    }}>
                      Payload（クレーム）
                    </div>
                    {Object.entries(payload).map(([k, v]) => (
                      <ClaimRow key={k} name={k} value={v} />
                    ))}
                  </div>
                )}

                <hr style={{ border: 'none', borderTop: `1px solid ${def.border}`, margin: '8px 0' }} />

                {/* Raw token（折りたたみ） */}
                <details>
                  <summary style={{
                    fontSize: '0.68rem',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}>
                    Raw JWT を見る
                  </summary>
                  <div style={{
                    fontFamily: "'JetBrains Mono',monospace",
                    fontSize: '0.65rem',
                    wordBreak: 'break-all',
                    lineHeight: 1.7,
                    marginTop: 6,
                    color: 'var(--text-muted)',
                  }}>
                    {rawToken.split('.').map((part, i) => (
                      <span key={i} style={{
                        color: ['var(--jwt-header-color)', 'var(--jwt-payload-color)', 'var(--jwt-sig-color)'][i],
                      }}>
                        {part}{i < 2 ? '.' : ''}
                      </span>
                    ))}
                  </div>
                </details>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
