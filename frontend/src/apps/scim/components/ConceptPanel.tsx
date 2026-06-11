// SCIM vs OIDC の概念説明パネル

// ─── 入社時フロー図（SVG）: SCIM プロビジョニング → 初回ログイン ───
function OnboardingFlowDiagram() {
  const TXT = '#e2e8f0'
  const SUB = '#94a3b8'
  const BOX_BG = '#0e1520'
  const BOX_BD = 'rgba(255,255,255,0.14)'
  const PURPLE = '#a78bfa'
  const GREEN = '#22c55e'
  const BLUE = '#3b82f6'
  const WARN = '#f59e0b'

  const BW = 180
  const BH = 66
  // 2レーン構成: 上段=STEP1 入社(SCIM), 下段=STEP2 初回ログイン(OIDC)
  const Y1 = 42
  const Y2 = 168
  const X = [16, 300, 600]

  const Box = ({ x, y, icon, label, sub, accent }: { x: number; y: number; icon: string; label: string; sub: string; accent: string }) => (
    <g>
      <rect x={x} y={y} width={BW} height={BH} rx={12} fill={BOX_BG} stroke={BOX_BD} />
      <rect x={x} y={y} width={BW} height={4} rx={2} fill={accent} opacity={0.85} />
      <text x={x + BW / 2} y={y + 26} textAnchor="middle" fontSize={15}>{icon}</text>
      <text x={x + BW / 2} y={y + 44} textAnchor="middle" fill={TXT} fontSize={12.5} fontWeight={700}>{label}</text>
      <text x={x + BW / 2} y={y + 58} textAnchor="middle" fill={SUB} fontSize={9.5}>{sub}</text>
    </g>
  )

  return (
    <div style={{
      background: 'var(--bg-inner)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--r-sm)',
      padding: '12px 14px',
    }}>
      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 8 }}>
        入社時の典型的なフロー（OKTA 導入後）
      </div>
      <svg viewBox="0 0 960 280" style={{ width: '100%', height: 'auto', display: 'block' }}>
        <defs>
          <marker id="ob-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M 0 1 L 9 5 L 0 9 z" fill="currentColor" />
          </marker>
          <marker id="ob-ah-p" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M 0 1 L 9 5 L 0 9 z" fill={PURPLE} />
          </marker>
          <marker id="ob-ah-b" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M 0 1 L 9 5 L 0 9 z" fill={BLUE} />
          </marker>
        </defs>

        {/* ── STEP ラベル ── */}
        <rect x={16} y={8} width={158} height={20} rx={10} fill="rgba(167,139,250,0.1)" stroke="rgba(167,139,250,0.35)" />
        <text x={95} y={22} textAnchor="middle" fill={PURPLE} fontSize={10.5} fontWeight={800}>
          STEP 1 入社（SCIM）
        </text>
        <rect x={16} y={134} width={190} height={20} rx={10} fill="rgba(59,130,246,0.1)" stroke="rgba(59,130,246,0.35)" />
        <text x={111} y={148} textAnchor="middle" fill={BLUE} fontSize={10.5} fontWeight={800}>
          STEP 2 初回ログイン（OIDC）
        </text>

        {/* ── 上段: HR → OKTA → 社内アプリ ── */}
        <g style={{ color: WARN }}>
          <line x1={X[0] + BW} y1={Y1 + BH / 2} x2={X[1]} y2={Y1 + BH / 2}
            stroke={WARN} strokeWidth={2} markerEnd="url(#ob-ah)" opacity={0.9} />
        </g>
        <rect x={(X[0] + BW + X[1]) / 2 - 42} y={Y1 + BH / 2 - 25} width={84} height={17} rx={8.5}
          fill="#0a0f1a" stroke={WARN} strokeWidth={1} />
        <text x={(X[0] + BW + X[1]) / 2} y={Y1 + BH / 2 - 13} textAnchor="middle" fill={WARN} fontSize={10} fontWeight={700}>
          入社情報を登録
        </text>

        <g style={{ color: PURPLE }}>
          <line x1={X[1] + BW} y1={Y1 + BH / 2} x2={X[2]} y2={Y1 + BH / 2}
            stroke={PURPLE} strokeWidth={2} markerEnd="url(#ob-ah-p)" opacity={0.9} />
        </g>
        <rect x={(X[1] + BW + X[2]) / 2 - 94} y={Y1 + BH / 2 - 25} width={188} height={17} rx={8.5}
          fill="#0a0f1a" stroke={PURPLE} strokeWidth={1} />
        <text x={(X[1] + BW + X[2]) / 2} y={Y1 + BH / 2 - 13} textAnchor="middle" fill={PURPLE}
          fontSize={10} fontWeight={700} fontFamily="'JetBrains Mono',monospace">
          SCIM POST /scim/v2/Users
        </text>

        <Box x={X[0]} y={Y1} icon="🏢" label="HR システム" sub="入社・異動・退社の源泉" accent={WARN} />
        <Box x={X[1]} y={Y1} icon="🔐" label="OKTA (IdP)" sub="変更を検知して自動プッシュ" accent={PURPLE} />
        <Box x={X[2]} y={Y1} icon="💼" label="社内アプリ" sub="アカウント自動作成 ✅" accent={GREEN} />

        {/* ── 中央: 数分後... ── */}
        <line x1={480} y1={Y1 + BH + 8} x2={480} y2={Y2 - 8}
          stroke={SUB} strokeWidth={1.2} strokeDasharray="3 4" opacity={0.5} />
        <rect x={400} y={(Y1 + BH + Y2) / 2 - 10} width={160} height={20} rx={10}
          fill="#0a0f1a" stroke={BOX_BD} />
        <text x={480} y={(Y1 + BH + Y2) / 2 + 4} textAnchor="middle" fill={SUB} fontSize={10}>
          ⏱ 数分後、新入社員が初回ログイン
        </text>

        {/* ── 下段: ブラウザ → OKTA → 社内アプリ ── */}
        <g style={{ color: BLUE }}>
          <line x1={X[0] + BW} y1={Y2 + BH / 2} x2={X[1]} y2={Y2 + BH / 2}
            stroke={BLUE} strokeWidth={2} markerEnd="url(#ob-ah-b)" opacity={0.9} />
        </g>
        <rect x={(X[0] + BW + X[1]) / 2 - 92} y={Y2 + BH / 2 - 25} width={184} height={17} rx={8.5}
          fill="#0a0f1a" stroke={BLUE} strokeWidth={1} />
        <text x={(X[0] + BW + X[1]) / 2} y={Y2 + BH / 2 - 13} textAnchor="middle" fill={BLUE} fontSize={10} fontWeight={700}>
          OIDC Authorization Code Flow
        </text>

        <g style={{ color: BLUE }}>
          <line x1={X[1] + BW} y1={Y2 + BH / 2} x2={X[2]} y2={Y2 + BH / 2}
            stroke={BLUE} strokeWidth={2} markerEnd="url(#ob-ah-b)" opacity={0.9} />
        </g>
        <rect x={(X[1] + BW + X[2]) / 2 - 26} y={Y2 + BH / 2 - 25} width={52} height={17} rx={8.5}
          fill="#0a0f1a" stroke={BLUE} strokeWidth={1} />
        <text x={(X[1] + BW + X[2]) / 2} y={Y2 + BH / 2 - 13} textAnchor="middle" fill={BLUE}
          fontSize={10} fontWeight={700} fontFamily="'JetBrains Mono',monospace">
          JWT
        </text>

        <Box x={X[0]} y={Y2} icon="🧑‍💻" label="ブラウザ" sub="新入社員がアクセス" accent={BLUE} />
        <Box x={X[1]} y={Y2} icon="🔐" label="OKTA (IdP)" sub="認証してトークン発行" accent={PURPLE} />
        <Box x={X[2]} y={Y2} icon="💼" label="社内アプリ" sub="権限設定済みで即利用可 🎉" accent={GREEN} />

        {/* ── 補足 ── */}
        <text x={480} y={268} textAnchor="middle" fill={SUB} fontSize={10} opacity={0.75}>
          ※ STEP 1 の SCIM でアカウントが先に作られているから、初回ログインでも既に権限が設定済み
        </text>
      </svg>
    </div>
  )
}

