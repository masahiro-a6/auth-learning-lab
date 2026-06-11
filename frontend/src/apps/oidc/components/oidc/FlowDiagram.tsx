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

// ─── 各ステップの通信レグ（往復を1本ずつ丁寧に描写）───
interface Leg {
  icon: string
  label: string
  from: Lane
  to: Lane
  color: string
  desc: string // このレグで何が起きているか1行
}

// 各ステップ「到着時」に再生する = 直前のボタンで実際に発生した通信。
// legs が空のステップ（=まだ何も送っていない）は idle チップを所定の位置で待機表示する。
interface StepAnim {
  legs: Leg[]
  idle?: { icon: string; label: string; lane: Lane; color: string; desc: string }
}

const STEP_ANIMS: Record<number, StepAnim> = {
  1: {
    legs: [],
    idle: { icon: '📨', label: '認可リクエスト（待機中）', lane: 'browser', color: '#3b82f6',
      desc: 'まだ何も送信していません。ボタンを押すと、ブラウザから IdP へ認可リクエストが飛びます' },
  },
  2: {
    legs: [
      { icon: '📨', label: '認可リクエスト', from: 'browser', to: 'idp', color: '#3b82f6',
        desc: 'ブラウザが state / nonce 付きの認可リクエストで IdP へリダイレクト' },
      { icon: '🖥️', label: 'ログイン画面', from: 'idp', to: 'browser', color: '#a78bfa',
        desc: 'IdP がログイン画面を返す。次はユーザーを選んで ID/PW を送信（画面は IdP のもの。アプリではない）' },
    ],
  },
  3: {
    legs: [
      { icon: '🔑', label: 'ID / パスワード', from: 'browser', to: 'idp', color: '#a78bfa',
        desc: 'ユーザーが ID/PW を入力して IdP へ送信（パスワードは IdP にしか送られない）' },
      { icon: '🎫', label: '認可コード', from: 'idp', to: 'browser', color: '#f59e0b',
        desc: '認証成功。IdP が60秒だけ有効な認可コードを redirect_uri へ返す' },
    ],
  },
  4: {
    legs: [
      { icon: '🎫', label: 'コード + client_secret', from: 'browser', to: 'idp', color: '#f59e0b',
        desc: 'アプリが認可コードと client_secret を IdP の /auth/token へ送信' },
      { icon: '🪙', label: 'トークン ×3', from: 'idp', to: 'browser', color: '#22c55e',
        desc: 'IdP が access / id / refresh の3トークンを返却（コードは使用済みで無効化）' },
    ],
  },
  5: {
    legs: [
      { icon: '📨', label: 'JWKS リクエスト', from: 'api', to: 'idp', color: '#a78bfa',
        desc: 'API サーバーが IdP の JWKS エンドポイントに公開鍵を取りに行く' },
      { icon: '🔓', label: '公開鍵 (JWKS)', from: 'idp', to: 'api', color: '#a78bfa',
        desc: 'IdP が公開鍵セットを返す。API はこれで署名検証の準備が整う' },
    ],
  },
  6: {
    legs: [
      { icon: '🪙', label: 'JWT (Bearer)', from: 'browser', to: 'api', color: '#22c55e',
        desc: 'Authorization: Bearer ヘッダーに JWT を載せて API を呼ぶ' },
      { icon: '✅', label: 'レスポンス', from: 'api', to: 'browser', color: '#22c55e',
        desc: 'API が署名・有効期限・権限を検証してデータを返す' },
    ],
  },
}

const ACTORS: { lane: Lane; icon: string; name: string; sub: string; color: string }[] = [
  { lane: 'browser', icon: '💻', name: 'ブラウザ (RP)',   sub: 'クライアントアプリ',    color: 'var(--accent)' },
  { lane: 'idp',     icon: '🔐', name: 'IdP (OP)',        sub: 'OKTA（このモック）',    color: 'var(--jwt-sig-color)' },
  { lane: 'api',     icon: '🗄️', name: 'API (RS)',        sub: '/api/* エンドポイント', color: 'var(--warn)' },
]

interface Props {
  currentStep: number
}

const LANE_NAME: Record<Lane, string> = { browser: 'ブラウザ', idp: 'IdP', api: 'API' }

const LEG_DURATION = 1100  // 1レグの移動時間(ms) — chip の transition と同期
const LEG_PAUSE = 500      // レグ間の小休止(ms)

