import { useState } from 'react'
import type { TokenRequest, TokenResponse } from '../types'

interface Props {
  onTokenIssued: (token: string, expiresAt: number) => void
}

const ROLE_OPTIONS = ['営業Mgr', '営業Member', '人事', 'エンジニア', 'ゲスト']
const TIER_OPTIONS = ['Tier1', 'Tier2', 'Tier3', 'Tier4', 'Tier5', 'Tier6']
const EXPIRY_OPTIONS = [
  { label: '30秒（すぐ期限切れ体験用）', value: 30 },
  { label: '5分', value: 300 },
  { label: '1時間', value: 3600 },
  { label: '24時間', value: 86400 },
]

export function TokenIssuer({ onTokenIssued }: Props) {
  const [form, setForm] = useState<TokenRequest>({
    sub: 'user-001',
    user_role: '営業Member',
    user_team: '東京営業チーム',
    rag_access: 'Tier2',
    cost_budget: 100_000,
    expires_in: 3600,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rawToken, setRawToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleChange = (key: keyof TokenRequest, value: string | number) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/idp/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: TokenResponse = await res.json()
      setRawToken(data.access_token)
      onTokenIssued(data.access_token, data.expires_at)
    } catch (e) {
      setError(e instanceof Error ? e.message : '発行に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    if (!rawToken) return
    navigator.clipboard.writeText(rawToken)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="step-card">
      <div className="step-head">
        <span className="step-badge">STEP 1</span>
        <h2>JWTを発行する（IdPモック）</h2>
        <p>ユーザー属性を指定してRS256署名付きJWTを発行します</p>
      </div>

      <div className="form-grid">
        {/* sub */}
        <div className="form-group">
          <label className="form-label">
            ユーザーID <span className="claim-tag">sub</span>
          </label>
          <input
            className="form-input"
            value={form.sub}
            onChange={e => handleChange('sub', e.target.value)}
            placeholder="user-001"
          />
        </div>

        {/* user.role */}
        <div className="form-group">
          <label className="form-label">
            ロール <span className="claim-tag">user.role</span>
          </label>
          <select
            className="form-select"
            value={form.user_role}
            onChange={e => handleChange('user_role', e.target.value)}
          >
            {ROLE_OPTIONS.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {/* user.team */}
        <div className="form-group">
          <label className="form-label">
            チーム <span className="claim-tag">user.team</span>
          </label>
          <input
            className="form-input"
            value={form.user_team}
            onChange={e => handleChange('user_team', e.target.value)}
            placeholder="東京営業チーム"
          />
        </div>

        {/* rag.access */}
        <div className="form-group">
          <label className="form-label">
            RAGアクセス <span className="claim-tag">rag.access</span>
          </label>
          <select
            className="form-select"
            value={form.rag_access}
            onChange={e => handleChange('rag_access', e.target.value)}
          >
            {TIER_OPTIONS.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* cost.budget */}
        <div className="form-group">
          <label className="form-label">
            予算（円） <span className="claim-tag">cost.budget</span>
          </label>
          <input
            className="form-input"
            type="number"
            value={form.cost_budget}
            onChange={e => handleChange('cost_budget', Number(e.target.value))}
            min={0}
            step={10000}
          />
        </div>

        {/* expires_in */}
        <div className="form-group">
          <label className="form-label">
            有効期限 <span className="claim-tag">exp</span>
          </label>
          <select
            className="form-select"
            value={form.expires_in}
            onChange={e => handleChange('expires_in', Number(e.target.value))}
          >
            {EXPIRY_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
        {loading ? '⏳ 発行中...' : '📨 IdP へ発行リクエスト → 🪙 JWT を受け取る'}
      </button>

      {error && (
        <div className="warn-box" style={{ marginTop: 12 }}>⚠️ {error}</div>
      )}

      {rawToken && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
            ✅ 発行済みJWT（Raw）— Authorization: Bearer <strong style={{ color: 'var(--text-primary)' }}>{'<このトークン>'}</strong>
          </div>
          <div className="jwt-raw" style={{ position: 'relative' }}>
            <button className="copy-btn" onClick={handleCopy}>
              {copied ? '✓ コピー済み' : 'コピー'}
            </button>
            {rawToken}
          </div>
        </div>
      )}
    </div>
  )
}
