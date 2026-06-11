// トークンワークベンチ: 任意の kid で JWT を発行・検証する自由操作パネル

import { useState } from 'react'
import type { KeyEntry, IssuedToken, VerifyResult } from '../types'

const API = 'http://localhost:8001'

interface Props {
  keys: KeyEntry[]
}

export function TokenWorkbench({ keys }: Props) {
  const activeKeys = keys.filter(k => k.status === 'active')

  const [selectedKid, setSelectedKid] = useState<string>('')
  const [subject, setSubject] = useState('demo-user')
  const [issued, setIssued] = useState<IssuedToken | null>(null)
  const [rawToken, setRawToken] = useState('')
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null)
  const [issuing, setIssuing] = useState(false)
  const [verifying, setVerifying] = useState(false)

  const issueToken = async () => {
    const kid = selectedKid || activeKeys[0]?.kid
    if (!kid) return
    setIssuing(true)
    try {
      const res = await fetch(`${API}/tokens/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kid, subject, extra_claims: { demo: true } }),
      })
      const data: IssuedToken = await res.json()
      setIssued(data)
      setRawToken(data.token)
      setVerifyResult(null)
    } catch (e) {
      alert('発行エラー: ' + e)
    } finally {
      setIssuing(false)
    }
  }

  const verifyToken = async () => {
    const token = rawToken.trim()
    if (!token) return
    setVerifying(true)
    try {
      const res = await fetch(`${API}/tokens/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data: VerifyResult = await res.json()
      setVerifyResult(data)
    } catch (e) {
      alert('検証エラー: ' + e)
    } finally {
      setVerifying(false)
    }
  }

  const decodeHeader = (token: string) => {
    try {
      return JSON.parse(atob(token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')))
    } catch { return null }
  }

  const decodePayload = (token: string) => {
    try {
      return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    } catch { return null }
  }

  const header = rawToken ? decodeHeader(rawToken) : null
  const payload = rawToken ? decodePayload(rawToken) : null

  return (
    <div className="step-card">
      <div className="step-head">
        <span className="step-badge">WORKBENCH</span>
        <h2>トークン発行 / 検証ワークベンチ</h2>
      </div>

      <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.7 }}>
        任意の鍵で JWT を発行し、即座に検証できます。鍵の状態を変えながら何度でも試してください。
      </p>

      {/* 発行セクション */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        {/* kid 選択 */}
        <div style={{ flex: '0 0 160px' }}>
          <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
            署名に使う鍵 (kid)
          </label>
          <select
            value={selectedKid}
            onChange={e => setSelectedKid(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 8px',
              background: 'var(--bg-inner)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-sm)',
              color: 'var(--text-primary)',
              fontFamily: "'JetBrains Mono',monospace",
              fontSize: '0.8rem',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {activeKeys.length === 0 && <option value="">（active な鍵なし）</option>}
            {activeKeys.map(k => (
              <option key={k.kid} value={k.kid}>{k.kid}</option>
            ))}
          </select>
        </div>

        {/* subject */}
        <div style={{ flex: 1, minWidth: 120 }}>
          <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
            subject (sub クレーム)
          </label>
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 8px',
              background: 'var(--bg-inner)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-sm)',
              color: 'var(--text-primary)',
              fontFamily: "'JetBrains Mono',monospace",
              fontSize: '0.8rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button
            className="btn btn-primary"
            onClick={issueToken}
            disabled={issuing || activeKeys.length === 0}
          >
            {issuing ? '発行中...' : 'JWT を発行'}
          </button>
        </div>
      </div>

      {/* 発行済みトークン情報 */}
      {issued && (
        <div style={{
          padding: '8px 12px',
          background: 'var(--success-dim)',
          border: '1px solid rgba(34,197,94,0.3)',
          borderRadius: 'var(--r-sm)',
          fontSize: '0.72rem',
          fontFamily: "'JetBrains Mono',monospace",
          color: 'var(--success)',
          marginBottom: 10,
        }}>
          発行: kid={issued.kid}  /  有効期限: {new Date(issued.expires_at * 1000).toLocaleTimeString('ja-JP')}
        </div>
      )}

      {/* JWT テキストエリア */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
          JWT（発行後に自動入力。手動で書き換えて試すことも可）
        </label>
        <textarea
          value={rawToken}
          onChange={e => { setRawToken(e.target.value); setVerifyResult(null) }}
          rows={3}
          style={{
            width: '100%',
            padding: '8px 10px',
            background: 'var(--bg-inner)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-sm)',
            color: 'var(--jwt-sig-color)',
            fontFamily: "'JetBrains Mono',monospace",
            fontSize: '0.68rem',
            outline: 'none',
            resize: 'vertical',
            lineHeight: 1.5,
            boxSizing: 'border-box',
          }}
          placeholder="eyJhbGci..."
        />
      </div>

      {/* デコード表示 */}
      {(header || payload) && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
          {header && (
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 4 }}>Header</div>
              <pre style={{
                margin: 0,
                padding: '8px 10px',
                background: 'var(--bg-card)',
                borderRadius: 'var(--r-sm)',
                border: '1px solid var(--border)',
                fontSize: '0.68rem',
                color: 'var(--jwt-header-color)',
                fontFamily: "'JetBrains Mono',monospace",
                overflow: 'auto',
                lineHeight: 1.5,
              }}>
                {JSON.stringify(header, null, 2)}
              </pre>
            </div>
          )}
          {payload && (
            <div style={{ flex: 2, minWidth: 200 }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 4 }}>Payload</div>
              <pre style={{
                margin: 0,
                padding: '8px 10px',
                background: 'var(--bg-card)',
                borderRadius: 'var(--r-sm)',
                border: '1px solid var(--border)',
                fontSize: '0.68rem',
                color: 'var(--jwt-payload-color)',
                fontFamily: "'JetBrains Mono',monospace",
                overflow: 'auto',
                lineHeight: 1.5,
              }}>
                {JSON.stringify(payload, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* 検証ボタン */}
      <button
        className="btn"
        style={{
          padding: '8px 20px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          color: 'var(--text-secondary)',
          borderRadius: 'var(--r-sm)',
          cursor: rawToken ? 'pointer' : 'not-allowed',
          fontFamily: 'inherit',
          fontWeight: 600,
          marginBottom: 10,
        }}
        onClick={verifyToken}
        disabled={verifying || !rawToken}
      >
        {verifying ? '検証中...' : '↑ このトークンを検証する'}
      </button>

      {/* 検証結果 */}
      {verifyResult && (
        <div style={{
          padding: '12px 14px',
          background: verifyResult.valid ? 'var(--success-dim)' : 'var(--danger-dim)',
          border: `1px solid ${verifyResult.valid ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
          borderRadius: 'var(--r-sm)',
          fontSize: '0.78rem',
          lineHeight: 1.7,
        }}>
          <div style={{
            fontWeight: 700,
            fontSize: '0.9rem',
            color: verifyResult.valid ? 'var(--success)' : 'var(--danger)',
            marginBottom: 6,
          }}>
            {verifyResult.valid ? '✅ 検証成功 (VALID)' : '❌ 検証失敗 (INVALID)'}
          </div>

          <div style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>
            {verifyResult.message}
          </div>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.72rem', fontFamily: "'JetBrains Mono',monospace" }}>
            {verifyResult.kid && (
              <span>kid: <span style={{ color: 'var(--warn)' }}>{verifyResult.kid}</span></span>
            )}
            {verifyResult.key_status && (
              <span>key_status: <span style={{ color: 'var(--text-primary)' }}>{verifyResult.key_status}</span></span>
            )}
            {verifyResult.error && (
              <span>error: <span style={{ color: 'var(--danger)' }}>{verifyResult.error}</span></span>
            )}
            {verifyResult.jwks_kids && (
              <span style={{ color: 'var(--text-muted)' }}>
                jwks: [{verifyResult.jwks_kids.map(k => `"${k}"`).join(', ')}]
              </span>
            )}
          </div>

          {verifyResult.payload && (
            <details style={{ marginTop: 8 }}>
              <summary style={{ cursor: 'pointer', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                ペイロードを表示
              </summary>
              <pre style={{
                margin: '6px 0 0',
                padding: '8px',
                background: 'var(--bg-card)',
                borderRadius: 'var(--r-sm)',
                fontSize: '0.68rem',
                color: 'var(--jwt-payload-color)',
                fontFamily: "'JetBrains Mono',monospace",
                overflow: 'auto',
                lineHeight: 1.5,
              }}>
                {JSON.stringify(verifyResult.payload, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