export function FlowDiagram({ currentStep }: Props) {
  const anim = STEP_ANIMS[currentStep] ?? STEP_ANIMS[1]
  const legs = anim.legs
  const isIdle = legs.length === 0
  const [legIndex, setLegIndex] = useState(0)
  const [replayKey, setReplayKey] = useState(0)

  // 表示中のチップ情報（idle なら待機チップ、それ以外は現在のレグ）
  const move: Leg = isIdle
    ? { icon: anim.idle!.icon, label: anim.idle!.label, from: anim.idle!.lane, to: anim.idle!.lane,
        color: anim.idle!.color, desc: anim.idle!.desc }
    : legs[Math.min(legIndex, legs.length - 1)]
  const samePos = move.from === move.to

  // チップ位置: レグ開始時に from へ瞬間移動 → 次フレームで to へアニメーション
  const [chipPos, setChipPos] = useState<number>(POS[move.to])
  const [animating, setAnimating] = useState(false)
  const rafRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([])

  // ステップが変わったら最初のレグから再生
  useEffect(() => {
    setLegIndex(0)
  }, [currentStep])

  // レグごとの再生: from に置く → to へスライド → 完了後つぎのレグへ
  useEffect(() => {
    const stepAnim = STEP_ANIMS[currentStep] ?? STEP_ANIMS[1]

    cancelAnimationFrame(rafRef.current)
    timerRef.current.forEach(clearTimeout)
    timerRef.current = []

    // idle ステップ: 所定の位置に置くだけ（アニメーションなし）
    if (stepAnim.legs.length === 0) {
      setAnimating(false)
      setChipPos(POS[stepAnim.idle!.lane])
      return
    }

    const leg = stepAnim.legs[Math.min(legIndex, stepAnim.legs.length - 1)]
    setAnimating(false)          // transition を切って…
    setChipPos(POS[leg.from])    // 始点へ瞬間移動
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => {
        setAnimating(true)       // transition を有効化して…
        setChipPos(POS[leg.to])  // 終点までスライド
      })
    })

    // 最後のレグでなければ、移動完了+小休止ののち次のレグへ
    if (legIndex < stepAnim.legs.length - 1) {
      timerRef.current.push(setTimeout(() => {
        setLegIndex(i => i + 1)
      }, LEG_DURATION + LEG_PAUSE))
    }

    return () => {
      cancelAnimationFrame(rafRef.current)
      timerRef.current.forEach(clearTimeout)
    }
  }, [currentStep, legIndex, replayKey])

  return (
    <>
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      margin: '0 -4px 12px',
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
        <span style={{ color: move.color, fontWeight: 700, flexShrink: 0 }}>
          STEP {currentStep}
          {legs.length > 1 && (
            <span style={{ marginLeft: 5, fontSize: '0.6rem', opacity: 0.85 }}>
              通信 {Math.min(legIndex, legs.length - 1) + 1}/{legs.length}
            </span>
          )}
        </span>
        <span>{move.desc}</span>
        {!isIdle && <button
          onClick={() => { setLegIndex(0); setReplayKey(k => k + 1) }}
          title="この通信のアニメーションをもう一度再生"
          style={{
            marginLeft: 'auto',
            flexShrink: 0,
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 99,
            color: 'var(--text-muted)',
            fontSize: '0.62rem',
            padding: '1px 8px',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          ↺ 再生
        </button>}
      </div>

      <style>{`
        @keyframes chip-pulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.08); }
        }
      `}</style>
    </div>

    {/* ── 通信タイムライン（読める一覧・クリックで再生）── */}
    {!isIdle && (
      <div style={{
        marginBottom: 20,
        padding: '10px 12px',
        background: 'var(--bg-inner)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-sm)',
      }}>
        <div style={{
          fontSize: '0.68rem',
          fontWeight: 700,
          color: 'var(--text-secondary)',
          marginBottom: 8,
        }}>
          📋 直前の操作で発生した通信
          <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>
            — 行をクリックするとその通信から再生されます
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {legs.map((leg, i) => {
            const active = i === Math.min(legIndex, legs.length - 1)
            const done = i < legIndex
            return (
              <button
                key={i}
                onClick={() => { setLegIndex(i); setReplayKey(k => k + 1) }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  background: active ? `color-mix(in srgb, ${leg.color} 10%, transparent)` : 'transparent',
                  border: `1px solid ${active ? leg.color : 'var(--border)'}`,
                  borderRadius: 'var(--r-sm)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  width: '100%',
                  opacity: done || active ? 1 : 0.6,
                  transition: 'all 0.25s',
                  boxShadow: active ? `0 0 10px color-mix(in srgb, ${leg.color} 25%, transparent)` : 'none',
                }}
              >
                <span style={{
                  width: 18, height: 18, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.6rem', fontWeight: 700,
                  background: active ? leg.color : 'var(--bg-card)',
                  color: active ? '#000' : 'var(--text-muted)',
                  border: active ? 'none' : '1px solid var(--border)',
                  flexShrink: 0,
                }}>
                  {i + 1}
                </span>
                <span style={{ fontSize: '0.85rem', flexShrink: 0 }}>{leg.icon}</span>
                <span style={{
                  fontSize: '0.64rem',
                  fontFamily: "'JetBrains Mono',monospace",
                  color: leg.color,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  minWidth: 110,
                }}>
                  {LANE_NAME[leg.from]} → {LANE_NAME[leg.to]}
                </span>
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}>
                  {leg.label}
                </span>
                <span style={{ fontSize: '0.66rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {leg.desc}
                </span>
                {active && (
                  <span style={{ marginLeft: 'auto', fontSize: '0.62rem', color: leg.color, flexShrink: 0, fontWeight: 700 }}>
                    ▶ 再生中
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    )}
    </>
  )
}