export function ConceptPanel() {
  return (
    <div className="card">
      <div className="card-head">
        <span className="badge badge-purple">CONCEPT</span>
        <h2>SCIM とは・OIDC/JWT との違い</h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* 一言説明 */}
        <div style={{
          padding: '12px 14px',
          background: 'rgba(167,139,250,0.06)',
          border: '1px solid rgba(167,139,250,0.2)',
          borderRadius: 'var(--r-sm)',
          fontSize: '0.82rem',
          lineHeight: 1.8,
        }}>
          <strong style={{ color: 'var(--purple)' }}>SCIM = System for Cross-domain Identity Management</strong>
          <br />
          OKTA のような IdP から、対象サービス（Salesforce・社内システムなど）に
          <strong style={{ color: 'var(--text-primary)' }}> ユーザーアカウントを自動で作成・更新・削除する</strong> ための REST API 標準仕様（RFC 7643/7644）。
        </div>

        {/* OIDC との対比表 */}
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 8 }}>
            OIDC/JWT と SCIM の役割分担
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.76rem',
              lineHeight: 1.7,
            }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['', 'OIDC / JWT', 'SCIM'].map(h => (
                    <th key={h} style={{
                      padding: '6px 10px',
                      textAlign: 'left',
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                      fontSize: '0.7rem',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['目的',       'ログイン・認証・認可',            'ユーザーアカウントの自動プロビジョニング'],
                  ['タイミング', 'ユーザーがログインするたび',       'ユーザーの入社・異動・退社時（HR起点）'],
                  ['方向',       'ユーザー → IdP → アプリ',         'IdP → アプリ（Push型）'],
                  ['データ',     'JWT トークン（クレーム）',          'ユーザー属性（氏名・部署・メール等）'],
                  ['操作',       'トークン発行・検証',                'CRUD（作成・更新・削除・無効化）'],
                  ['HTTP メソッド', '主に POST',                    'GET / POST / PUT / PATCH / DELETE'],
                  ['OKTA での役割', '認証プロバイダー',             'ユーザーストアからアプリへ同期'],
                ].map(([label, oidc, scim]) => (
                  <tr key={label} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '6px 10px', color: 'var(--text-muted)', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>{label}</td>
                    <td style={{ padding: '6px 10px', color: 'var(--accent)' }}>{oidc}</td>
                    <td style={{ padding: '6px 10px', color: 'var(--purple)' }}>{scim}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* フロー図（SVG） */}
        <OnboardingFlowDiagram />

        {/* SCIM のライフサイクル */}
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 8 }}>
            SCIM が管理するユーザーライフサイクル
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { op: 'POST',   label: 'プロビジョニング', sub: '入社・アカウント作成',   color: 'var(--accent)' },
              { op: 'PUT',    label: '属性更新',          sub: '異動・役職変更など',     color: 'var(--warn)' },
              { op: 'PATCH',  label: '無効化',            sub: '休職・一時停止',         color: 'var(--purple)' },
              { op: 'DELETE', label: 'デプロビジョニング', sub: '退社・アカウント削除',   color: 'var(--danger)' },
            ].map(item => (
              <div key={item.op} style={{
                flex: '1 1 140px',
                padding: '8px 10px',
                background: 'var(--bg-inner)',
                border: `1px solid ${item.color}33`,
                borderRadius: 'var(--r-sm)',
              }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '0.7rem', color: item.color, fontWeight: 700 }}>
                  {item.op}
                </div>
                <div style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                  {item.label}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{item.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
