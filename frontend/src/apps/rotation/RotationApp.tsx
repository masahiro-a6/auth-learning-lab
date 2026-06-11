import { useCallback, useEffect, useState } from 'react'
import type { KeyEntry } from './types'
import { JwksPanel } from './components/JwksPanel'
import { RotationScenario } from './components/RotationScenario'
import { TokenWorkbench } from './components/TokenWorkbench'
import { PositionBanner } from '../guide/PositionBanner'

const API = 'http://localhost:8001'

export function RotationApp() {
  const [keys, setKeys] = useState<KeyEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch(`${API}/keys`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setKeys(data.keys ?? data)
      setError(null)
    } catch (e) {
      setError(`バックエンドに接続できません: ${e}\nhttp://localhost:8001 が起動しているか確認してください`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchKeys()
    const id = setInterval(fetchKeys, 5000)
    return () => clearInterval(id)
  }, [fetchKeys])

  return (
    <div className="app-root">
      {/* ヘッダー */}
      <div className="app-header">
        <h1>🔑 JWT Key Rotation Lab</h1>
        <p>
          JWKS鍵管理 · ローテーションシナリオ · トークン発行 / 検証の全ライフサイクルを体験
        </p>
      </div>

      <PositionBanner
        color="#34d399"
        scope="【API利用を裏で支える鍵運用】"
        detail="アプリ①の署名検証が依存している仕組み——鍵のライフサイクルとJWKSを学びます。"
        order="前提: ① OIDC / JWT を先に。「署名検証」を理解してからの方が腑に落ちます。"
      />

      {/* エラー表示 */}
      {error && (
        <div style={{
          padding: '12px 16px',
          background: 'var(--danger-dim)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 'var(--r-md)',
          color: 'var(--danger)',
          fontSize: '0.8rem',
          lineHeight: 1.7,
          marginBottom: 16,
          whiteSpace: 'pre-line',
        }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 16 }}>
          接続中...
        </div>
      )}

      {!loading && !error && (
        <>
          {/* JWKS 管理パネル */}
          <JwksPanel keys={keys} onRefresh={fetchKeys} />

          {/* ローテーションシナリオ */}
          <RotationScenario keys={keys} onRefresh={fetchKeys} />

          {/* トークンワークベンチ */}
          <TokenWorkbench keys={keys} />
        </>
      )}

      {/* フッター */}
      <div style={{
        marginTop: 32,
        textAlign: 'center',
        fontSize: '0.68rem',
        color: 'var(--text-muted)',
      }}>
        Backend: http://localhost:8001 &nbsp;·&nbsp;
        <a
          href="http://localhost:8001/.well-known/jwks.json"
          target="_blank"
          rel="noreferrer"
          style={{ color: 'var(--accent)', textDecoration: 'none' }}
        >
          /.well-known/jwks.json
        </a>
        &nbsp;·&nbsp;
        <a
          href="http://localhost:8001/.well-known/openid-configuration"
          target="_blank"
          rel="noreferrer"
          style={{ color: 'var(--accent)', textDecoration: 'none' }}
        >
          openid-configuration
        </a>
      </div>
    </div>
  )
}
