import { useState, useEffect } from 'react'
import type { DecodedJWT } from './types'
import { TokenIssuer } from './components/TokenIssuer'
import { JwtVisualizer } from './components/JwtVisualizer'
import { ApiCaller } from './components/ApiCaller'
import { OidcFlow } from './components/oidc/OidcFlow'
import { PositionBanner } from '../guide/PositionBanner'

function decodeJWT(token: string): DecodedJWT | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const fromBase64Url = (str: string): unknown => {
      const padding = '='.repeat((4 - (str.length % 4)) % 4)
      const base64 = (str + padding).replace(/-/g, '+').replace(/_/g, '/')
      return JSON.parse(atob(base64))
    }
    return {
      header:       fromBase64Url(parts[0]) as DecodedJWT['header'],
      payload:      fromBase64Url(parts[1]) as DecodedJWT['payload'],
      rawHeader:    parts[0],
      rawPayload:   parts[1],
      rawSignature: parts[2],
    }
  } catch {
    return null
  }
}

type Tab = 'direct' | 'oidc'

export function OidcApp() {
  const [tab, setTab] = useState<Tab>('direct')

  // 直接発行モード用 state
  const [token, setToken] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const [decoded, setDecoded] = useState<DecodedJWT | null>(null)

  useEffect(() => {
    if (token) setDecoded(decodeJWT(token))
    else setDecoded(null)
  }, [token])

  const handleTokenIssued = (newToken: string, newExpiresAt: number) => {
    setToken(newToken)
    setExpiresAt(newExpiresAt)
  }

  const TAB_DEFS: { id: Tab; label: string; desc: string }[] = [
    {
      id: 'direct',
      label: '直接発行モード',
      desc: 'JWTの構造・RS256・ABACを学ぶ（既存）',
    },
    {
      id: 'oidc',
      label: 'OIDC フロー',
      desc: 'Authorization Code Flowを6ステップで体験する（新）',
    },
  ]

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-title">
          <h1>JWT + ABAC / OIDC 学習デモ</h1>
          <span className="app-header-tag">Local Mock</span>
        </div>
        <p>
          OktaなどのIdPを模したJWT・OIDC学習用モックアプリ。外部サービス・DBは一切使用していません。
        </p>
      </header>

      <PositionBanner
        color="#3b82f6"
        scope="【ログイン〜API利用】"
        detail="ユーザーがトークンを得て、APIがそれを検証するまで——認証の主役フローです。"
        order="順序ガイド: 最初に学ぶアプリ。ここがすべての土台になります。"
      />

      {/* タブ */}
      <div style={{
        display: 'flex',
        gap: 4,
        marginBottom: 24,
        borderBottom: '1px solid var(--border)',
        paddingBottom: 0,
      }}>
        {TAB_DEFS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background: tab === t.id ? 'var(--accent-dim)' : 'none',
              border: 'none',
              borderBottom: `2px solid ${tab === t.id ? 'var(--accent)' : 'transparent'}`,
              color: tab === t.id ? 'var(--accent)' : 'var(--text-secondary)',
              padding: '10px 18px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: tab === t.id ? 700 : 500,
              fontFamily: 'inherit',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 2,
              marginBottom: -1,
              borderRadius: 'var(--r-sm) var(--r-sm) 0 0',
              transition: 'all 0.15s',
            }}
          >
            <span>{t.label}</span>
            <span style={{
              fontSize: '0.68rem',
              fontWeight: 400,
              color: tab === t.id ? '#93c5fd' : 'var(--text-muted)',
            }}>
              {t.desc}
            </span>
          </button>
        ))}
      </div>

      {/* 直接発行モード（既存） */}
      {tab === 'direct' && (
        <>
          <TokenIssuer onTokenIssued={handleTokenIssued} />
          {decoded && <JwtVisualizer decoded={decoded} expiresAt={expiresAt} />}
          <ApiCaller token={token} expiresAt={expiresAt} />
        </>
      )}

      {/* OIDCフロー（新） */}
      {tab === 'oidc' && <OidcFlow />}
    </div>
  )
}
