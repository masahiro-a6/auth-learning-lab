import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { KeyEntry, IssuedToken, VerifyResult } from '../types'

// ═══ 動くチップ付きスティッキーヘッダー（OIDCフローと同方式） ═══
const POS = { browser: 8, idp: 50, api: 92 } as const
type Lane = keyof typeof POS

interface Leg {
  icon: string
  label: string
  from: Lane
  to: Lane
  color: string
  desc: string
}

interface StageAnim {
  legs: Leg[]
  idle?: { icon: string; label: string; lane: Lane; color: string; desc: string }
}

// stage = 完了済みの最終 STEP 番号（0 = まだ何も実行していない）
const STAGE_ANIMS: Record<number, StageAnim> = {
  0: {
    legs: [],
    idle: { icon: '🪙', label: 'JWT（未発行）', lane: 'browser', color: '#3b82f6',
      desc: 'まだ何も実行していません。STEP 1 を実行すると JWT 発行 → 検証の通信が再生されます' },
  },
  1: {
    legs: [
      { icon: '📨', label: '発行リクエスト', from: 'browser', to: 'idp', color: '#3b82f6',
        desc: 'クライアントが IdP に JWT の発行を依頼' },
      { icon: '🪙', label: 'JWT（旧鍵で署名）', from: 'idp', to: 'browser', color: '#22c55e',
        desc: 'IdP が active な鍵の秘密鍵で署名した JWT を返す' },
      { icon: '🪙', label: 'JWT を提示', from: 'browser', to: 'api', color: '#22c55e',
        desc: 'クライアントが JWT を API へ送信' },
      { icon: '🔓', label: 'JWKS 照会', from: 'api', to: 'idp', color: '#a78bfa',
        desc: 'API が JWT ヘッダーの kid に対応する公開鍵を JWKS から取得' },
      { icon: '✅', label: '検証成功', from: 'api', to: 'browser', color: '#22c55e',
        desc: 'kid が JWKS にあるので署名検証 OK。データを返す' },
    ],
  },
  2: {
    legs: [
      { icon: '🗝️', label: '新しい鍵を追加', from: 'idp', to: 'idp', color: '#a78bfa',
        desc: 'IdP が新しい鍵ペアを生成して JWKS に公開（新旧2本とも active）' },
      { icon: '🪙', label: '旧 JWT + 新 JWT', from: 'browser', to: 'api', color: '#22c55e',
        desc: '旧鍵の JWT と新鍵の JWT を両方 API へ送信' },
      { icon: '🔓', label: 'JWKS 照会', from: 'api', to: 'idp', color: '#a78bfa',
        desc: 'JWKS には新旧両方の kid が公開されている' },
      { icon: '✅', label: '両方とも検証成功', from: 'api', to: 'browser', color: '#22c55e',
        desc: '移行ウィンドウ中はどちらの JWT も有効（これがオーバーラップ期間）' },
    ],
  },
  3: {
    legs: [
      { icon: '🗑️', label: '旧鍵を退役', from: 'idp', to: 'idp', color: '#f59e0b',
        desc: 'IdP が旧鍵を JWKS から除外（ローテーション完了）' },
      { icon: '🪙', label: '旧鍵の JWT', from: 'browser', to: 'api', color: '#f59e0b',
        desc: '退役した鍵で署名された JWT を API へ送信してみる' },
      { icon: '🔓', label: 'JWKS 照会', from: 'api', to: 'idp', color: '#a78bfa',
        desc: 'JWKS を見ても旧 kid はもう存在しない' },
      { icon: '❌', label: 'kid_retired', from: 'api', to: 'browser', color: '#ef4444',
        desc: '検証失敗。ユーザーは再ログインして新鍵の JWT を取得する必要がある' },
    ],
  },
  4: {
    legs: [
      { icon: '🚨', label: '鍵を失効 (revoke)', from: 'idp', to: 'idp', color: '#ef4444',
        desc: '秘密鍵の漏洩を想定。IdP が新鍵を即時失効させる' },
      { icon: '🪙', label: '失効鍵の JWT', from: 'browser', to: 'api', color: '#ef4444',
        desc: '失効した鍵で署名された JWT を API へ送信してみる' },
      { icon: '❌', label: 'key_revoked', from: 'api', to: 'browser', color: '#ef4444',
        desc: '有効期限内でも即座に無効。その鍵の全 JWT が使えなくなる（全員強制ログアウト相当）' },
    ],
  },
}

