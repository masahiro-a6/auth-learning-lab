// 各アプリの先頭に置く「認証認可のどこの話か」位置づけバナー
export function PositionBanner({ color, scope, detail, order }: {
  color: string
  scope: string
  detail: string
  order: string
}) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${color}`,
      borderRadius: 'var(--r-md)',
      padding: '12px 16px',
      marginBottom: 20,
      fontSize: '0.8rem',
      lineHeight: 1.7,
    }}>
      <div style={{ color: 'var(--text-primary)' }}>
        <span style={{
          fontSize: '0.62rem',
          fontWeight: 800,
          letterSpacing: '0.08em',
          padding: '2px 8px',
          borderRadius: 99,
          color,
          border: `1px solid ${color}55`,
          marginRight: 8,
          whiteSpace: 'nowrap',
        }}>
          全体地図のうち
        </span>
        <strong style={{ color }}>{scope}</strong> の部分。{detail}
      </div>
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.74rem' }}>
        {order}（迷ったら「🏠 はじめに」タブへ）
      </div>
    </div>
  )
}
