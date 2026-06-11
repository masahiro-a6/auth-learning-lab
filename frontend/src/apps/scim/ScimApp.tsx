import { useCallback, useEffect, useState } from 'react'
import type { ScimUser, ScimEvent } from './types'
import { ConceptPanel } from './components/ConceptPanel'
import { OktaSimulator } from './components/OktaSimulator'
import { UserList } from './components/UserList'
import { EventLog } from './components/EventLog'
import { PositionBanner } from '../guide/PositionBanner'

const API = 'http://localhost:8002'

export function ScimApp() {
  const [users, setUsers] = useState<ScimUser[]>([])
  const [events, setEvents] = useState<ScimEvent[]>([])
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [uRes, eRes] = await Promise.all([
        fetch(`${API}/admin/users`),
        fetch(`${API}/admin/events`),
      ])
      const uData = await uRes.json()
      const eData = await eRes.json()
      setUsers(uData.users ?? [])
      setEvents(eData.events ?? [])
      setError(null)
    } catch (e) {
      setError(`バックエンドに接続できません: ${e}\nhttp://localhost:8002 が起動しているか確認してください`)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    const id = setInterval(fetchAll, 3000)
    return () => clearInterval(id)
  }, [fetchAll])

  const handleDeactivate = async (id: string, currentActive: boolean) => {
    await fetch(`${API}/scim/v2/Users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schemas: ['urn:ietf:params:scim:schemas:api:messages:2.0:PatchOp'],
        Operations: [{ op: 'replace', path: 'active', value: !currentActive }],
      }),
    })
    fetchAll()
  }

  const handleDelete = async (id: string, userName: string) => {
    if (!confirm(`${userName} を削除しますか？`)) return
    await fetch(`${API}/scim/v2/Users/${id}`, { method: 'DELETE' })
    fetchAll()
  }

  const handleReset = async () => {
    if (!confirm('全ユーザーと履歴をリセットしますか？')) return
    await fetch(`${API}/admin/reset`, { method: 'DELETE' })
    fetchAll()
  }

  return (
    <div className="app-root">
      {/* ヘッダー */}
      <div className="app-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h1>👤 SCIM Provisioning Lab</h1>
            <p>OKTA が行うユーザー自動プロビジョニングの全ライフサイクルを体験</p>
          </div>
          <button className="btn btn-sm" onClick={handleReset} style={{ marginTop: 4 }}>
            全リセット
          </button>
        </div>
      </div>

      <PositionBanner
        color="#c084fc"
        scope="【ログイン以前のアカウント管理】"
        detail="入社・異動・退社とアカウントの同期——そもそもアカウントはいつ誰が作るのか、という話です。"
        order="前提: ①②を先に学んでおくと、認証(OIDC)とID管理(SCIM)の役割分担が見えます。"
      />

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

      {/* 概念説明 */}
      <ConceptPanel />

      {/* OKTA シミュレーター */}
      <OktaSimulator users={users} onRefresh={fetchAll} />

      {/* ユーザー一覧 */}
      <UserList users={users} onDeactivate={handleDeactivate} onDelete={handleDelete} />

      {/* 操作ログ */}
      <EventLog events={events} />

      {/* フッター */}
      <div style={{
        marginTop: 32,
        textAlign: 'center',
        fontSize: '0.68rem',
        color: 'var(--text-muted)',
      }}>
        Backend: http://localhost:8002 &nbsp;·&nbsp;
        <a href="http://localhost:8002/scim/v2/Users" target="_blank" rel="noreferrer"
          style={{ color: 'var(--accent)', textDecoration: 'none' }}>
          /scim/v2/Users
        </a>
        &nbsp;·&nbsp;
        <a href="http://localhost:8002/scim/v2/ServiceProviderConfig" target="_blank" rel="noreferrer"
          style={{ color: 'var(--accent)', textDecoration: 'none' }}>
          ServiceProviderConfig
        </a>
      </div>
    </div>
  )
}
