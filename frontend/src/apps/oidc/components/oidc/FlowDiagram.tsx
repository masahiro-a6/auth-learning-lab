// フロー全体をステップ形式で可視化するコンポーネント
// 「今どこにいるか」と「誰から誰へ通信しているか」を示す

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

const ACTOR_LABEL: Record<Step['actor'], string> = {
  client: 'クライアント側',
  idp:    'IdP側',
  both:   'サーバー間',
}

const ACTOR_COLOR: Record<Step['actor'], string> = {
  client: 'var(--accent)',
  idp:    'var(--jwt-sig-color)',
  both:   'var(--warn)',
}

interface Props {
  currentStep: number
}

export function FlowDiagram({ currentStep }: Props) {
  return (
    <div style={{ marginBottom: 24 }}>
      {/* アクター凡例 */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
        {(['client', 'idp', 'both'] as const).map(a => (
          <div key={a} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: ACTOR_COLOR[a], display: 'inline-block' }} />
            {ACTOR_LABEL[a]}
          </div>
        ))}
      </div>

      {/* ステップバー */}
      <div style={{ display: 'flex', alignItems: 'center', overflowX: 'auto', paddingBottom: 4 }}>
        {STEPS.map((step, i) => {
          const done    = step.num < currentStep
          const active  = step.num === currentStep
          const pending = step.num > currentStep
          const color   = done || active ? ACTOR_COLOR[step.actor] : 'var(--text-muted)'

          return (
            <div key={step.num} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              {/* ステップノード */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                opacity: pending ? 0.4 : 1,
              }}>
                {/* 番号バッジ */}
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  border: `2px solid ${color}`,
                  background: active ? color : done ? `${color}22` : 'var(--bg-inner)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: active ? '#fff' : color,
                  boxShadow: active ? `0 0 0 4px ${color}30` : 'none',
                  transition: 'all 0.2s',
                }}>
                  {done ? '✓' : step.num}
                </div>
                {/* ラベル */}
                <div style={{
                  fontSize: '0.65rem',
                  color: active ? color : done ? 'var(--text-secondary)' : 'var(--text-muted)',
                  fontWeight: active ? 700 : 500,
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  maxWidth: 80,
                  lineHeight: 1.3,
                }}>
                  {step.label}
                </div>
              </div>

              {/* コネクター矢印 */}
              {i < STEPS.length - 1 && (
                <div style={{
                  width: 32,
                  height: 2,
                  background: step.num < currentStep
                    ? `linear-gradient(to right, ${ACTOR_COLOR[step.actor]}, ${ACTOR_COLOR[STEPS[i + 1].actor]})`
                    : 'var(--border)',
                  margin: '0 2px',
                  marginBottom: 22,
                  flexShrink: 0,
                  opacity: step.num < currentStep ? 1 : 0.3,
                  transition: 'all 0.3s',
                }} />
              )}
            </div>
          )
        })}
      </div>

      {/* アクター図: ブラウザ / IdP / APIサーバー */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: 16,
        padding: '10px 16px',
        background: 'var(--bg-inner)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-sm)',
        fontSize: '0.72rem',
        color: 'var(--text-secondary)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.2rem', marginBottom: 2 }}>💻</div>
          <div>ブラウザ</div>
          <div style={{ color: 'var(--accent)', fontWeight: 600 }}>クライアントアプリ</div>
        </div>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', alignSelf: 'center' }}>←→</div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.2rem', marginBottom: 2 }}>🔐</div>
          <div>認可サーバー</div>
          <div style={{ color: 'var(--jwt-sig-color)', fontWeight: 600 }}>OKTA（このモック）</div>
        </div>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', alignSelf: 'center' }}>←→</div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.2rem', marginBottom: 2 }}>🖥</div>
          <div>リソースサーバー</div>
          <div style={{ color: 'var(--warn)', fontWeight: 600 }}>/api/* エンドポイント</div>
        </div>
      </div>
    </div>
  )
}
