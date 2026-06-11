import { useState } from 'react'
import { OidcApp } from './apps/oidc/OidcApp'
import { RotationApp } from './apps/rotation/RotationApp'
import { ScimApp } from './apps/scim/ScimApp'
import { GuideApp } from './apps/guide/GuideApp'

type AppTab = 'guide' | 'oidc' | 'rotation' | 'scim'

const TABS: { id: AppTab; label: string; desc: string }[] = [
  { id: 'guide', label: '🏠 はじめに', desc: '認証認可とは / 全体像 / 学習ロードマップ / 用語集' },
  { id: 'oidc', label: '① OIDC / JWT', desc: 'JWT直接発行 + Authorization Code Flow（backend: 8000）' },
  { id: 'rotation', label: '② 鍵ローテーション', desc: 'JWKS鍵管理とローテーションシナリオ（backend: 8001）' },
  { id: 'scim', label: '③ SCIM プロビジョニング', desc: 'OKTAによるユーザー自動プロビジョニング（backend: 8002）' },
]

export default function App() {
  const [tab, setTab] = useState<AppTab>('guide')

  return (
    <div>
      {/* 最上部: アプリ切り替えタブ */}
      <nav className="lab-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`lab-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
            title={t.desc}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'guide' && (
        <div className="scope-guide">
          <GuideApp />
        </div>
      )}
      {tab === 'oidc' && (
        <div className="scope-oidc">
          <OidcApp />
        </div>
      )}
      {tab === 'rotation' && (
        <div className="scope-rotation">
          <RotationApp />
        </div>
      )}
      {tab === 'scim' && (
        <div className="scope-scim">
          <ScimApp />
        </div>
      )}
    </div>
  )
}
