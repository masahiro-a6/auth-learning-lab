import { useState } from 'react'
import type { KeyEntry, IssuedToken, VerifyResult } from '../types'

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

export function RotationScenario({ keys, onRefresh }: Props) {
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
