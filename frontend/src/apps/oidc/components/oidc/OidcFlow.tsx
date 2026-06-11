// OIDC Authorization Code Flow を6ステップで体験するメインコンポーネント
// 各ステップで「何のリクエストを誰に送っているか」を可視化する

import { useState, useEffect, useCallback } from 'react'
import type {
  MockUser, AuthParams, AuthCodeResponse, OidcTokenResponse, JwksResponse,
} from '../../types'
import { FlowDiagram } from './FlowDiagram'
import { TokenTriple } from './TokenTriple'
import { ApiCaller } from '../ApiCaller'

const API = 'http://localhost:8000'

// ─── ランダムな16進文字列を生成（state / nonce に使う）───
function randomHex(bytes = 16): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// ─── コードブロック付きラベル表示 ────────────────────────
function Param({ name, value, note }: { name: string; value: string; note?: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 8,
        flexWrap: 'wrap',
      }}>
        <span style={{
          fontFamily: "'JetBrains Mono',monospace",
          fontSize: '0.72rem',
          color: 'var(--jwt-payload-color)',
          fontWeight: 600,
          minWidth: 120,
        }}>
          {name}
        </span>
        <span style={{
          fontFamily: "'JetBrains Mono',monospace",
          fontSize: '0.72rem',
          color: '#86efac',
          wordBreak: 'break-all',
        }}>
          {value}
        </span>
      </div>
      {note && (
        <div style={{
          fontSize: '0.68rem',
          color: 'var(--text-muted)',
          marginTop: 2,
          marginLeft: 128,
          lineHeight: 1.4,
        }}>
          ↳ {note}
        </div>
      )}
    </div>
  )
}

