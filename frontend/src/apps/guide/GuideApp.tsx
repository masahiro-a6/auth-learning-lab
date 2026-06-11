// 🏠 はじめに — 認証認可学習ラボの入口ガイド
// 認証認可とは / 登場人物と全体像 / 学習ロードマップ / 用語集 / 学び方のすすめ

const APP_COLORS = {
  app1: { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', bd: 'rgba(59,130,246,0.35)' },
  app2: { color: '#34d399', bg: 'rgba(52,211,153,0.10)', bd: 'rgba(52,211,153,0.35)' },
  app3: { color: '#c084fc', bg: 'rgba(192,132,252,0.10)', bd: 'rgba(192,132,252,0.35)' },
} as const

type AppKey = keyof typeof APP_COLORS

function AppBadge({ app, label }: { app: AppKey; label: string }) {
  const c = APP_COLORS[app]
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      fontSize: '0.62rem',
      fontWeight: 800,
      letterSpacing: '0.05em',
      padding: '1px 7px',
      borderRadius: 99,
      whiteSpace: 'nowrap',
      background: c.bg,
      color: c.color,
      border: `1px solid ${c.bd}`,
      marginRight: 4,
    }}>
      {label}
    </span>
  )
}

// ─── 用語集データ ─────────────────────────────────────────
type Term = { term: string; desc: string; apps: AppKey[] }

const TERMS: Term[] = [
  { term: '認証 (Authentication)', desc: '「あなたは誰？」を確かめること。ログインそのもの', apps: ['app1'] },
  { term: '認可 (Authorization)', desc: '「あなたは何をしてよい？」を判断すること。権限チェック', apps: ['app1'] },
  { term: 'IdP (Identity Provider)', desc: '認証を専門に引き受けるサービス。OKTA, Entra ID など', apps: ['app1', 'app2', 'app3'] },
  { term: 'RP / クライアント', desc: 'IdPに認証を任せる側のアプリ（Relying Party）', apps: ['app1'] },
  { term: 'RS (リソースサーバー)', desc: 'トークンを検証してデータを返すAPIサーバー', apps: ['app1', 'app2'] },
  { term: 'SSO (シングルサインオン)', desc: '一度のログインで複数アプリを利用できる仕組み', apps: ['app1'] },
  { term: 'OAuth 2.0', desc: '「権限の委譲（認可）」のための標準プロトコル', apps: ['app1'] },
  { term: 'OIDC (OpenID Connect)', desc: 'OAuth 2.0 の上に「認証」を載せた標準。現代SSOの主流', apps: ['app1'] },
  { term: 'JWT (JSON Web Token)', desc: 'Header.Payload.Signature の3部構成の署名付きトークン', apps: ['app1', 'app2'] },
  { term: 'クレーム (claim)', desc: 'JWTのPayloadに入る属性情報（sub, exp, role など）', apps: ['app1'] },
  { term: '署名 / RS256', desc: '秘密鍵で署名し公開鍵で検証する方式。改ざん検知の要', apps: ['app1', 'app2'] },
  { term: '公開鍵 / 秘密鍵', desc: '秘密鍵は IdP だけが持ち署名に使う。公開鍵は誰でも検証に使える', apps: ['app1', 'app2'] },
  { term: 'JWKS', desc: 'IdPが公開鍵一覧を配る標準エンドポイント (/.well-known/jwks.json)', apps: ['app2'] },
  { term: 'kid (Key ID)', desc: 'どの鍵で署名したかを示すID。JWTのHeaderとJWKSを結びつける', apps: ['app2'] },
  { term: 'access_token', desc: 'APIを呼ぶための鍵。RSに提示する', apps: ['app1'] },
  { term: 'id_token', desc: '「誰がログインしたか」をアプリに伝えるトークン（OIDC固有）', apps: ['app1'] },
  { term: 'refresh_token', desc: 'access_token を再ログインなしで更新するためのトークン', apps: ['app1'] },
  { term: '認可コード (authorization code)', desc: 'トークンと引き換える一時的な引換券。ブラウザ経由で渡る', apps: ['app1'] },
  { term: 'state', desc: 'CSRF対策のランダム値。リクエストとコールバックの対応を確認', apps: ['app1'] },
  { term: 'nonce', desc: 'id_token のリプレイ攻撃対策のランダム値', apps: ['app1'] },
  { term: 'スコープ (scope)', desc: '要求する権限の範囲（openid profile email など）', apps: ['app1'] },
  { term: 'SCIM', desc: 'ユーザーアカウントを自動同期するための標準プロトコル', apps: ['app3'] },
  { term: 'プロビジョニング / デプロビジョニング', desc: 'アカウントの自動作成 / 自動無効化・削除', apps: ['app3'] },
  { term: 'RBAC', desc: 'ロール（役職）ベースの権限制御', apps: ['app1', 'app3'] },
  { term: 'ABAC', desc: '属性（部署・役職・時刻など）ベースの権限制御', apps: ['app1'] },
  { term: 'SAML', desc: '参考: 旧世代のSSO標準。OIDCの前身的存在。XMLベース', apps: [] },
]

