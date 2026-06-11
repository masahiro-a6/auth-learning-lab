// JWKS管理パネル: 現在の鍵一覧 + 追加・退役・失効ボタン

import { useState } from 'react'
import type { KeyEntry } from '../types'

const API = 'http://localhost:8001'

const STATUS_STYLE: Record<KeyEntry['status'], { color: string; bg: string; border: string; label: string }> = {
  active:  { color: 'var(--success)',           bg: 'var(--success-dim)',          border: 'rgba(34,197,94,0.3)',   label: 'ACTIVE — JWKSに公開中'   },
  retired: { color: 'var(--text-muted)',         bg: 'rgba(30,45,64,0.6)',          border: 'var(--border)',         label: 'RETIRED — JWKSから除外'  },
  revoked: { color: 'var(--danger)',             bg: 'var(--danger-dim)',           border: 'rgba(239,68,68,0.3)',  label: 'REVOKED — 失効済み'       },
}

interface Props {
  keys: KeyEntry[]
  onRefresh: () => void
}

export function JwksPanel({ keys, onRefresh }: Props) {
  const [adding, setAdding] = useState(false)
  const [actionMsg, setActionMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const showMsg = (text: string, ok: boolean) => {
    setActionMsg({ text, ok })
    setTimeout(() => setActionMsg(null), 4000)
  }

  const addKey = async () => {
    setAdding(true)
    try {
      const res = await fetch(`${API}/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: '' }),
      })
      const data = await res.json()
      showMsg(data.message, true)
      onRefresh()
    } catch {
      showMsg('鍵の追加に失敗しました', false)
    } finally {
      setAdding(false)
    }
  }

  const retireKey = async (kid: string) => {
    try {
      const res = await fetch(`${API}/keys/${kid}`, { method: 'DELETE' })
      const data = await res.json()
      showMsg(data.message ?? data.detail, res.ok)
      onRefresh()
    } catch {
      showMsg('操作に失敗しました', false)
    }
  }

  const revokeKey = async (kid: string) => {
    if (!confirm(`${kid} を失効させますか？\n（漏洩対応シミュレーション）`)) return
    try {
      const res = await fetch(`${API}/keys/${kid}/revoke`, { method: 'POST' })
      const data = await res.json()
      showMsg(data.message ?? data.detail, res.ok)
      onRefresh()
    } catch {
      showMsg('操作に失敗しました', false)
    }
  }

  const activeCount = keys.filter(k => k.status === 'active').length

  return (
    <div className="step-card">
      <div className="step-head">
        <span className="step-badge">JWKS</span>
        <h2>鍵管理パネル</h2>
        <p style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          active: {activeCount} / 全{keys.length}鍵
        </p>
      </div>

      {/* 現在のJWKSに含まれる鍵 */}
      <div style={{
        padding: '8px 12px',
        background: 'var(--bg-inner)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-sm)',
        fontSize: '0.72rem',
        color: 'var(--text-secondary)',
        marginBottom: 14,
        fontFamily: "'JetBrains Mono',monospace",
      }}>
        <span style={{ color: 'var(--jwt-sig-color)', fontWeight: 700 }}>
          GET /.well-known/jwks.json
        </span>
        {'  →  keys: ['}
        {keys.filter(k => k.status === 'active').map((k, i, arr) => (
          <span key={k.kid}>
            <span style={{ color: 'var(--warn)' }}>"{k.kid}"</span>
            {i < arr.length - 1 ? ', ' : ''}
          </span>
        ))}
        {activeCount === 0 && <span style={{ color: 'var(--danger)' }}>（空）</span>}
        {']'}
      </div>

      {/* 鍵一覧 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {keys.map(key => {
          const s = STATUS_STYLE[key.status]
          return (
            <div key={key.kid} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              background: s.bg,
              border: `1px solid ${s.border}`,
              borderRadius: 'var(--r-sm)',
              flexWrap: 'wrap',
            }}>
              {/* kid */}
              <span style={{
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: '0.85rem',
                fontWeight: 700,
                color: s.color,
                minWidth: 80,
              }}>
                {key.kid}
              </span>

              {/* ステータスバッジ */}
              <span style={{
                fontSize: '0.62rem',
                fontWeight: 700,
                color: s.color,
                border: `1px solid ${s.border}`,
                padding: '2px 8px',
                borderRadius: 99,
                letterSpacing: '0.06em',
              }}>
                {s.label}
              </span>

              {/* ラベル */}
              {key.label && key.label !== key.kid && (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                  {key.label}
                </span>
              )}

              {/* 生成日時 */}
              <span style={{
                fontSize: '0.68rem',
                color: 'var(--text-muted)',
                fontFamily: "'JetBrains Mono',monospace",
                marginLeft: 'auto',
              }}>
                {new Date(key.created_at * 1000).toLocaleTimeString('ja-JP')}
              </span>

              {/* アクションボタン */}
              {key.status === 'active' && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="btn btn-sm"
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-secondary)',
                      borderRadius: 'var(--r-sm)',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                    onClick={() => retireKey(key.kid)}
                    title="JWKSから除外する（ローテーション完了）"
                  >
                    退役
                  </button>
                  <button
                    className="btn btn-sm"
                    style={{
                      background: 'var(--danger-dim)',
                      border: '1px solid rgba(239,68,68,0.3)',
                      color: 'var(--danger)',
                      borderRadius: 'var(--r-sm)',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                    onClick={() => revokeKey(key.kid)}
                    title="失効させる（漏洩対応）"
                  >
                    失効
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 追加ボタン */}
      <button className="btn btn-primary" onClick={addKey} disabled={adding}>
        {adding ? '生成中...' : '+ 新しい鍵を追加'}
      </button>

      {/* アクション結果メッセージ */}
      {actionMsg && (
        <div style={{
          marginTop: 10,
          padding: '8px 12px',
          borderRadius: 'var(--r-sm)',
          fontSize: '0.8rem',
          background: actionMsg.ok ? 'var(--success-dim)' : 'var(--danger-dim)',
          border: `1px solid ${actionMsg.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
          color: actionMsg.ok ? 'var(--success)' : 'var(--danger)',
        }}>
          {actionMsg.text}
        </div>
      )}
    </div>
  )
}