// ─── HTTP リクエスト/レスポンスのブロック表示 ────────────
function HttpBlock({
  method, url, body, response, responseNote,
}: {
  method: string
  url: string
  body?: Record<string, string>
  response?: unknown
  responseNote?: string
}) {
  return (
    <div style={{
      background: 'var(--bg-inner)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--r-sm)',
      overflow: 'hidden',
      marginTop: 12,
    }}>
      {/* リクエスト行 */}
      <div style={{
        padding: '8px 14px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        <span style={{
          fontFamily: "'JetBrains Mono',monospace",
          fontSize: '0.7rem',
          fontWeight: 700,
          color: method === 'GET' ? 'var(--success)' : 'var(--warn)',
          background: method === 'GET' ? 'var(--success-dim)' : 'var(--warn-dim)',
          padding: '2px 8px',
          borderRadius: 4,
        }}>
          {method}
        </span>
        <span style={{
          fontFamily: "'JetBrains Mono',monospace",
          fontSize: '0.72rem',
          color: 'var(--text-primary)',
          wordBreak: 'break-all',
        }}>
          {url}
        </span>
      </div>

      {/* ボディ（POST の場合） */}
      {body && (
        <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{
            fontSize: '0.62rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text-muted)',
            marginBottom: 6,
          }}>
            Request Body
          </div>
          {Object.entries(body).map(([k, v]) => (
            <div key={k} style={{
              fontFamily: "'JetBrains Mono',monospace",
              fontSize: '0.72rem',
              lineHeight: 1.7,
            }}>
              <span style={{ color: 'var(--text-secondary)' }}>{k}: </span>
              <span style={{ color: '#86efac' }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* レスポンス */}
      {response !== undefined && (
        <div style={{ padding: '8px 14px' }}>
          <div style={{
            fontSize: '0.62rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--success)',
            marginBottom: 6,
          }}>
            Response 200 OK
          </div>
          {responseNote && (
            <div style={{
              fontSize: '0.68rem',
              color: '#93c5fd',
              marginBottom: 8,
              padding: '6px 10px',
              background: 'var(--accent-dim)',
              borderRadius: 4,
            }}>
              {responseNote}
            </div>
          )}
          <pre style={{
            fontFamily: "'JetBrains Mono',monospace",
            fontSize: '0.7rem',
            color: 'var(--text-primary)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            maxHeight: 300,
            overflowY: 'auto',
            lineHeight: 1.65,
          }}>
            {JSON.stringify(response, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

// ─── ステップカード ───────────────────────────────────────
function StepCard({
  num, title, subtitle, children, active, done,
}: {
  num: number
  title: string
  subtitle: string
  children: React.ReactNode
  active: boolean
  done: boolean
}) {
  if (!active && !done) return null

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius: 'var(--r-lg)',
      padding: '20px 24px',
      marginBottom: 16,
      boxShadow: active ? '0 0 0 1px rgba(59,130,246,0.2)' : 'none',
      transition: 'border-color 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: done ? 'var(--success)' : 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.75rem',
          fontWeight: 700,
          color: '#fff',
          flexShrink: 0,
        }}>
          {done && !active ? '✓' : num}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: '1rem' }}>{title}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{subtitle}</div>
        </div>
      </div>
      {children}
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// メインコンポーネント
// ═══════════════════════════════════════════════════════
export function OidcFlow() {
  const [step, setStep] = useState(1)

  // ── Step 1: 認可リクエストパラメータ（マウント時に生成）
  const [authParams] = useState<AuthParams>(() => ({
    clientId: 'demo-client-001',
    redirectUri: 'http://localhost:5173',
    state: randomHex(16),
    nonce: randomHex(16),
    scope: 'openid profile',
    responseType: 'code',
  }))

  // ── Step 2: IdPのモックユーザー一覧
  const [mockUsers, setMockUsers] = useState<MockUser[]>([])
  const [selectedUser, setSelectedUser] = useState<MockUser | null>(null)
  const [usersLoading, setUsersLoading] = useState(false)

  // ── Step 3: 認可コードレスポンス
  const [authCodeRes, setAuthCodeRes] = useState<AuthCodeResponse | null>(null)
  const [codeLoading, setCodeLoading] = useState(false)
  const [codeCountdown, setCodeCountdown] = useState<number | null>(null)

  // ── Step 4: トークンレスポンス
  const [tokenRes, setTokenRes] = useState<OidcTokenResponse | null>(null)
  const [tokenLoading, setTokenLoading] = useState(false)

  // ── Step 5: JWKS
  const [jwks, setJwks] = useState<JwksResponse | null>(null)

  // ── エラー
  const [error, setError] = useState<string | null>(null)

  // 認可コードのカウントダウン
  useEffect(() => {
    if (codeCountdown === null || codeCountdown <= 0) return
    const timer = setTimeout(() => setCodeCountdown(c => (c ?? 1) - 1), 1000)
    return () => clearTimeout(timer)
  }, [codeCountdown])

  const clearError = () => setError(null)

  // ─────────────────────────────────────────────────────
  // STEP 1 → 2: ユーザー一覧を取得（IdPのログイン画面相当）
  // ─────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    clearError()
    setUsersLoading(true)
    try {
      const res = await fetch(`${API}/auth/users`)
      const data = await res.json()
      setMockUsers(data.users)
      setStep(2)
    } catch (e) {
      setError(`ユーザー取得エラー: ${e}`)
    } finally {
      setUsersLoading(false)
    }
  }, [])

  // ─────────────────────────────────────────────────────
  // STEP 2 → 3: 認可コード発行
  // ─────────────────────────────────────────────────────
  const issueAuthCode = useCallback(async (user: MockUser) => {
    clearError()
    setSelectedUser(user)
    setCodeLoading(true)
    try {
      const res = await fetch(`${API}/auth/authorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sub: user.sub,
          client_id: authParams.clientId,
          redirect_uri: authParams.redirectUri,
          state: authParams.state,
          nonce: authParams.nonce,
        }),
      })
      const data: AuthCodeResponse = await res.json()
      setAuthCodeRes(data)
      setCodeCountdown(data.expires_in_seconds)
      setStep(3)
    } catch (e) {
      setError(`認可コード取得エラー: ${e}`)
    } finally {
      setCodeLoading(false)
    }
  }, [authParams])

  // ─────────────────────────────────────────────────────
  // STEP 3 → 4: トークン交換
  // ─────────────────────────────────────────────────────
  const exchangeToken = useCallback(async () => {
    if (!authCodeRes) return
    clearError()
    setTokenLoading(true)
    try {
      const res = await fetch(`${API}/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code: authCodeRes.code,
          client_id: authParams.clientId,
          client_secret: 'demo-secret-xyz-9999',
          redirect_uri: authParams.redirectUri,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        setError(`トークン交換失敗: ${err.detail?.message || JSON.stringify(err)}`)
        return
      }
      const data: OidcTokenResponse = await res.json()
      setTokenRes(data)
      setStep(4)
    } catch (e) {
      setError(`トークン交換エラー: ${e}`)
    } finally {
      setTokenLoading(false)
    }
  }, [authCodeRes, authParams])

  // ─────────────────────────────────────────────────────
  // STEP 4 → 5: JWKS 取得
  // ─────────────────────────────────────────────────────
  const fetchJwks = useCallback(async () => {
    if (jwks) { setStep(5); return }
    clearError()
    try {
      const res = await fetch(`${API}/.well-known/jwks.json`)
      const data: JwksResponse = await res.json()
      setJwks(data)
      setStep(5)
    } catch (e) {
      setError(`JWKS取得エラー: ${e}`)
    }
  }, [jwks])

  // ─────────────────────────────────────────────────────
  // STEP 5 → 6: API呼び出しへ
  // ─────────────────────────────────────────────────────
  const goToApiCall = () => setStep(6)

  // ─────────────────────────────────────────────────────
  // リセット
  // ─────────────────────────────────────────────────────
  const reset = () => {
    setStep(1)
    setMockUsers([])
    setSelectedUser(null)
    setAuthCodeRes(null)
    setCodeCountdown(null)
    setTokenRes(null)
    setJwks(null)
    setError(null)
  }

  const accessToken = tokenRes?.access_token ?? null
  const expiresAt = tokenRes ? Math.floor(Date.now() / 1000) + tokenRes.expires_in : null

  return (
    <div>
      {/* フロー図 */}
      <FlowDiagram currentStep={step} />

      {/* エラー */}
      {error && (
        <div style={{
          background: 'var(--danger-dim)',
          border: '1px solid rgba(239,68,68,0.4)',
          borderRadius: 'var(--r-sm)',
          padding: '10px 14px',
          fontSize: '0.82rem',
          color: '#fca5a5',
          marginBottom: 14,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
        }}>
          {error}
          <button onClick={clearError} style={{
            background: 'none', border: 'none', color: '#fca5a5',
            cursor: 'pointer', fontSize: '1rem', flexShrink: 0,
          }}>×</button>
        </div>
      )}

      {/* ─── STEP 1: 認可リクエスト ─────────────────────── */}
      <StepCard
        num={1}
        title="認可リクエスト"
        subtitle="クライアントアプリが認可サーバー（OKTA）にリクエストを送る"
        active={step === 1}
        done={step > 1}
      >
        <div style={{
          padding: '10px 14px',
          background: 'var(--accent-dim)',
          border: '1px solid rgba(59,130,246,0.25)',
          borderRadius: 'var(--r-sm)',
          fontSize: '0.8rem',
          color: '#93c5fd',
          marginBottom: 14,
          lineHeight: 1.6,
        }}>
          実際のOKTAでは、ブラウザが認可エンドポイントにリダイレクトされます。
          URLパラメータに <code style={{ color: 'var(--jwt-payload-color)' }}>state</code> と <code style={{ color: 'var(--jwt-payload-color)' }}>nonce</code> が含まれます。
          このモックでは同じ内容を JSON API で確認します。
        </div>

        <div style={{
          background: 'var(--bg-inner)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-sm)',
          padding: '14px 16px',
          marginBottom: 14,
        }}>
          <div style={{
            fontSize: '0.62rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text-muted)',
            marginBottom: 10,
          }}>
            認可リクエストのパラメータ（実際はURLクエリパラメータ）
          </div>
          <Param name="response_type" value={authParams.responseType} note="コードフローを指定。'token'はImplicit Flow（非推奨）" />
          <Param name="client_id"     value={authParams.clientId}     note="OKTAに登録したアプリのID（公開情報）" />
          <Param name="redirect_uri"  value={authParams.redirectUri}  note="コードを返す先のURL。登録済みのものだけ許可" />
          <Param name="scope"         value={authParams.scope}         note="openid=OIDC利用, profile=名前/メール取得" />
          <Param name="state"         value={authParams.state}         note="CSRF対策。レスポンスでそのまま返ってくる。改ざんされていたら攻撃を検知" />
          <Param name="nonce"         value={authParams.nonce}         note="リプレイ攻撃対策。id_tokenのPayloadに埋め込まれる" />
        </div>

        <button
          className="btn btn-primary"
          onClick={fetchUsers}
          disabled={usersLoading}
        >
          {usersLoading ? '接続中...' : '→ IdP（認可サーバー）にリクエスト送信'}
        </button>
      </StepCard>

      {/* ─── STEP 2: ユーザー認証（IdPのログイン画面） ──── */}
      <StepCard
        num={2}
        title="ユーザー認証"
        subtitle="IdPのログイン画面でユーザーが認証する（ここでパスワードを入力する）"
        active={step === 2}
        done={step > 2}
      >
        <div style={{
          padding: '10px 14px',
          background: 'rgba(52,211,153,0.08)',
          border: '1px solid rgba(52,211,153,0.25)',
          borderRadius: 'var(--r-sm)',
          fontSize: '0.8rem',
          color: 'var(--jwt-sig-color)',
          marginBottom: 14,
          lineHeight: 1.6,
        }}>
          <strong>重要:</strong> この画面はOKTAが表示するもの。アプリはパスワードを一切見ない。
          これがOIDCの核心です — アプリが資格情報に触れずにアイデンティティを確認できます。
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 10,
          marginBottom: 14,
        }}>
          {mockUsers.map(user => (
            <button
              key={user.sub}
              onClick={() => issueAuthCode(user)}
              disabled={codeLoading}
              style={{
                background: selectedUser?.sub === user.sub ? 'var(--accent-dim)' : 'var(--bg-inner)',
                border: `1px solid ${selectedUser?.sub === user.sub ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 'var(--r-sm)',
                padding: '12px 14px',
                textAlign: 'left',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                transition: 'all 0.15s',
                fontFamily: 'inherit',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>
                {user.name}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                {user.email}
              </div>
              <div style={{
                display: 'inline-block',
                marginTop: 6,
                fontSize: '0.68rem',
                fontWeight: 600,
                color: 'var(--jwt-payload-color)',
                background: 'var(--jwt-payload-bg)',
                padding: '2px 8px',
                borderRadius: 99,
                border: '1px solid var(--jwt-payload-bd)',
              }}>
                {user.role}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>
                {user.team}
              </div>
            </button>
          ))}
        </div>
        {codeLoading && (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>認可コードを発行中...</div>
        )}
      </StepCard>

      {/* ─── STEP 3: 認可コード受取 ─────────────────────── */}
      {authCodeRes && (
        <StepCard
          num={3}
          title="認可コード受取"
          subtitle="IdPがコードを発行 → redirect_uri にリダイレクト（URLにコードが乗ってくる）"
          active={step === 3}
          done={step > 3}
        >
          <div style={{
            padding: '10px 14px',
            background: 'var(--warn-dim)',
            border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: 'var(--r-sm)',
            fontSize: '0.8rem',
            color: 'var(--warn)',
            marginBottom: 14,
            lineHeight: 1.6,
          }}>
            コードはURLに乗って返ってくるので、傍受される可能性があります。
            だから<strong>短命（60秒）・1回限り</strong>なのです。コード自体はトークンではないので傍受されても即被害にはなりません。
          </div>

          <div style={{
            background: 'var(--bg-inner)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-sm)',
            padding: '14px 16px',
            marginBottom: 14,
          }}>
            <div style={{
              fontSize: '0.62rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--text-muted)',
              marginBottom: 10,
            }}>
              コールバックURL（ブラウザがここにリダイレクトされる）
            </div>
            <div style={{
              fontFamily: "'JetBrains Mono',monospace",
              fontSize: '0.72rem',
              wordBreak: 'break-all',
              lineHeight: 1.7,
              color: 'var(--text-primary)',
            }}>
              {authCodeRes.redirect_uri_with_code}
            </div>
          </div>

          <div style={{
            background: 'var(--bg-inner)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-sm)',
            padding: '14px 16px',
            marginBottom: 14,
          }}>
            <Param
              name="code"
              value={authCodeRes.code}
              note={authCodeRes._note.code}
            />
            <Param
              name="state"
              value={authCodeRes.state}
              note={authCodeRes._note.state}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              onClick={exchangeToken}
              disabled={tokenLoading || (codeCountdown !== null && codeCountdown <= 0)}
            >
              {tokenLoading ? 'トークン交換中...' : '→ /auth/token でトークンに交換'}
            </button>
            {codeCountdown !== null && (
              <span style={{
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: '0.78rem',
                color: codeCountdown > 10 ? 'var(--warn)' : 'var(--danger)',
                fontWeight: 600,
              }}>
                有効期限: {codeCountdown}秒
                {codeCountdown <= 0 && ' — 期限切れ（フローをリセットしてください）'}
              </span>
            )}
          </div>
        </StepCard>
      )}

      {/* ─── STEP 4: トークン交換結果（3トークン比較） ──── */}
      {tokenRes && (
        <StepCard
          num={4}
          title="トークン交換完了"
          subtitle="3種類のJWTが返ってきた。それぞれの役割の違いを確認する"
          active={step === 4}
          done={step > 4}
        >
          <div style={{
            padding: '10px 14px',
            background: 'var(--accent-dim)',
            border: '1px solid rgba(59,130,246,0.25)',
            borderRadius: 'var(--r-sm)',
            fontSize: '0.8rem',
            color: '#93c5fd',
            marginBottom: 14,
            lineHeight: 1.6,
          }}>
            このリクエストは<strong>サーバーサイドで</strong>行われます（client_secretを含むため）。
            ブラウザに client_secret を持たせてはいけません。
          </div>

          <HttpBlock
            method="POST"
            url={`${API}/auth/token`}
            body={{
              grant_type:    'authorization_code',
              code:          authCodeRes?.code ?? '',
              client_id:     authParams.clientId,
              client_secret: 'demo-secret-xyz-9999',
              redirect_uri:  authParams.redirectUri,
            }}
          />

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '20px 0' }} />

          <TokenTriple tokens={tokenRes} />

          <button
            className="btn btn-primary"
            style={{ marginTop: 16 }}
            onClick={fetchJwks}
          >
            → JWKS 検証の仕組みを理解する
          </button>
        </StepCard>
      )}

      {/* ─── STEP 5: JWKS 検証の仕組み ─────────────────── */}
      {jwks && (
        <StepCard
          num={5}
          title="JWKS 検証の仕組み"
          subtitle="APIサーバーはどうやってトークンの正当性を確認するのか"
          active={step === 5}
          done={step > 5}
        >
          <div style={{ marginBottom: 16 }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              marginBottom: 14,
            }}>
              {/* JWTのHeader */}
              <div style={{
                background: 'var(--jwt-header-bg)',
                border: '1px solid var(--jwt-header-bd)',
                borderRadius: 'var(--r-sm)',
                padding: '12px 14px',
              }}>
                <div style={{
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--jwt-header-color)',
                  marginBottom: 8,
                }}>
                  1. JWTのHeader（access_token）
                </div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '0.72rem', lineHeight: 1.7 }}>
                  <div><span style={{ color: 'var(--text-secondary)' }}>alg: </span><span style={{ color: '#86efac' }}>"RS256"</span></div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>kid: </span>
                    <span style={{ color: 'var(--warn)', fontWeight: 600 }}>"mock-key-001"</span>
                  </div>
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 6 }}>
                  kid = この署名を検証するのにどの公開鍵を使えばよいかを示す
                </div>
              </div>

              {/* JWKSのキー */}
              <div style={{
                background: 'rgba(52,211,153,0.06)',
                border: '1px solid rgba(52,211,153,0.25)',
                borderRadius: 'var(--r-sm)',
                padding: '12px 14px',
              }}>
                <div style={{
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--jwt-sig-color)',
                  marginBottom: 8,
                }}>
                  2. JWKSから取得した公開鍵
                </div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '0.72rem', lineHeight: 1.7 }}>
                  {jwks.keys[0] && Object.entries(jwks.keys[0]).map(([k, v]) => (
                    <div key={k} style={{ wordBreak: 'break-all' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{k}: </span>
                      <span style={{
                        color: k === 'kid' ? 'var(--warn)' : '#86efac',
                        fontWeight: k === 'kid' ? 700 : 400,
                      }}>
                        "{typeof v === 'string' && v.length > 20 ? v.slice(0, 20) + '...' : v}"
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 6 }}>
                  kidが一致 → n と e で RSA公開鍵を再構成して署名検証
                </div>
              </div>
            </div>

            {/* 矢印説明 */}
            <div style={{
              background: 'var(--bg-inner)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-sm)',
              padding: '12px 16px',
              marginBottom: 14,
            }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                <div style={{ marginBottom: 4 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>検証フロー（APIサーバー側）</strong>
                </div>
                <div>① リクエストの <code style={{ color: 'var(--accent)' }}>Authorization: Bearer &lt;token&gt;</code> からJWTを取得</div>
                <div>② JWTのHeaderをデコード → <code style={{ color: 'var(--warn)' }}>kid = "mock-key-001"</code> を取得</div>
                <div>③ <code style={{ color: 'var(--jwt-sig-color)' }}>/.well-known/jwks.json</code> から同じkidの公開鍵を取得（キャッシュ推奨）</div>
                <div>④ <code>n</code> と <code>e</code> からRSA公開鍵を再構成</div>
                <div>⑤ <code>RSA_Verify(公開鍵, SHA256(header.payload), signature)</code> で署名検証</div>
                <div>⑥ <code>exp</code> が未来 ✓ → Payloadのクレームを認可判断に使う</div>
              </div>
            </div>

            {/* ディスカバリドキュメントとの関係 */}
            <div style={{
              background: 'rgba(192,132,252,0.06)',
              border: '1px solid var(--jwt-payload-bd)',
              borderRadius: 'var(--r-sm)',
              padding: '12px 16px',
            }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                <strong style={{ color: 'var(--jwt-payload-color)' }}>OIDCディスカバリ</strong>
                {' '}— クライアントライブラリがJWKSのURLをどうやって知るか
                <br />
                <code style={{ color: 'var(--jwt-sig-color)', fontSize: '0.7rem' }}>
                  GET /.well-known/openid-configuration
                </code>
                {' → '}<code style={{ color: '#86efac', fontSize: '0.7rem' }}>
                  "jwks_uri": "{API}/.well-known/jwks.json"
                </code>
                <br />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  各エンドポイントのURLはディスカバリドキュメントから自動取得するため、OKTAのドメインだけ知っていればよい
                </span>
              </div>
            </div>
          </div>

          <button className="btn btn-primary" onClick={goToApiCall}>
            → access_token を使ってAPIを呼び出す
          </button>
        </StepCard>
      )}

      {/* ─── STEP 6: API呼び出し ─────────────────────────── */}
      {step >= 6 && accessToken && (
        <StepCard
          num={6}
          title="API呼び出し"
          subtitle="OIDCで取得した access_token を使って保護されたAPIを呼ぶ"
          active={step === 6}
          done={false}
        >
          <div style={{
            padding: '10px 14px',
            background: 'var(--success-dim)',
            border: '1px solid rgba(34,197,94,0.25)',
            borderRadius: 'var(--r-sm)',
            fontSize: '0.8rem',
            color: 'var(--success)',
            marginBottom: 14,
            lineHeight: 1.6,
          }}>
            access_tokenのPayloadに含まれる <code>user.role</code>・<code>rag.access</code>・<code>cost.budget</code> が
            APIサーバー側の認可判断（ABAC）に使われます。直接発行モードとまったく同じエンドポイントで動作します。
          </div>
          <ApiCaller token={accessToken} expiresAt={expiresAt} />
        </StepCard>
      )}

      {/* リセットボタン */}
      {step > 1 && (
        <button
          onClick={reset}
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-sm)',
            color: 'var(--text-secondary)',
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontFamily: 'inherit',
            marginTop: 8,
          }}
        >
          ↺ フローをリセット
        </button>
      )}
    </div>
  )
}