const ACTORS: { lane: Lane; icon: string; name: string; sub: string; color: string }[] = [
  { lane: 'browser', icon: '🧑‍💻', name: 'クライアント', sub: 'JWT を持つ側',           color: 'var(--accent)' },
  { lane: 'idp',     icon: '🔐', name: 'IdP',           sub: '鍵を管理・JWKS を公開',   color: '#a78bfa' },
  { lane: 'api',     icon: '🗄️', name: 'API (RS)',      sub: '公開鍵で署名を検証',      color: 'var(--warn)' },
]

const LEG_DURATION = 1100
const LEG_PAUSE = 500

// ─── 通信タイムライン: 現在のSTEPの全通信を一覧表示（読める・クリックで再生）───
const LANE_NAME: Record<Lane, string> = { browser: 'クライアント', idp: 'IdP', api: 'API' }

function CommTimeline({ stage, activeLeg, onSelect }: {
  stage: number
  activeLeg: number
  onSelect: (i: number) => void
}) {
  const anim = STAGE_ANIMS[stage] ?? STAGE_ANIMS[0]
  if (anim.legs.length === 0) return null

  return (
    <div style={{
      marginBottom: 16,
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
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        📋 STEP {stage} で発生した通信の流れ
        <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>
          — 行をクリックするとその通信から再生されます
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {anim.legs.map((leg, i) => {
          const active = i === activeLeg
          const done = i < activeLeg
          return (
            <button
              key={i}
              onClick={() => onSelect(i)}
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
              {/* 通信番号 */}
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

              {/* アイコン */}
              <span style={{ fontSize: '0.85rem', flexShrink: 0 }}>{leg.icon}</span>

              {/* 経路: from → to */}
              <span style={{
                fontSize: '0.64rem',
                fontFamily: "'JetBrains Mono',monospace",
                color: leg.color,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                minWidth: 132,
              }}>
                {leg.from === leg.to
                  ? `${LANE_NAME[leg.from]} 内部`
                  : `${LANE_NAME[leg.from]} → ${LANE_NAME[leg.to]}`}
              </span>

              {/* ラベル */}
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}>
                {leg.label}
              </span>

              {/* 説明 */}
              <span style={{
                fontSize: '0.66rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}>
                {leg.desc}
              </span>

              {/* 再生中マーク */}
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
  )
}

interface FlowHeaderProps {
  stage: number
  jump?: { i: number; k: number }       // タイムライン行クリックでこのレグへジャンプ
  onLegChange?: (i: number) => void     // 再生中のレグを親に通知
}

function RotationFlowHeader({ stage, jump, onLegChange }: FlowHeaderProps) {
  const anim = STAGE_ANIMS[stage] ?? STAGE_ANIMS[0]
  const legs = anim.legs
  const isIdle = legs.length === 0
  const [legIndex, setLegIndex] = useState(0)
  const [replayKey, setReplayKey] = useState(0)
  const [showTimeline, setShowTimeline] = useState(true)

  // タイムライン行クリック → 指定レグから再生
  useEffect(() => {
    if (jump) {
      setLegIndex(jump.i)
      setReplayKey(k => k + 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jump?.k])

  // 再生中レグを親へ通知
  useEffect(() => {
    onLegChange?.(legIndex)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legIndex, stage])

  const move: Leg = isIdle
    ? { icon: anim.idle!.icon, label: anim.idle!.label, from: anim.idle!.lane, to: anim.idle!.lane,
        color: anim.idle!.color, desc: anim.idle!.desc }
    : legs[Math.min(legIndex, legs.length - 1)]
  const samePos = move.from === move.to

  const [chipPos, setChipPos] = useState<number>(POS[move.to])
  const [animating, setAnimating] = useState(false)
  const rafRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => { setLegIndex(0) }, [stage])

  useEffect(() => {
    const a = STAGE_ANIMS[stage] ?? STAGE_ANIMS[0]
    cancelAnimationFrame(rafRef.current)
    timerRef.current.forEach(clearTimeout)
    timerRef.current = []

    if (a.legs.length === 0) {
      setAnimating(false)
      setChipPos(POS[a.idle!.lane])
      return
    }

    const leg = a.legs[Math.min(legIndex, a.legs.length - 1)]
    setAnimating(false)
    setChipPos(POS[leg.from])
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => {
        setAnimating(true)
        setChipPos(POS[leg.to])
      })
    })

    if (legIndex < a.legs.length - 1) {
      timerRef.current.push(setTimeout(() => setLegIndex(i => i + 1), LEG_DURATION + LEG_PAUSE))
    }
    return () => {
      cancelAnimationFrame(rafRef.current)
      timerRef.current.forEach(clearTimeout)
    }
  }, [stage, legIndex, replayKey])

  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      margin: '0 0 16px',
      padding: '10px 12px 12px',
      background: 'rgba(10,15,26,0.92)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--r-md)',
      boxShadow: '0 6px 24px rgba(0,0,0,0.45)',
    }}>
      {/* シーケンスレーン */}
      <div style={{ position: 'relative', height: 86 }}>
        <div style={{
          position: 'absolute',
          left: `${POS.browser}%`,
          right: `${100 - POS.api}%`,
          top: 54,
          height: 2,
          background: 'var(--border)',
          borderRadius: 1,
        }} />

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

        {/* 動くチップ */}
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
            animation: samePos ? 'rot-chip-pulse 1.4s ease-in-out infinite' : undefined,
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
          <div style={{
            width: 1.5,
            height: 26,
            margin: '0 auto',
            background: `repeating-linear-gradient(to bottom, ${move.color} 0 3px, transparent 3px 6px)`,
            opacity: 0.7,
          }} />
        </div>
      </div>

      {/* 説明行 */}
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
          {stage === 0 ? '開始前' : `STEP ${stage} 実行結果`}
          {legs.length > 1 && (
            <span style={{ marginLeft: 5, fontSize: '0.6rem', opacity: 0.85 }}>
              通信 {Math.min(legIndex, legs.length - 1) + 1}/{legs.length}
            </span>
          )}
        </span>
        <span>{move.desc}</span>
        {!isIdle && (
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 5, flexShrink: 0 }}>
            <button
              onClick={() => { setLegIndex(0); setReplayKey(k => k + 1) }}
              title="この通信のアニメーションをもう一度再生"
              style={{
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
            </button>
            <button
              onClick={() => setShowTimeline(s => !s)}
              title="通信一覧の表示/非表示"
              style={{
                background: showTimeline ? 'var(--bg-inner)' : 'none',
                border: '1px solid var(--border)',
                borderRadius: 99,
                color: showTimeline ? 'var(--text-secondary)' : 'var(--text-muted)',
                fontSize: '0.62rem',
                padding: '1px 8px',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              📋 一覧 {showTimeline ? '▲' : '▼'}
            </button>
          </span>
        )}
      </div>

      {/* 通信タイムライン（ヘッダー内 = スクロールしても見える） */}
      {!isIdle && showTimeline && (
        <div style={{ marginTop: 8 }}>
          <CommTimeline
            stage={stage}
            activeLeg={Math.min(legIndex, legs.length - 1)}
            onSelect={i => { setLegIndex(i); setReplayKey(k => k + 1) }}
          />
        </div>
      )}

      <style>{`
        @keyframes rot-chip-pulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.08); }
        }
      `}</style>
    </div>
  )
}

const API = 'http://localhost:8001'

interface StepResult {
  label: string
  ok: boolean
  detail: string
  verify?: VerifyResult
}

interface ScenarioState {
  baseKid: string
  newKid?: string
  token1?: IssuedToken
  token2?: IssuedToken
}

interface Props {
  keys: KeyEntry[]
  onRefresh: () => void
  jwksPanel?: ReactNode  // 概念説明とステップの間に差し込む鍵管理パネル
}

// ─── 認証フロー図（SVG）: JWT署名 → JWKS検証 → 成功/失敗の分岐 ───
function RotationFlowDiagram() {
  const TXT = '#e2e8f0'
  const SUB = '#94a3b8'
  const BOX_BG = '#0e1520'
  const BOX_BD = 'rgba(255,255,255,0.14)'
  const BLUE = '#3b82f6'
  const GREEN = '#22c55e'
  const RED = '#ef4444'
  const PURPLE = '#a78bfa'

  const BY = 56
  const BH = 72
  const MID = BY + BH / 2
  const boxes = [
    { x: 16,  w: 170, icon: '🧑‍💻', label: 'ユーザー',     sub: 'ログインする本人',        accent: SUB },
    { x: 256, w: 190, icon: '🔐', label: 'IdP (OKTA)',  sub: '秘密鍵で JWT に署名・発行', accent: PURPLE },
    { x: 516, w: 190, icon: '🗄️', label: 'API サーバー', sub: 'JWKS の公開鍵で検証',      accent: BLUE },
  ]

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--r-sm)',
      padding: '10px 12px',
    }}>
      <svg viewBox="0 0 960 200" style={{ width: '100%', height: 'auto', display: 'block' }}>
        <defs>
          <marker id="rf-blue" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M 0 1 L 9 5 L 0 9 z" fill={BLUE} />
          </marker>
          <marker id="rf-green" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M 0 1 L 9 5 L 0 9 z" fill={GREEN} />
          </marker>
          <marker id="rf-red" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M 0 1 L 9 5 L 0 9 z" fill={RED} />
          </marker>
        </defs>

        {/* ── 矢印: ユーザー → IdP（ログイン）── */}
        <line x1={boxes[0].x + boxes[0].w} y1={MID} x2={boxes[1].x} y2={MID}
          stroke={BLUE} strokeWidth={2} markerEnd="url(#rf-blue)" opacity={0.9} />
        <rect x={(boxes[0].x + boxes[0].w + boxes[1].x) / 2 - 36} y={MID - 26} width={72} height={18} rx={9}
          fill="#0a0f1a" stroke={BLUE} strokeWidth={1} />
        <text x={(boxes[0].x + boxes[0].w + boxes[1].x) / 2} y={MID - 13} textAnchor="middle"
          fill={BLUE} fontSize={11} fontWeight={700}>ログイン</text>

        {/* ── 矢印: IdP → API（JWT送信）── */}
        <line x1={boxes[1].x + boxes[1].w} y1={MID} x2={boxes[2].x} y2={MID}
          stroke={PURPLE} strokeWidth={2} markerEnd="url(#rf-blue)" opacity={0.9} />
        <rect x={(boxes[1].x + boxes[1].w + boxes[2].x) / 2 - 48} y={MID - 26} width={96} height={18} rx={9}
          fill="#0a0f1a" stroke={PURPLE} strokeWidth={1} />
        <text x={(boxes[1].x + boxes[1].w + boxes[2].x) / 2} y={MID - 13} textAnchor="middle"
          fill={PURPLE} fontSize={11} fontWeight={700} fontFamily="'JetBrains Mono',monospace">JWT を送信</text>

        {/* ── 3ボックス ── */}
        {boxes.map(b => (
          <g key={b.label}>
            <rect x={b.x} y={BY} width={b.w} height={BH} rx={12} fill={BOX_BG} stroke={BOX_BD} />
            <rect x={b.x} y={BY} width={b.w} height={4} rx={2} fill={b.accent} opacity={0.85} />
            <text x={b.x + b.w / 2} y={BY + 28} textAnchor="middle" fontSize={17}>{b.icon}</text>
            <text x={b.x + b.w / 2} y={BY + 48} textAnchor="middle" fill={TXT} fontSize={13} fontWeight={700}>{b.label}</text>
            <text x={b.x + b.w / 2} y={BY + 63} textAnchor="middle" fill={SUB} fontSize={10}>{b.sub}</text>
          </g>
        ))}

        {/* ── 検証の分岐: API → 成功 / 失敗 ── */}
        <line x1={boxes[2].x + boxes[2].w} y1={MID - 12} x2={770} y2={BY + 10}
          stroke={GREEN} strokeWidth={1.8} markerEnd="url(#rf-green)" opacity={0.85} />
        <line x1={boxes[2].x + boxes[2].w} y1={MID + 12} x2={770} y2={BY + BH + 12}
          stroke={RED} strokeWidth={1.8} markerEnd="url(#rf-red)" opacity={0.85} />

        {/* 成功側 */}
        <rect x={774} y={BY - 14} width={172} height={46} rx={10}
          fill="rgba(34,197,94,0.08)" stroke="rgba(34,197,94,0.4)" />
        <text x={860} y={BY + 4} textAnchor="middle" fill={GREEN} fontSize={11.5} fontWeight={700}>
          ✅ kid が JWKS にある
        </text>
        <text x={860} y={BY + 22} textAnchor="middle" fill={SUB} fontSize={10}>
          検証成功 → データを返す
        </text>

        {/* 失敗側 */}
        <rect x={774} y={BY + BH - 10} width={172} height={46} rx={10}
          fill="rgba(239,68,68,0.08)" stroke="rgba(239,68,68,0.4)" />
        <text x={860} y={BY + BH + 8} textAnchor="middle" fill={RED} fontSize={11.5} fontWeight={700}>
          ❌ kid が JWKS にない
        </text>
        <text x={860} y={BY + BH + 26} textAnchor="middle" fill={SUB} fontSize={10}>
          認証エラー → 要再ログイン
        </text>

        {/* ── JWKS 取得の点線（API の下）── */}
        <line x1={boxes[2].x + boxes[2].w / 2} y1={BY + BH} x2={boxes[2].x + boxes[2].w / 2} y2={BY + BH + 28}
          stroke={GREEN} strokeWidth={1.4} strokeDasharray="4 4" opacity={0.7} />
        <text x={boxes[2].x + boxes[2].w / 2} y={BY + BH + 44} textAnchor="middle" fill={GREEN}
          fontSize={10} fontFamily="'JetBrains Mono',monospace" opacity={0.9}>
          GET /.well-known/jwks.json
        </text>
        <text x={boxes[2].x + boxes[2].w / 2} y={BY + BH + 60} textAnchor="middle" fill={SUB} fontSize={9.5} opacity={0.8}>
          このラボで操作するのはココ（鍵の中身）
        </text>
      </svg>
    </div>
  )
}

