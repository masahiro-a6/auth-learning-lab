// OKTA プッシュシミュレーター: SCIM操作をボタンで実行しリクエスト/レスポンスを表示

import { useState } from 'react'
import type { ScimUser } from '../types'

const API = 'http://localhost:8002'

interface Props {
  users: ScimUser[]
  onRefresh: () => void
}

type Tab = 'create' | 'update' | 'deactivate' | 'delete'

const METHOD_COLOR: Record<string, string> = {
  GET: 'var(--success)',
  POST: 'var(--accent)',
  PUT: 'var(--warn)',
  PATCH: 'var(--purple)',
  DELETE: 'var(--danger)',
}

export function OktaSimulator({ users, onRefresh }: Props) {
  const [tab, setTab] = useState<Tab>('create')
  const [result, setResult] = useState<{ method: string; path: string; req: Record<string, unknown> | null; res: Record<string, unknown>; status: number } | null>(null)
  const [loading, setLoading] = useState(false)

  // フォーム状態
  const [form, setForm] = useState({
    userName: 'taro.yamada@example.com',
    familyName: '山田',
    givenName: '太郎',
    displayName: '山田 太郎',
    email: 'taro.yamada@example.com',
    title: '営業部長',
    department: '営業部',
  })
  const [selectedUserId, setSelectedUserId] = useState('')
  const [updateTitle, setUpdateTitle] = useState('')
  const [updateDept, setUpdateDept] = useState('')

  const setF = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const exec = async (method: string, path: string, body?: unknown) => {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch(`${API}${path}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
      })
      const data: Record<string, unknown> = method === 'DELETE' ? ({} as Record<string, unknown>) : await res.json()
      setResult({ method, path, req: (body ?? null) as Record<string, unknown> | null, res: data, status: res.status })
      onRefresh()
    } catch (e) {
      setResult({ method, path, req: (body ?? null) as Record<string, unknown> | null, res: { error: String(e) }, status: 0 })
    } finally {
      setLoading(false)
    }
  }

  // ── 操作ごとの実行関数 ──────────────────────────────────────────────

  const doCreate = () => exec('POST', '/scim/v2/Users', {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
    userName: form.userName,
    name: { familyName: form.familyName, givenName: form.givenName },
    emails: [{ value: form.email, primary: true }],
    displayName: form.displayName,
    active: true,
    title: form.title,
    department: form.department,
  })

  const doUpdate = () => {
    const u = users.find(u => u.id === selectedUserId)
    if (!u) return
    exec('PUT', `/scim/v2/Users/${selectedUserId}`, {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      userName: u.userName,
      name: u.name,
      emails: u.emails,
      displayName: u.displayName,
      active: u.active,
      title: updateTitle || u.title,
      department: updateDept || u.department,
    })
  }

  const doDeactivate = () => {
    if (!selectedUserId) return
    const u = users.find(u => u.id === selectedUserId)
    const nextActive = !u?.active
    exec('PATCH', `/scim/v2/Users/${selectedUserId}`, {
      schemas: ['urn:ietf:params:scim:schemas:api:messages:2.0:PatchOp'],
      Operations: [{ op: 'replace', path: 'active', value: nextActive }],
    })
  }

  const doDelete = () => {
    if (!selectedUserId) return
    if (!confirm('削除しますか？（デプロビジョニング）')) return
    exec('DELETE', `/scim/v2/Users/${selectedUserId}`)
  }

  // ── タブ定義 ───────────────────────────────────────────────────────

  const TABS: { id: Tab; label: string; method: string; desc: string }[] = [
    { id: 'create',     label: 'プロビジョニング',     method: 'POST',   desc: '入社・アカウント作成' },
    { id: 'update',     label: '属性更新',             method: 'PUT',    desc: '異動・役職変更' },
    { id: 'deactivate', label: '有効化 / 無効化',      method: 'PATCH',  desc: '休職・一時停止' },
    { id: 'delete',     label: 'デプロビジョニング',   method: 'DELETE', desc: '退社・削除' },
  ]

  const selectedUser = users.find(u => u.id === selectedUserId)

  return (
    <div className="card">
      <div className="card-head">
        <span className="badge badge-blue">OKTA PUSH</span>
        <h2>プッシュシミュレーター</h2>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 4 }}>
          OKTA が行う SCIM リクエストを手動で再現
        </span>
      </div>

      {/* タブ */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            className="btn btn-sm"
            style={{
              background: tab === t.id ? 'var(--bg-inner)' : 'transparent',
              border: tab === t.id ? `1px solid ${METHOD_COLOR[t.method]}55` : '1px solid var(--border)',
              color: tab === t.id ? METHOD_COLOR[t.method] : 'var(--text-muted)',
              fontWeight: tab === t.id ? 700 : 400,
            }}
            onClick={() => { setTab(t.id); setResult(null) }}
          >
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '0.65rem', marginRight: 4 }}>
              {t.method}
            </span>
            {t.label}
          </button>
        ))}
      </div>

      {/* フォーム + 実行ボタン */}
      <div style={{ marginBottom: 14 }}>
        {tab === 'create' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 4 }}>
              OKTA のユーザーストア（Active Directory・HRなど）に新しいアカウントが作られると、
              OKTA が自動でこの SCIM POST を対象サービスに送信します。
            </p>
            <div className="grid-2">
              <div><label>userName（メールアドレス形式が一般的）</label>
                <input value={form.userName} onChange={setF('userName')} /></div>
              <div><label>email</label>
                <input value={form.email} onChange={setF('email')} /></div>
              <div><label>familyName（姓）</label>
                <input value={form.familyName} onChange={setF('familyName')} /></div>
              <div><label>givenName（名）</label>
                <input value={form.givenName} onChange={setF('givenName')} /></div>
              <div><label>displayName</label>
                <input value={form.displayName} onChange={setF('displayName')} /></div>
              <div><label>title（役職）</label>
                <input value={form.title} onChange={setF('title')} /></div>
              <div><label>department（部署）</label>
                <input value={form.department} onChange={setF('department')} /></div>
            </div>
            <button className="btn btn-primary" onClick={doCreate} disabled={loading}>
              {loading ? '送信中...' : 'POST /scim/v2/Users を実行'}
            </button>
          </div>
        )}

        {(tab === 'update' || tab === 'deactivate' || tab === 'delete') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              {tab === 'update' && '異動・役職変更時に OKTA が PUT でユーザー情報を全置換します。変更したい項目を入力してください（空欄は現在値を維持）。'}
              {tab === 'deactivate' && '休職・一時アクセス停止時に OKTA が PATCH で active フラグを変更します。アカウントは残りますが認証できなくなります。'}
              {tab === 'delete' && '退社時に OKTA が DELETE を送信します。アカウントそのものが削除されます（無効化との違いに注目）。'}
            </p>

            <div>
              <label>操作対象ユーザーを選択</label>
              <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}>
                <option value="">-- 選択してください --</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.displayName} ({u.userName}) — {u.active ? 'active' : 'inactive'}
                  </option>
                ))}
              </select>
            </div>

            {tab === 'update' && selectedUser && (
              <div className="grid-2">
                <div>
                  <label>title（現在: {selectedUser.title || '未設定'}）</label>
                  <input value={updateTitle} onChange={e => setUpdateTitle(e.target.value)}
                    placeholder={selectedUser.title || '変更後の役職'} />
                </div>
                <div>
                  <label>department（現在: {selectedUser.department || '未設定'}）</label>
                  <input value={updateDept} onChange={e => setUpdateDept(e.target.value)}
                    placeholder={selectedUser.department || '変更後の部署'} />
                </div>
              </div>
            )}

            {tab === 'deactivate' && selectedUser && (
              <div style={{
                padding: '8px 12px',
                background: selectedUser.active ? 'var(--warn-dim)' : 'var(--success-dim)',
                border: `1px solid ${selectedUser.active ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.3)'}`,
                borderRadius: 'var(--r-sm)',
                fontSize: '0.78rem',
                color: selectedUser.active ? 'var(--warn)' : 'var(--success)',
              }}>
                → {selectedUser.active
                  ? `${selectedUser.displayName} を無効化します（active: true → false）`
                  : `${selectedUser.displayName} を有効化します（active: false → true）`}
              </div>
            )}

            <button
              className={`btn ${tab === 'delete' ? 'btn-danger' : 'btn-primary'}`}
              onClick={tab === 'update' ? doUpdate : tab === 'deactivate' ? doDeactivate : doDelete}
              disabled={loading || !selectedUserId}
            >
              {loading ? '送信中...' : {
                update: 'PUT /scim/v2/Users/{id} を実行',
                deactivate: 'PATCH /scim/v2/Users/{id} を実行',
                delete: 'DELETE /scim/v2/Users/{id} を実行',
              }[tab]}
            </button>
          </div>
        )}
      </div>

      {/* リクエスト / レスポンス表示 */}
      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* ステータス行 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            background: result.status >= 200 && result.status < 300 ? 'var(--success-dim)' : 'var(--danger-dim)',
            border: `1px solid ${result.status >= 200 && result.status < 300 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
            borderRadius: 'var(--r-sm)',
            fontSize: '0.8rem',
          }}>
            <span style={{
              fontFamily: "'JetBrains Mono',monospace",
              fontWeight: 700,
              color: METHOD_COLOR[result.method] ?? 'var(--text-primary)',
            }}>
              {result.method}
            </span>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
              {result.path}
            </span>
            <span style={{
              marginLeft: 'auto',
              fontWeight: 700,
              color: result.status >= 200 && result.status < 300 ? 'var(--success)' : 'var(--danger)',
              fontFamily: "'JetBrains Mono',monospace",
            }}>
              {result.status || 'ERR'}
            </span>
          </div>

          <div className="grid-2">
            {/* リクエストボディ */}
            {result.req && (
              <div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 4 }}>Request Body</div>
                <pre style={{
                  margin: 0,
                  padding: '8px 10px',
                  background: 'var(--bg-inner)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-sm)',
                  fontSize: '0.65rem',
                  color: 'var(--accent)',
                  fontFamily: "'JetBrains Mono',monospace",
                  overflow: 'auto',
                  maxHeight: 220,
                  lineHeight: 1.5,
                }}>
                  {JSON.stringify(result.req, null, 2)}
                </pre>
              </div>
            )}

            {/* レスポンスボディ */}
            <div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 4 }}>Response Body</div>
              <pre style={{
                margin: 0,
                padding: '8px 10px',
                background: 'var(--bg-inner)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-sm)',
                fontSize: '0.65rem',
                color: 'var(--success)',
                fontFamily: "'JetBrains Mono',monospace",
                overflow: 'auto',
                maxHeight: 220,
                lineHeight: 1.5,
              }}>
                {Object.keys(result.res as object).length === 0
                  ? '（レスポンスボディなし — 204 No Content）'
                  : JSON.stringify(result.res, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
