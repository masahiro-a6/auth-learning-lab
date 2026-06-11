// SCIM 操作ログ: バックエンドで記録した全リクエスト履歴を表示

import { useState } from 'react'
import type { ScimEvent } from '../types'

const METHOD_COLOR: Record<string, string> = {
  GET: 'var(--success)',
  POST: 'var(--accent)',
  PUT: 'var(--warn)',
  PATCH: 'var(--purple)',
  DELETE: 'var(--danger)',
}

interface Props {
  events: ScimEvent[]
}

export function EventLog({ events }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="card">
      <div className="card-head">
        <span className="badge badge-yellow">LOG</span>
        <h2>SCIM リクエスト履歴</h2>
        <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          最新 {events.length} 件
        </span>
      </div>

      {events.length === 0 ? (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.78rem',
          border: '1px dashed var(--border)',
          borderRadius: 'var(--r-sm)',
        }}>
          まだ操作が記録されていません
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {events.map(ev => {
            const isOpen = expanded === ev.id
            return (
              <div key={ev.id} style={{
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-sm)',
                overflow: 'hidden',
              }}>
                {/* サマリー行（クリックで展開） */}
                <div
                  onClick={() => setExpanded(isOpen ? null : ev.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '7px 10px',
                    background: 'var(--bg-inner)',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  {/* メソッド */}
                  <span style={{
                    fontFamily: "'JetBrains Mono',monospace",
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    color: METHOD_COLOR[ev.method] ?? 'var(--text-primary)',
                    minWidth: 48,
                  }}>
                    {ev.method}
                  </span>

                  {/* パス */}
                  <span style={{
                    fontFamily: "'JetBrains Mono',monospace",
                    fontSize: '0.7rem',
                    color: 'var(--text-secondary)',
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {ev.path}
                  </span>

                  {/* ノート */}
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', flex: 1 }}>
                    {ev.note}
                  </span>

                  {/* ステータス */}
                  <span style={{
                    fontFamily: "'JetBrains Mono',monospace",
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: ev.status < 300 ? 'var(--success)' : 'var(--danger)',
                    minWidth: 30,
                    textAlign: 'right',
                  }}>
                    {ev.status}
                  </span>

                  {/* 時刻 */}
                  <span style={{
                    fontFamily: "'JetBrains Mono',monospace",
                    fontSize: '0.65rem',
                    color: 'var(--text-muted)',
                    minWidth: 60,
                    textAlign: 'right',
                  }}>
                    {new Date(ev.ts * 1000).toLocaleTimeString('ja-JP')}
                  </span>

                  <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                    {isOpen ? '▲' : '▼'}
                  </span>
                </div>

                {/* 展開: リクエスト/レスポンス詳細 */}
                {isOpen && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: ev.req ? '1fr 1fr' : '1fr',
                    gap: 8,
                    padding: '8px 10px',
                    background: 'var(--bg-card)',
                    borderTop: '1px solid var(--border)',
                  }}>
                    {ev.req && (
                      <div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 4 }}>Request</div>
                        <pre style={{
                          margin: 0,
                          fontSize: '0.63rem',
                          fontFamily: "'JetBrains Mono',monospace",
                          color: 'var(--accent)',
                          lineHeight: 1.5,
                          overflow: 'auto',
                          maxHeight: 160,
                        }}>
                          {JSON.stringify(ev.req, null, 2)}
                        </pre>
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 4 }}>Response</div>
                      <pre style={{
                        margin: 0,
                        fontSize: '0.63rem',
                        fontFamily: "'JetBrains Mono',monospace",
                        color: 'var(--success)',
                        lineHeight: 1.5,
                        overflow: 'auto',
                        maxHeight: 160,
                      }}>
                        {Object.keys(ev.res).length === 0
                          ? '（204 No Content）'
                          : JSON.stringify(ev.res, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