// ─── ロードマップカードデータ ─────────────────────────────
const ROADMAP = [
  {
    app: 'app1' as AppKey,
    badge: '① OIDC / JWT',
    title: 'まず「認証の主役フロー」を体験する',
    body: 'ログインしてトークンをもらい、APIがそれを検証する——認証認可の中心となる流れをここで体験します。JWTの構造（Header / Payload / Signature）、RS256署名、OIDC Authorization Code Flow の6ステップ、access / id / refresh トークンの違い、state / nonce。すべての土台になるアプリです。',
    checks: [
      'JWTがなぜ改ざんできないのか（RS256署名）を説明できる',
      'Authorization Code Flow の6ステップを順に追える',
      'access_token / id_token / refresh_token の役割の違いが分かる',
      'state / nonce が何の攻撃を防ぐのか分かる',
    ],
  },
  {
    app: 'app2' as AppKey,
    badge: '② 鍵ローテーション',
    title: '①の署名検証を支える「裏方」を知る',
    body: '①で出てきた「署名検証」は、鍵の運用に支えられています。鍵のライフサイクル（active → retired / revoked）、JWKSによる公開鍵配布、kid による鍵の特定、新旧鍵が共存する移行ウィンドウ。①を理解してから学ぶと「なぜ鍵が複数あるのか」が腑に落ちます。',
    checks: [
      'JWKSエンドポイントが何を配っているか説明できる',
      'kid がJWTとJWKSをどう結びつけるか分かる',
      'ローテーション中に古いトークンが検証できる理由が分かる',
      'retired と revoked の違い（漏洩時の即時失効）が分かる',
    ],
  },
  {
    app: 'app3' as AppKey,
    badge: '③ SCIM プロビジョニング',
    title: '視点を変えて「アカウントはいつ誰が作るのか」',
    body: 'ログイン以前の話——そもそもアカウントはいつ・誰が作るのか。入社・異動・退社に合わせて IdP がアプリ側のアカウントを自動同期する「プロビジョニング」を学びます。OKTA導入の実務では、認証（①②）とID管理（③）の両輪が必要です。',
    checks: [
      'SCIMが解決する課題（手作業のアカウント管理）を説明できる',
      '入社→作成、異動→更新、退社→無効化の流れを追える',
      'デプロビジョニング漏れがセキュリティ事故になる理由が分かる',
      '認証（OIDC）とID管理（SCIM）の役割分担が分かる',
    ],
  },
]

