// SCIM vs OIDC の概念説明パネル

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

        {/* フロー図 */}
        <div style={{
          padding: '10px 14px',
          background: 'var(--bg-inner)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-sm)',
          fontFamily: "'JetBrains Mono',monospace",
          fontSize: '0.72rem',
          lineHeight: 2,
          color: 'var(--text-muted)',
        }}>
          <div style={{ marginBottom: 4, color: 'var(--text-secondary)', fontWeight: 600, fontFamily: 'inherit' }}>
            入社時の典型的なフロー（OKTA 導入後）
          </div>
          <div>
            <span style={{ color: 'var(--warn)' }}>HR システム</span>
            {' → '}
            <span style={{ color: 'var(--purple)' }}>OKTA</span>
            {' ──SCIM POST /scim/v2/Users──→ '}
            <span style={{ color: 'var(--success)' }}>社内アプリ（アカウント自動作成）</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>（数分後）新入社員が初回ログイン</span>
          </div>
          <div>
            <span style={{ color: 'var(--warn)' }}>ブラウザ</span>
            {' ──OIDC Authorization Code Flow──→ '}
            <span style={{ color: 'var(--purple)' }}>OKTA</span>
            {' ──JWT──→ '}
            <span style={{ color: 'var(--success)' }}>社内アプリ</span>
          </div>
          <div style={{ marginTop: 6, color: 'rgba(148,163,184,0.5)', fontSize: '0.65rem' }}>
            ※ SCIM でアカウントが先に作られているから、初回ログインでも既に権限が設定済み
          </div>
        </div>

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