export function RotationScenario({ keys, onRefresh, jwksPanel }: Props) {
  const activeKeys = keys.filter(k => k.status === 'active')

  const [baseKid, setBaseKid] = useState<string>('')
  const [results, setResults] = useState<(StepResult | null)[]>(Array(4).fill(null))
  const [running, setRunning] = useState<number | null>(null)
  const [state, setState] = useState<ScenarioState>({ baseKid: '' })

  // 実際に使う base kid（選択 or activeの先頭）
  const effectiveBase = baseKid || activeKeys[0]?.kid || ''

  const setResult = (i: number, r: StepResult) =>
    setResults(prev => { const n = [...prev]; n[i] = r; return n })

  const runStep1 = async () => {
    const kid = effectiveBase
    if (!kid) return
    setRunning(0)
    try {
      const iss: IssuedToken = await fetch(`${API}/tokens/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kid, subject: 'demo-user', extra_claims: { role: 'admin' } }),
      }).then(r => r.json())

      const ver: VerifyResult = await fetch(`${API}/tokens/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: iss.token }),
      }).then(r => r.json())

      setState({ baseKid: kid, token1: iss })
      setResult(0, { label: `${kid} で発行 → 検証`, ok: ver.valid, detail: ver.message, verify: ver })
      onRefresh()
    } catch (e) {
      setResult(0, { label: 'エラー', ok: false, detail: String(e) })
    } finally {
      setRunning(null)
    }
  }

  const runStep2 = async () => {
    setRunning(1)
    try {
      // 新しい鍵を追加してレスポンスから kid を取得
      const addRes = await fetch(`${API}/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: '' }),
      }).then(r => r.json())
      const newKid: string = addRes.kid

      const iss2: IssuedToken = await fetch(`${API}/tokens/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kid: newKid, subject: 'demo-user', extra_claims: { role: 'member' } }),
      }).then(r => r.json())

      const ver1: VerifyResult = await fetch(`${API}/tokens/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: state.token1?.token }),
      }).then(r => r.json())

      const ver2: VerifyResult = await fetch(`${API}/tokens/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: iss2.token }),
      }).then(r => r.json())

      setState(s => ({ ...s, newKid, token2: iss2 }))
      setResult(1, {
        label: `${state.baseKid} JWT ✅ + ${newKid} JWT ✅`,
        ok: ver1.valid && ver2.valid,
        detail: `${state.baseKid} JWT: ${ver1.message} / ${newKid} JWT: ${ver2.message}`,
        verify: ver2,
      })
      onRefresh()
    } catch (e) {
      setResult(1, { label: 'エラー', ok: false, detail: String(e) })
    } finally {
      setRunning(null)
    }
  }

  const runStep3 = async () => {
    setRunning(2)
    try {
      await fetch(`${API}/keys/${state.baseKid}`, { method: 'DELETE' })

      const ver: VerifyResult = await fetch(`${API}/tokens/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: state.token1?.token }),
      }).then(r => r.json())

      setResult(2, {
        label: `${state.baseKid} を退役 → 旧 JWT 検証`,
        ok: ver.valid,
        detail: ver.message,
        verify: ver,
      })
      onRefresh()
    } catch (e) {
      setResult(2, { label: 'エラー', ok: false, detail: String(e) })
    } finally {
      setRunning(null)
    }
  }

  const runStep4 = async () => {
    setRunning(3)
    try {
      await fetch(`${API}/keys/${state.newKid}/revoke`, { method: 'POST' })

      const ver: VerifyResult = await fetch(`${API}/tokens/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: state.token2?.token }),
      }).then(r => r.json())

      setResult(3, {
        label: `${state.newKid} を失効 → JWT 検証`,
        ok: ver.valid,
        detail: ver.message,
        verify: ver,
      })
      onRefresh()
    } catch (e) {
      setResult(3, { label: 'エラー', ok: false, detail: String(e) })
    } finally {
      setRunning(null)
    }
  }

  const stepFns = [runStep1, runStep2, runStep3, runStep4]

  const STEP_META = [
    {
      title: 'STEP 1 — 通常運用: 旧鍵で発行した JWT を API サーバーが検証',
      desc: '起点の鍵は active で JWKS に公開済み。ユーザーがログインして受け取った JWT を API サーバーに送ると、JWKS から公開鍵を取得して署名を検証できる。これが日常的に行われている認証フロー。',
      expectOk: true,
      expectLabel: '✅ 検証成功',
    },
    {
      title: 'STEP 2 — 移行ウィンドウ: 新旧鍵が JWKS に並存',
      desc: '新しい鍵を追加してもすぐ旧鍵を消してはいけない。旧鍵で発行済みの JWT がまだ有効期限内に使われているため。移行ウィンドウ中は両方の kid が JWKS に公開され、どちらの JWT も検証できる。OKTA など本番 IdP はこの重複期間を数日〜数週間設ける。',
      expectOk: true,
      expectLabel: '✅ 両方とも検証成功',
    },
    {
      title: `STEP 3 — ローテーション完了: 旧鍵を JWKS から除外（退役）`,
      desc: '移行ウィンドウが終わり、旧鍵で発行された JWT の有効期限が切れたタイミングで旧鍵を退役させる。退役後は旧鍵の kid が JWKS から消えるため、旧鍵で署名した JWT を API サーバーに送ると "kid not found" エラーになる。ユーザーは再ログインして新鍵の JWT を取得する必要がある。',
      expectOk: false,
      expectLabel: '❌ kid_retired エラー',
    },
    {
      title: 'STEP 4 — 緊急対応: 鍵漏洩時の即時失効（revoke）',
      desc: '秘密鍵が漏洩した場合は移行ウィンドウを待たず即座に失効させる。revoke した鍵の JWT は有効期限内でも即座に無効になる。影響範囲はその鍵で発行されたすべての JWT（ログイン中のユーザー全員が強制ログアウト相当）。被害拡大防止のためのセキュリティ対応。',
      expectOk: false,
      expectLabel: '❌ key_revoked エラー',
    },
  ]

  const reset = (nextKid?: string) => {
    setResults(Array(4).fill(null))
    setState({ baseKid: '' })
    if (nextKid !== undefined) setBaseKid(nextKid)
    onRefresh()
  }

  // 完了済みの最終 STEP（連続実行前提なので非 null の最後のインデックス + 1）
  const completedStage = results.reduce((acc, r, i) => (r !== null ? i + 1 : acc), 0)

  return (
    <div className="step-card">
      <div className="step-head">
        <span className="step-badge">SCENARIO</span>
        <h2>ローテーション学習シナリオ</h2>
        <button
          style={{
            marginLeft: 'auto',
            fontSize: '0.72rem',
            padding: '4px 10px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            borderRadius: 'var(--r-sm)',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
          onClick={() => reset()}
        >
          リセット
        </button>
      </div>

      {/* 概念説明 */}
      <div style={{
        marginBottom: 16,
        padding: '12px 14px',
        background: 'rgba(59,130,246,0.06)',
        border: '1px solid rgba(59,130,246,0.2)',
        borderRadius: 'var(--r-sm)',
        fontSize: '0.78rem',
        lineHeight: 1.85,
        color: 'var(--text-secondary)',
      }}>
        <div style={{ fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>
          🔐 鍵ローテーションとは・認証フローのどこの話か
        </div>
        <div style={{ marginBottom: 6 }}>
          JWT 認証では <strong style={{ color: 'var(--text-primary)' }}>IdP（OKTA など）が RSA 秘密鍵で JWT に署名</strong> し、
          API サーバーは <strong style={{ color: 'var(--text-primary)' }}>JWKS エンドポイントから公開鍵を取得して署名を検証</strong> します。
          この「署名鍵ペア」を定期的に交換するのが鍵ローテーションです。
        </div>
        <div style={{ marginBottom: 6 }}>
          交換が必要な理由：
          <span style={{ color: 'var(--text-primary)' }}>① 定期交換</span>（長期使用は漏洩リスク増大）／
          <span style={{ color: 'var(--text-primary)' }}>② 緊急失効</span>（漏洩発覚時に即座に被害を封じ込める）
        </div>
        <RotationFlowDiagram />
      </div>

      {/* 鍵管理パネル（JWKS）— ステップ実行で鍵の状態がどう変わるかをすぐ上で確認できる */}
      {jwksPanel}

      {/* 動くチップ付きスティッキーヘッダー（通信一覧内蔵）— STEP 実行結果がここで再生される */}
      <RotationFlowHeader stage={completedStage} />

      {/* 起点の鍵セレクタ */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 16,
        padding: '10px 14px',
        background: 'var(--bg-inner)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-sm)',
        flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          STEP 1 の起点の鍵:
        </span>
        <select
          value={baseKid}
          onChange={e => reset(e.target.value)}
          disabled={results[0] !== null}
          style={{
            padding: '5px 8px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-sm)',
            color: results[0] !== null ? 'var(--text-muted)' : 'var(--text-primary)',
            fontFamily: "'JetBrains Mono',monospace",
            fontSize: '0.8rem',
            outline: 'none',
            cursor: results[0] !== null ? 'not-allowed' : 'pointer',
          }}
        >
          {activeKeys.length === 0 && <option value="">（active な鍵なし）</option>}
          {activeKeys.map(k => (
            <option key={k.kid} value={k.kid}>{k.kid}{k.label ? `  —  ${k.label}` : ''}</option>
          ))}
        </select>
        {results[0] !== null && (
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            ※ シナリオ実行中は変更不可（リセットで変更できます）
          </span>
        )}
        {results[0] === null && state.newKid && (
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            STEP 2 で追加される新鍵は自動検出します
          </span>
        )}
      </div>

      {/* ステップ一覧 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
        {STEP_META.map((meta, i) => {
          const result = results[i]
          const isRunning = running === i
          const canRun = running === null && activeKeys.length > 0 && (i === 0 || results[i - 1] !== null)

          // STEP 3/4 のタイトルを動的に更新
          let title = meta.title
          if (i === 2 && state.baseKid) title = `STEP 3 — ローテーション完了: ${state.baseKid} を退役`
          if (i === 3 && state.newKid) title = `STEP 4 — 緊急失効: ${state.newKid} を revoke`

          return (
            <div key={i} style={{
              padding: '14px 16px',
              background: result
                ? (result.ok === meta.expectOk ? 'var(--success-dim)' : 'var(--bg-inner)')
                : 'var(--bg-inner)',
              border: `1px solid ${result
                ? (result.ok === meta.expectOk ? 'rgba(34,197,94,0.3)' : 'var(--border)')
                : 'var(--border)'}`,
              borderRadius: 'var(--r-sm)',
              opacity: !canRun && !result ? 0.5 : 1,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: result ? 8 : 0 }}>
                {/* 番号 / 結果バッジ */}
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  minWidth: 24,
                  height: 24,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 99,
                  background: result ? (result.ok === meta.expectOk ? 'var(--success)' : 'var(--danger)') : 'var(--bg-card)',
                  color: result ? '#000' : 'var(--text-muted)',
                  border: result ? 'none' : '1px solid var(--border)',
                  flexShrink: 0,
                }}>
                  {result ? (result.ok === meta.expectOk ? '✓' : '!') : i + 1}
                </span>

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                    {title}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {meta.desc}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                  <span style={{
                    fontSize: '0.68rem',
                    padding: '2px 8px',
                    borderRadius: 99,
                    background: meta.expectOk ? 'var(--success-dim)' : 'var(--danger-dim)',
                    color: meta.expectOk ? 'var(--success)' : 'var(--danger)',
                    border: `1px solid ${meta.expectOk ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                  }}>
                    {meta.expectLabel}
                  </span>
                  <button
                    style={{
                      padding: '4px 12px',
                      background: canRun ? 'var(--accent)' : 'var(--bg-card)',
                      color: canRun ? '#fff' : 'var(--text-muted)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--r-sm)',
                      cursor: canRun ? 'pointer' : 'not-allowed',
                      fontFamily: 'inherit',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                    }}
                    onClick={() => stepFns[i]()}
                    disabled={!canRun}
                  >
                    {isRunning ? '実行中...' : result ? '再実行' : '実行'}
                  </button>
                </div>
              </div>

              {/* 結果 */}
              {result && (
                <div style={{
                  padding: '8px 10px',
                  background: 'var(--bg-card)',
                  borderRadius: 'var(--r-sm)',
                  fontSize: '0.72rem',
                  fontFamily: "'JetBrains Mono',monospace",
                  lineHeight: 1.6,
                }}>
                  <div style={{ color: result.ok ? 'var(--success)' : 'var(--danger)', fontWeight: 700, marginBottom: 2 }}>
                    {result.ok ? '✓ VALID' : '✗ INVALID'}
                  </div>
                  <div style={{ color: 'var(--text-secondary)' }}>{result.detail}</div>
                  {result.verify?.jwks_kids && (
                    <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                      JWKS kids: [{result.verify.jwks_kids.map(k => `"${k}"`).join(', ')}]
                    </div>
                  )}
                  {result.verify?.error && (
                    <div style={{ color: 'var(--warn)', marginTop: 2 }}>
                      error_code: {result.verify.error}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{
        padding: '8px 12px',
        background: 'var(--bg-inner)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-sm)',
        fontSize: '0.72rem',
        color: 'var(--text-muted)',
        lineHeight: 1.7,
      }}>
        ⚠️ リセット後に別の鍵で再実行する場合、前のシナリオで退役・失効した鍵はバックエンド再起動が必要です
      </div>
    </div>
  )
}
