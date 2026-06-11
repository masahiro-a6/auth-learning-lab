// OIDCフロー可視化ヘッダー（スクロール追従）
// 3アクター間をトークン/コードのチップがステップごとにアニメーション移動する

import { useEffect, useRef, useState } from 'react'

interface Step {
  num: number
  label: string
  actor: 'client' | 'idp' | 'both'
}

const STEPS: Step[] = [
  { num: 1, label: '認可リクエスト',   actor: 'client' },
  { num: 2, label: 'ユーザー認証',     actor: 'idp'    },
  { num: 3, label: 'コード受取',       actor: 'client' },
  { num: 4, label: 'トークン交換',     actor: 'both'   },
  { num: 5, label: 'JWKS 検証の仕組み', actor: 'idp'   },
  { num: 6, label: 'API 呼び出し',     actor: 'client' },
]

const ACTOR_COLOR: Record<Step['actor'], string> = {
  client: 'var(--accent)',
  idp:    'var(--jwt-sig-color)',
  both:   'var(--warn)',
}

// ─── アクターのレーン位置（トラック上の %）───
const POS = { browser: 8, idp: 50, api: 92 } as const
type Lane = keyof typeof POS

// ─── 各ステップでチップ（トークン等）がどう動くか ───
interface ChipMove {
  icon: string
  label: string
  from: Lane
  to: Lane
  color: string
  desc: string // 何が起きているか1行
}

const CHIP_MOVES: Record<number, ChipMove> = {
  1: { icon: '📨', label: '認可リクエスト',  from: 'browser', to: 'idp',     color: '#3b82f6',
       desc: 'ブラウザが state / nonce 付きで IdP へリダイレクト' },
  2: { icon: '🔑', label: 'ID / パスワード', from: 'browser', to: 'idp',     color: '#a78bfa',
       desc: 'ユーザーが IdP のログイン画面に ID/PW を入力して送信（パスワードは IdP にしか送られない）' },
  3: { icon: '🎫', label: '認可コード',      from: 'idp',     to: 'browser', color: '#f59e0b',
       desc: 'IdP が60秒だけ有効な認可コードを発行してブラウザへ返す' },
  4: { icon: '🪙', label: 'トークン ×3',     from: 'idp',     to: 'browser', color: '#22c55e',
       desc: 'コードと引き換えに access / id / refresh トークンを受け取る' },
  5: { icon: '🔓', label: '公開鍵 (JWKS)',   from: 'idp',     to: 'api',     color: '#a78bfa',
       desc: 'API サーバーが IdP の JWKS から公開鍵を取得（署名検証の準備）' },
  6: { icon: '🪙', label: 'JWT (Bearer)',    from: 'browser', to: 'api',     color: '#22c55e',
       desc: 'Authorization: Bearer ヘッダーに JWT を載せて API を呼ぶ' },
}

const ACTORS: { lane: Lane; icon: string; name: string; sub: string; color: string }[] = [
  { lane: 'browser', icon: '💻', name: 'ブラウザ (RP)',   sub: 'クライアントアプリ',    color: 'var(--accent)' },
  { lane: 'idp',     icon: '🔐', name: 'IdP (OP)',        sub: 'OKTA（このモック）',    color: 'var(--jwt-sig-color)' },
  { lane: 'api',     icon: '🗄️', name: 'API (RS)',        sub: '/api/* エンドポイント', color: 'var(--warn)' },
]

interface Props {
  currentStep: number
}

