// プロビジョニング済みユーザー一覧

import type { ScimUser } from '../types'

interface Props {
  users: ScimUser[]
  onDeactivate: (id: string, active: boolean) => void
  onDelete: (id: string, userName: string) => void
}

export function UserList({ users, onDeactivate, onDelete }: Props) {
  return (
    <div className="card">
      <div className="card-head">
        <span className="badge badge-green">USERS</span>
        <h2>プロビジョニング済みユーザー</h2>
        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {users.length} 件
        </span>
      </div>

      {users.length === 0 ? (
        <div style={{
          padding: '24px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.8rem',
          border: '1px dashed var(--border)',
          borderRadius: 'var(--r-sm)',
        }}>
          ユーザーがいません。下の「OKTA プッシュシミュレーター」で作成してください。
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {users.map(u => (
            <div key={u.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              background: u.active ? 'var(--bg-inner)' : 'rgba(30,30,40,0.5)',
              border: `1px solid ${u.active ? 'var(--border)' : 'rgba(255,255,255,0.04)'}`,
              borderRadius: 'var(--r-sm)',
              flexWrap: 'wrap',
              opacity: u.active ? 1 : 0.6,
            }}>
              {/* アクティブ状態インジケーター */}
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: u.active ? 'var(--success)' : 'var(--text-muted)',
                flexShrink: 0,
              }} title={u.active ? 'active' : 'inactive'} />

              {/* ユーザー情報 */}
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                  {u.name.formatted || u.displayName}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: "'JetBrains Mono',monospace" }}>
                  {u.userName}
                </div>
              </div>

              {/* メタ情報 */}
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                {u.title && <div>{u.title}</div>}
                {u.department && <div>{u.department}</div>}
              </div>

              {/* SCIM ID */}
              <div style={{
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: '0.65rem',
                color: 'var(--text-muted)',
                padding: '2px 6px',
                background: 'var(--bg-card)',
                borderRadius: 4,
              }}>
                {u.id.slice(0, 8)}...
              </div>

              {/* ステータスバッジ */}
              <span className={`badge ${u.active ? 'badge-green' : 'badge-yellow'}`}>
                {u.active ? 'active' : 'inactive'}
              </span>

              {/* アクション */}
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="btn btn-sm"
                  onClick={() => onDeactivate(u.id, u.active)}
                  title={u.active ? '無効化（PATCH active=false）' : '有効化（PATCH active=true）'}
                >
                  {u.active ? '無効化' : '有効化'}
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => onDelete(u.id, u.userName)}
                  title="削除（DELETE）"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
