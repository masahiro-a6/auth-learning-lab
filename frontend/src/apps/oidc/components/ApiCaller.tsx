import { useState } from 'react'
import type { ApiCallResult } from '../types'
import { ENDPOINTS } from '../types'

interface Props {
  token: string | null
  expiresAt: number | null
}

function syntaxHighlight(json: string): string {
  return json
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g, (match) => {
      let cls = 'response-number'
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'response-key'
        } else {
          cls = 'response-string'
        }
      } else if (/true|false/.test(match)) {
        cls = 'response-bool'
      } else if (/null/.test(match)) {
        cls = 'response-null'
      }
      return `<span class="${cls}">${match}</span>`
    })
}

export function ApiCaller({ token, expiresAt }: Props) {
  const [selectedPath, setSelectedPath] = useState<string>(ENDPOINTS[1].path)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ApiCallResult | null>(null)

  const selectedEndpoint = ENDPOINTS.find(e => e.path === selectedPath)!

  const now = Math.floor(Date.now() / 1000)
  const isExpired = expiresAt !== null && expiresAt <= now
  const canCall = token !== null && !isExpired

  const handleCall = async () => {
    if (!token) return
    setLoading(true)
    const start = performance.now()

    try {
      const res = await fetch(selectedPath, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const durationMs = Math.round(performance.now() - start)
      let data: unknown
      try {
        data = await res.json()
      } catch {
        data = { raw: await res.text() }
      }
      setResult({ status: res.status, statusText: res.statusText, data, durationMs })
    } catch (e) {
      setResult({
        status: 0,
        statusText: 'Network Error',
        data: { error: e instanceof Error ? e.message : String(e) },
        durationMs: Math.round(performance.now() - start),
      })
    } finally {
      setLoading(false)
    }
  }

  const statusClass = result
    ? result.status >= 500
      ? 'status-5xx'
      : result.status >= 400
      ? 'status-4xx'
      : 'status-2xx'
    : ''

  return (
    <div className="step-card">
      <div className="step-head">
        <span className="step-badge">STEP 3</span>
        <h2>APIを呼び出す（JWT認証 + ABAC認可）</h2>
        <p>JWTをAuthorizationヘッダーに付与してAPIを叩く</p>
      </div>

      {/* エンドポイント選択 */}
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
        ▼ 呼び出すエンドポイントを選択
      </div>
      <div className="endpoint-list">
        {ENDPOINTS.map(ep => (
          <button
            key={ep.path}
            className={`endpoint-btn${selectedPath === ep.path ? ' selected' : ''}`}
            onClick={() => setSelectedPath(ep.path)}
          >
            <span className="endpoint-method">{ep.method}</span>
            <span className="endpoint-info">
              <span className="endpoint-path">{ep.path}</span>
              <span className="endpoint-desc">{ep.description}</span>
              <span className="endpoint-abac">ABAC: {ep.abacNote}</span>
            </span>
          </button>
        ))}
      </div>

      {/* リクエストプレビュー */}
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 6, marginTop: 14 }}>
        ▼ 送信されるHTTPリクエスト
      </div>
      <div className="code-block" style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
        <span style={{ color: '#93c5fd' }}>GET</span>{' '}
        <span style={{ color: '#86efac' }}>{selectedPath}</span>{' '}
        <span style={{ color: 'var(--text-muted)' }}>HTTP/1.1</span>{'\n'}
        <span style={{ color: 'var(--text-secondary)' }}>Host: </span>
        <span style={{ color: 'var(--text-primary)' }}>localhost:8000</span>{'\n'}
        <span style={{ color: 'var(--text-secondary)' }}>Authorization: </span>
        {token ? (
          <>
            <span style={{ color: 'var(--jwt-sig-color)' }}>Bearer </span>
            <span style={{ color: 'var(--jwt-payload-color)' }}>
              {token.length > 60 ? token.slice(0, 30) + '…' + token.slice(-20) : token}
            </span>
          </>
        ) : (
          <span style={{ color: 'var(--danger)' }}>&lt;JWTが未発行です&gt;</span>
        )}
      </div>

      {/* 期限切れ警告 */}
      {token && isExpired && (
        <div className="warn-box">
          ⛔ JWTの有効期限が切れています。このまま送信すると 401 Expired を受け取ります（試してみましょう）。
        </div>
      )}

      {!token && (
        <div className="info-box">
          ℹ️ まずSTEP 1でJWTを発行してください。
        </div>
      )}

      {/* 送信ボタン */}
      <div style={{ marginTop: 14 }}>
        <button
          className={`btn ${canCall ? 'btn-primary' : 'btn-primary'}`}
          onClick={handleCall}
          disabled={loading || !token}
        >
          {loading ? '⏳ 呼び出し中...' : `🚀 ${selectedEndpoint.label}`}
        </button>

        {/* 期限切れトークンで意図的に試す用 */}
        {token && isExpired && (
          <button
            className="btn btn-success"
            onClick={handleCall}
            disabled={loading}
            style={{ marginLeft: 10 }}
          >
            ⚡ 期限切れトークンで送信してみる
          </button>
        )}
      </div>

      {/* レスポンス表示 */}
      {result && (
        <div style={{ marginTop: 20 }}>
          <div className="response-header">
            <span
              className={`status-badge ${statusClass}`}
            >
              {result.status} {result.statusText}
            </span>
            <span className="duration-badge">{result.durationMs}ms</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
              → {selectedPath}
            </span>
          </div>

          <pre
            className="response-body"
            dangerouslySetInnerHTML={{
              __html: syntaxHighlight(JSON.stringify(result.data, null, 2)),
            }}
          />

          {/* 認可制御の解説ボックス */}
          {result.status === 200 && selectedPath === '/api/customers' && (
            <div className="info-box">
              💡 <strong>ABAC動作確認:</strong> STEP 1で <code>user.role</code> を変えて再発行→再呼び出しすると、
              「営業Mgr」と「営業Member」でレスポンスが変わることを確認できます。
            </div>
          )}
          {result.status === 403 && (
            <div className="warn-box">
              🚫 <strong>403 Forbidden:</strong> JWT自体は有効ですが、JWT内のクレームが
              このAPIへのアクセス条件を満たしていません（ABAC認可拒否）。
              STEP 1でロールやTierを変更してみましょう。
            </div>
          )}
          {result.status === 401 && (
            <div className="warn-box">
              🔐 <strong>401 Unauthorized:</strong> JWTの署名検証または有効期限チェックに失敗しました。
              期限切れの場合はSTEP 1で再発行してください。
            </div>
          )}
        </div>
      )}

      {/* 構文ハイライト用インラインCSS */}
      <style>{`
        .response-key    { color: #93c5fd; }
        .response-string { color: #86efac; }
        .response-number { color: #fcd34d; }
        .response-bool   { color: #f9a8d4; }
        .response-null   { color: #6b7280; }
      `}</style>
    </div>
  )
}