export function FlowDiagram({ currentStep }: Props) {
  const move = CHIP_MOVES[currentStep] ?? CHIP_MOVES[1]
  const samePos = move.from === move.to

  // チップ位置: ステップ変更時に from へ瞬間移動 → 次フレームで to へアニメーション
  const [chipPos, setChipPos] = useState<number>(POS[move.to])
  const [animating, setAnimating] = useState(false)
  const rafRef = useRef(0)

  useEffect(() => {
    const m = CHIP_MOVES[currentStep] ?? CHIP_MOVES[1]
    setAnimating(false)          // transition を切って…
    setChipPos(POS[m.from])      // 始点へ瞬間移動
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => {
        setAnimating(true)       // transition を有効化して…
        setChipPos(POS[m.to])    // 終点までスライド
      })
    })
    return () => cancelAnimationFrame(rafRef.current)
  }, [currentStep])

  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      margin: '0 -4px 20px',
      padding: '10px 12px 12px',
      background: 'rgba(10,15,26,0.92)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--r-md)',
      boxShadow: '0 6px 24px rgba(0,0,0,0.45)',
    }}>
      {/* ── ステップピル（コンパクト）── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflowX: 'auto', paddingBottom: 8, marginBottom: 4 }}>
        {STEPS.map((step, i) => {
          const done   = step.num < currentStep
          const active = step.num === currentStep
          const color  = done || active ? ACTOR_COLOR[step.actor] : 'var(--text-muted)'
          return (
            <div key={step.num} style={{ display: 'flex', alignItems: 'center', flexShrink: 0, gap: 4 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 9px 3px 5px',
                borderRadius: 99,
                border: `1px solid ${active ? color : 'var(--border)'}`,
                background: active ? `color-mix(in srgb, ${color} 18%, transparent)` : 'transparent',
                opacity: step.num > currentStep ? 0.45 : 1,
                transition: 'all 0.25s',
              }}>
                <span style={{
                  width: 17, height: 17, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.62rem', fontWeight: 700,
                  background: active ? color : done ? `color-mix(in srgb, ${color} 25%, transparent)` : 'var(--bg-inner)',
                  color: active ? '#fff' : color,
                  border: active || done ? 'none' : '1px solid var(--border)',
                }}>
                  {done ? '✓' : step.num}
                </span>
                <span style={{
                  fontSize: '0.64rem',
                  fontWeight: active ? 700 : 500,
                  color: active ? color : done ? 'var(--text-secondary)' : 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                }}>
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <span style={{ color: step.num < currentStep ? 'var(--text-secondary)' : 'var(--border)', fontSize: '0.6rem' }}>›</span>
              )}
            </div>
          )
        })}
      </div>

      {/* ── シーケンスレーン ── */}
      <div style={{ position: 'relative', height: 86 }}>
        {/* トラック（横線） */}
        <div style={{
          position: 'absolute',
          left: `${POS.browser}%`,
          right: `${100 - POS.api}%`,
          top: 54,
          height: 2,
          background: 'var(--border)',
          borderRadius: 1,
        }} />

        {/* 現ステップの経路ハイライト */}
        {!samePos && (
          <div style={{
            position: 'absolute',
            left: `${Math.min(POS[move.from], POS[move.to])}%`,
            width: `${Math.abs(POS[move.to] - POS[move.from])}%`,
            top: 53,
            height: 4,
            borderRadius: 2,
            background: `linear-gradient(to ${POS[move.to] > POS[move.from] ? 'right' : 'left'}, transparent, ${move.color})`,
            opacity: 0.55,
            transition: 'all 0.3s',
          }} />
        )}

        {/* アクター3体 */}
        {ACTORS.map(a => {
          const involved = move.from === a.lane || move.to === a.lane
          return (
            <div key={a.lane} style={{
              position: 'absolute',
              left: `${POS[a.lane]}%`,
              top: 30,
              transform: 'translateX(-50%)',
              textAlign: 'center',
              transition: 'opacity 0.3s',
              opacity: involved ? 1 : 0.45,
            }}>
              <div style={{
                width: 46, height: 46, borderRadius: '50%',
                background: 'var(--bg-inner)',
                border: `2px solid ${involved ? a.color : 'var(--border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.15rem',
                margin: '0 auto 3px',
                boxShadow: involved ? `0 0 12px color-mix(in srgb, ${a.color} 35%, transparent)` : 'none',
                transition: 'all 0.3s',
              }}>
                {a.icon}
              </div>
              <div style={{ fontSize: '0.62rem', fontWeight: 700, color: involved ? a.color : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {a.name}
              </div>
              <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {a.sub}
              </div>
            </div>
          )
        })}

        {/* ── 動くチップ（トークン/コード）── */}
        <div style={{
          position: 'absolute',
          left: `${chipPos}%`,
          top: 0,
          transform: 'translateX(-50%)',
          transition: animating ? 'left 1.1s cubic-bezier(0.45, 0, 0.25, 1)' : 'none',
          zIndex: 2,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 10px',
            borderRadius: 99,
            background: `color-mix(in srgb, ${move.color} 16%, #0a0f1a)`,
            border: `1.5px solid ${move.color}`,
            boxShadow: `0 0 14px color-mix(in srgb, ${move.color} 45%, transparent)`,
            whiteSpace: 'nowrap',
            animation: samePos ? 'chip-pulse 1.4s ease-in-out infinite' : undefined,
          }}>
            <span style={{ fontSize: '0.85rem' }}>{move.icon}</span>
            <span style={{
              fontSize: '0.66rem',
              fontWeight: 700,
              color: move.color,
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {move.label}
            </span>
          </div>
          {/* チップからトラックへの点線 */}
          <div style={{
            width: 1.5,
            height: 26,
            margin: '0 auto',
            background: `repeating-linear-gradient(to bottom, ${move.color} 0 3px, transparent 3px 6px)`,
            opacity: 0.7,
          }} />
        </div>
      </div>

      {/* ── 今なにが起きているか1行 ── */}
      <div style={{
        marginTop: 2,
        padding: '5px 10px',
        borderRadius: 'var(--r-sm)',
        background: 'var(--bg-inner)',
        border: '1px solid var(--border)',
        fontSize: '0.68rem',
        color: 'var(--text-secondary)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <span style={{ color: move.color, fontWeight: 700, flexShrink: 0 }}>STEP {currentStep}</span>
        <span>{move.desc}</span>
      </div>

      <style>{`
        @keyframes chip-pulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.08); }
        }
      `}</style>
    </div>
  )
}