// ─── 全体地図（SVGフロー図） ─────────────────────────
function OverviewDiagram() {
  const C1 = APP_COLORS.app1.color // OIDC/JWT 青
  const C2 = APP_COLORS.app2.color // 鍵 緑
  const C3 = APP_COLORS.app3.color // SCIM 紫
  const TXT = '#e2e8f0'
  const SUB = '#94a3b8'
  const MUTED = '#64748b'
  const BOX_BG = '#0e1520'
  const BOX_BD = 'rgba(255,255,255,0.14)'

  const rows: { n: string; proto: string; app: AppKey; appLabel: string; desc: string }[] = [
    { n: '1. 入社', proto: 'SCIM', app: 'app3', appLabel: 'アプリ③', desc: 'HRシステム → IdP → 各アプリにアカウントを自動作成' },
    { n: '2. ログイン', proto: 'OIDC', app: 'app1', appLabel: 'アプリ①', desc: 'ユーザーが IdP で認証し、アプリがトークンを受け取る' },
    { n: '3. API利用', proto: 'JWT検証', app: 'app1', appLabel: 'アプリ①', desc: 'APIサーバーが署名と権限（認可）をチェックして応答' },
    { n: '4. 鍵の運用', proto: 'JWKS', app: 'app2', appLabel: 'アプリ②', desc: '3の署名検証を裏で支える、鍵の定期ローテーション' },
  ]

  // 4つのボックスの座標（viewBox 960x300）
  const boxes = [
    { x: 20,  label: 'HR システム', sub: '入社・異動・退社', icon: '🏢', accent: C3 },
    { x: 270, label: 'IdP (OKTA)',  sub: '認証の専門家',     icon: '🔐', accent: C1 },
    { x: 520, label: 'アプリ (RP)', sub: 'IdP を信頼する側', icon: '💻', accent: C1 },
    { x: 770, label: 'API (RS)',   sub: 'トークンを検証',    icon: '🗄️', accent: C2 },
  ]
  const BW = 170 // box width
  const BY = 70  // box y
  const BH = 78  // box height
  const MID = BY + BH / 2

  const Arrow = ({ x1, x2, color, label, dual = false, id }: { x1: number; x2: number; color: string; label: string; dual?: boolean; id: string }) => (
    <g>
      <defs>
        <marker id={`ah-${id}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 1 L 9 5 L 0 9 z" fill={color} />
        </marker>
      </defs>
      <line
        x1={x1} y1={MID} x2={x2} y2={MID}
        stroke={color} strokeWidth={2}
        markerEnd={`url(#ah-${id})`}
        markerStart={dual ? `url(#ah-${id})` : undefined}
        strokeDasharray="none"
        opacity={0.9}
      />
      <rect x={(x1 + x2) / 2 - 34} y={MID - 26} width={68} height={18} rx={9}
        fill="#0a0f1a" stroke={color} strokeWidth={1} opacity={0.95} />
      <text x={(x1 + x2) / 2} y={MID - 13} textAnchor="middle" fill={color}
        fontSize={11} fontWeight={700} fontFamily="'JetBrains Mono',monospace">
        {label}
      </text>
    </g>
  )

  return (
    <div style={{
      background: 'linear-gradient(180deg, rgba(59,130,246,0.04), rgba(192,132,252,0.03))',
      border: '1px solid var(--border)',
      borderRadius: 'var(--r-md)',
      padding: '14px 16px',
    }}>
      <svg viewBox="0 0 960 300" style={{ width: '100%', height: 'auto', display: 'block' }}>
        {/* ── 接続線（ボックスの下に描画）── */}
        <Arrow id="scim" x1={boxes[0].x + BW} x2={boxes[1].x} color={C3} label="SCIM" />
        <Arrow id="oidc" x1={boxes[1].x + BW} x2={boxes[2].x} color={C1} label="OIDC" dual />
        <Arrow id="jwt"  x1={boxes[2].x + BW} x2={boxes[3].x} color={C1} label="JWT" />

        {/* ── 4ボックス ── */}
        {boxes.map(b => (
          <g key={b.label}>
            <rect x={b.x} y={BY} width={BW} height={BH} rx={12}
              fill={BOX_BG} stroke={BOX_BD} strokeWidth={1} />
            <rect x={b.x} y={BY} width={BW} height={4} rx={2} fill={b.accent} opacity={0.85} />
            <text x={b.x + BW / 2} y={BY + 32} textAnchor="middle" fontSize={20}>{b.icon}</text>
            <text x={b.x + BW / 2} y={BY + 53} textAnchor="middle" fill={TXT} fontSize={14} fontWeight={700}>
              {b.label}
            </text>
            <text x={b.x + BW / 2} y={BY + 69} textAnchor="middle" fill={SUB} fontSize={10.5}>
              {b.sub}
            </text>
          </g>
        ))}

        {/* ── IdP: 署名（秘密鍵）── */}
        <g>
          <line x1={boxes[1].x + BW / 2} y1={BY + BH} x2={boxes[1].x + BW / 2} y2={BY + BH + 36}
            stroke={C2} strokeWidth={1.5} strokeDasharray="4 4" opacity={0.8} />
          <rect x={boxes[1].x + BW / 2 - 78} y={BY + BH + 36} width={156} height={26} rx={13}
            fill="rgba(52,211,153,0.08)" stroke={APP_COLORS.app2.bd} strokeWidth={1} />
          <text x={boxes[1].x + BW / 2} y={BY + BH + 53} textAnchor="middle" fill={C2} fontSize={11} fontWeight={600}>
            🔏 秘密鍵で JWT に署名
          </text>
        </g>

        {/* ── RS: 検証（公開鍵=JWKS）── */}
        <g>
          <line x1={boxes[3].x + BW / 2} y1={BY + BH} x2={boxes[3].x + BW / 2} y2={BY + BH + 36}
            stroke={C2} strokeWidth={1.5} strokeDasharray="4 4" opacity={0.8} />
          <rect x={boxes[3].x + BW / 2 - 86} y={BY + BH + 36} width={172} height={26} rx={13}
            fill="rgba(52,211,153,0.08)" stroke={APP_COLORS.app2.bd} strokeWidth={1} />
          <text x={boxes[3].x + BW / 2} y={BY + BH + 53} textAnchor="middle" fill={C2} fontSize={11} fontWeight={600}>
            🔓 公開鍵 (JWKS) で検証
          </text>
        </g>

        {/* ── JWKS 配布の弧（IdP → RS）── */}
        <g>
          <defs>
            <marker id="ah-jwks" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M 0 1 L 9 5 L 0 9 z" fill={C2} />
            </marker>
          </defs>
          <path
            d={`M ${boxes[1].x + BW / 2 + 80} ${BY + BH + 49} C ${boxes[2].x + BW / 2} ${BY + BH + 92}, ${boxes[2].x + BW / 2} ${BY + BH + 92}, ${boxes[3].x + BW / 2 - 88} ${BY + BH + 49}`}
            fill="none" stroke={C2} strokeWidth={1.5} strokeDasharray="4 4" opacity={0.7}
            markerEnd="url(#ah-jwks)"
          />
          <text x={boxes[2].x + BW / 2} y={BY + BH + 88} textAnchor="middle" fill={C2} fontSize={10.5}
            fontFamily="'JetBrains Mono',monospace" opacity={0.9}>
            GET /.well-known/jwks.json
          </text>
        </g>

        {/* ── ユーザー（ブラウザ）：上から OIDC へ ── */}
        <g>
          <text x={boxes[1].x + BW + 40} y={26} textAnchor="middle" fontSize={18}>🧑‍💻</text>
          <text x={boxes[1].x + BW + 40} y={44} textAnchor="middle" fill={MUTED} fontSize={10.5}>
            ユーザー / ブラウザ
          </text>
          <line x1={boxes[1].x + BW + 40} y1={50} x2={boxes[1].x + BW + 40} y2={MID - 14}
            stroke={MUTED} strokeWidth={1.2} strokeDasharray="3 3" opacity={0.7} />
        </g>
      </svg>

      {/* ── 凡例: 4ステップとアプリの対応 ── */}
      <div style={{
        borderTop: '1px solid var(--border)',
        marginTop: 10,
        paddingTop: 12,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 8,
      }}>
        {rows.map(r => {
          const c = APP_COLORS[r.app]
          return (
            <div key={r.n} style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              padding: '8px 12px',
              background: 'var(--bg-inner)',
              border: `1px solid ${c.bd}`,
              borderLeft: `3px solid ${c.color}`,
              borderRadius: 'var(--r-sm)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.78rem' }}>{r.n}</span>
                <span style={{
                  color: c.color, background: c.bg, border: `1px solid ${c.bd}`,
                  borderRadius: 99, padding: '0 8px', fontSize: '0.64rem', fontWeight: 700,
                  fontFamily: "'JetBrains Mono',monospace",
                }}>
                  {r.proto} = {r.appLabel}
                </span>
              </div>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', lineHeight: 1.6 }}>{r.desc}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function GuideApp() {
  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-title">
          <h1>🏠 はじめに — 認証認可 学習ラボの歩き方</h1>
          <span className="app-header-tag">Guide</span>
        </div>
        <p>
          3つのデモアプリが「認証認可のどこの話」なのかを、学び始める前にここで掴んでおきましょう。
        </p>
      </header>

      {/* a) 認証と認可とは */}
      <section className="step-card">
        <div className="step-head">
          <span className="step-badge">基礎</span>
          <h2>認証と認可とは — まずこの2つを混同しないこと</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
          <div style={{ background: 'var(--bg-inner)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '14px 16px' }}>
            <div style={{ fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>認証 (Authentication)</div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              <strong style={{ color: 'var(--text-primary)' }}>「あなたは誰？」</strong>を確かめること。
              いわゆる<strong style={{ color: 'var(--text-primary)' }}>ログイン</strong>です。
              身近な例: <span style={{ color: 'var(--text-primary)' }}>社員証をかざして入館する</span> — 本人であることの確認。
            </p>
          </div>
          <div style={{ background: 'var(--bg-inner)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '14px 16px' }}>
            <div style={{ fontWeight: 700, color: 'var(--success)', marginBottom: 6 }}>認可 (Authorization)</div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              <strong style={{ color: 'var(--text-primary)' }}>「あなたは何をしてよい？」</strong>を判断すること。
              <strong style={{ color: 'var(--text-primary)' }}>権限</strong>の話です。
              身近な例: <span style={{ color: 'var(--text-primary)' }}>役職によって入れる部屋が違う</span> — 入館済み(認証済み)でも、できることは人によって違う。
            </p>
          </div>
        </div>
        <div className="warn-box">
          ⚠ 最重要: <strong>認証と認可を混同しないこと</strong>。
          「ログインできた(認証)」と「その操作をしてよい(認可)」は別の関門です。このラボのすべての内容は、この区別の上に成り立っています。
        </div>
      </section>

      {/* b) 登場人物と全体像 */}
      <section className="step-card">
        <div className="step-head">
          <span className="step-badge">全体像</span>
          <h2>登場人物と全体地図 — なぜ IdP に認証を集約するのか</h2>
        </div>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.9, marginBottom: 12 }}>
          1社で何十ものSaaS・社内アプリを使うのが当たり前の時代、各アプリが個別にID・パスワードを管理すると、
          ユーザーはパスワードだらけ、管理者は退社処理だらけ、漏洩リスクはアプリの数だけ増えます。
          そこで<strong style={{ color: 'var(--text-primary)' }}>認証を IdP（Identity Provider・認証の専門家。OKTAなど）に集約</strong>し、
          各アプリは IdP を信頼する——これが現代の標準（SSO）です。
        </p>
        <ul style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 2, marginBottom: 14, paddingLeft: 20 }}>
          <li><strong style={{ color: 'var(--text-primary)' }}>IdP</strong>（OKTAなど）… 認証の専門家。ログインを引き受け、トークンを発行する</li>
          <li><strong style={{ color: 'var(--text-primary)' }}>ユーザー / ブラウザ</strong> … ログインする本人と、その操作の通り道</li>
          <li><strong style={{ color: 'var(--text-primary)' }}>アプリ (RP)</strong> … IdP に認証を任せる側。トークンを受け取って使う</li>
          <li><strong style={{ color: 'var(--text-primary)' }}>APIサーバー (RS)</strong> … トークンを検証してデータを返す</li>
          <li><strong style={{ color: 'var(--text-primary)' }}>HRシステム</strong> … 入社・異動・退社の源泉。ここからアカウントが生まれる</li>
        </ul>
        <OverviewDiagram />
      </section>

      {/* c) 学習ロードマップ */}
      <section className="step-card">
        <div className="step-head">
          <span className="step-badge">ロードマップ</span>
          <h2>学習ロードマップ — なぜ ① → ② → ③ の順番なのか</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 14 }}>
          {ROADMAP.map(card => {
            const c = APP_COLORS[card.app]
            return (
              <div key={card.badge} style={{
                background: 'var(--bg-inner)',
                border: `1px solid ${c.bd}`,
                borderTop: `3px solid ${c.color}`,
                borderRadius: 'var(--r-md)',
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}>
                <div>
                  <AppBadge app={card.app} label={card.badge} />
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{card.title}</div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.8, flex: 1 }}>{card.body}</p>
                <div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: c.color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                    このアプリで分かるようになること
                  </div>
                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {card.checks.map(chk => (
                      <li key={chk} style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.6, display: 'flex', gap: 6 }}>
                        <span style={{ color: c.color, flexShrink: 0 }}>✓</span>
                        <span>{chk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* d) 用語集 */}
      <section className="step-card">
        <div className="step-head">
          <span className="step-badge">用語集</span>
          <h2>用語集 — 学習前にざっと眺めておく</h2>
          <p>分からない用語が出たらこの表に戻る</p>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead>
              <tr>
                {['用語', '一言説明', '関連アプリ'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left',
                    padding: '8px 10px',
                    borderBottom: '1px solid var(--border-bright)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.68rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TERMS.map(t => (
                <tr key={t.term}>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--border)', color: 'var(--text-primary)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {t.term}
                  </td>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {t.desc}
                  </td>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                    {t.apps.length === 0
                      ? <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>参考</span>
                      : t.apps.map(a => (
                          <AppBadge key={a} app={a} label={a === 'app1' ? '①' : a === 'app2' ? '②' : '③'} />
                        ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* e) 学び方のすすめ */}
      <section className="step-card">
        <div className="step-head">
          <span className="step-badge">学び方</span>
          <h2>学び方のすすめ</h2>
        </div>
        <ol style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 2.1, paddingLeft: 22 }}>
          <li>
            <AppBadge app="app1" label="① OIDC / JWT" /> を<strong style={{ color: 'var(--text-primary)' }}>上から順に</strong>体験する
            （直接発行モードでJWTの構造 → OIDCフローで6ステップ）
          </li>
          <li>
            <AppBadge app="app2" label="② 鍵ローテーション" /> の<strong style={{ color: 'var(--text-primary)' }}>シナリオ STEP1-4</strong> を進め、鍵の一生を追う
          </li>
          <li>
            <AppBadge app="app3" label="③ SCIM" /> の<strong style={{ color: 'var(--text-primary)' }}>シミュレーターでライフサイクルを一周</strong>
            （入社 → 異動 → 退社）
          </li>
        </ol>
        <div className="info-box">
          💡 分からない用語が出てきたら、いつでもこの「🏠 はじめに」タブの用語集に戻ってきてください。
        </div>
      </section>
    </div>
  )
}
