import type { DecodedJWT } from '../types'

// JWT内でカスタム（プライベート）クレームとみなすキーのセット
const CUSTOM_CLAIM_KEYS = new Set(['user.role', 'user.team', 'rag.access', 'cost.budget'])

// 登録済みクレームの説明マップ
const REGISTERED_CLAIM_DESC: Record<string, string> = {
  iss: 'Issuer（発行者）',
  sub: 'Subject（主体/ユーザーID）',
  aud: 'Audience（受信者）',
  iat: 'Issued At（発行日時）',
  exp: 'Expiration（有効期限）',
  jti: 'JWT ID（一意識別子）',
}

function formatClaimValue(key: string, val: unknown): string {
  if ((key === 'iat' || key === 'exp') && typeof val === 'number') {
    const d = new Date(val * 1000)
    return `${val}  ← ${d.toLocaleString('ja-JP')}`
  }
  return JSON.stringify(val)
}

interface JsonRowProps {
  claimKey: string
  value: unknown
  isCustom?: boolean
}

function JsonRow({ claimKey, value, isCustom }: JsonRowProps) {
  const isStr = typeof value === 'string'
  const isNum = typeof value === 'number'
  const valClass = isStr ? 'jwt-json-val-str' : isNum ? 'jwt-json-val-num' : 'jwt-json-val-bool'

  const desc = REGISTERED_CLAIM_DESC[claimKey]

  return (
    <div className={`jwt-json-row${isCustom ? ' jwt-json-custom-row' : ''}`}>
      <span className="jwt-json-key">"{claimKey}"</span>
      <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>:</span>
      <span className={valClass}>{formatClaimValue(claimKey, value)}</span>
      {desc && (
        <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem', marginLeft: 8 }}>
          // {desc}
        </span>
      )}
      {isCustom && (
        <span style={{ color: 'var(--jwt-payload-color)', fontSize: '0.68rem', marginLeft: 8 }}>
          ★ カスタムクレーム（ABAC用）
        </span>
      )}
    </div>
  )
}

interface Props {
  decoded: DecodedJWT
  expiresAt: number | null
}

export function JwtVisualizer({ decoded, expiresAt }: Props) {
  const now = Math.floor(Date.now() / 1000)
  const remaining = expiresAt ? expiresAt - now : null
  const isExpired = remaining !== null && remaining <= 0
  const isWarn = remaining !== null && remaining > 0 && remaining < 60

  return (
    <div className="step-card">
      <div className="step-head">
        <span className="step-badge">STEP 2</span>
        <h2>JWTの中身を解析する</h2>
        <p>JWT = Header.Payload.Signature の3パーツ構造</p>
      </div>

      {/* ─── Raw JWT 色分け表示 ─── */}
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
        ▼ Base64URLエンコードされた生のJWT文字列（ドット区切りで3分割）
      </div>
      <div className="jwt-raw">
        <span className="jwt-part-header">{decoded.rawHeader}</span>
        <span className="jwt-part-dot">.</span>
        <span className="jwt-part-payload">{decoded.rawPayload}</span>
        <span className="jwt-part-dot">.</span>
        <span className="jwt-part-signature">{decoded.rawSignature}</span>
      </div>

      {/* 凡例 */}
      <div className="jwt-legend">
        <div className="jwt-legend-item">
          <div className="jwt-legend-dot" style={{ background: 'var(--jwt-header-color)' }} />
          <span>Header（アルゴリズム宣言）</span>
        </div>
        <div className="jwt-legend-item">
          <div className="jwt-legend-dot" style={{ background: 'var(--jwt-payload-color)' }} />
          <span>Payload（クレーム / ユーザー属性）</span>
        </div>
        <div className="jwt-legend-item">
          <div className="jwt-legend-dot" style={{ background: 'var(--jwt-sig-color)' }} />
          <span>Signature（秘密鍵によるRS256署名）</span>
        </div>
      </div>

      {/* 有効期限インジケーター */}
      {remaining !== null && (
        <div className={`expiry-bar ${isExpired ? 'expiry-expired' : isWarn ? 'expiry-warn' : 'expiry-ok'}`}>
          {isExpired
            ? '⛔ このJWTは期限切れです。API呼び出しは 401 Unauthorized になります'
            : isWarn
            ? `⚠️ 有効期限まで残り ${remaining}秒`
            : `✅ 有効期限まで残り ${remaining}秒`}
        </div>
      )}

      <hr className="divider" />

      {/* ─── 3セクション詳細 ─── */}
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
        ▼ 各パーツをBase64URLデコードした内容
      </div>
      <div className="jwt-sections">
        {/* HEADER */}
        <div className="jwt-section jwt-section-header-card">
          <div className="jwt-section-title">① Header</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <JsonRow claimKey="alg" value={decoded.header.alg} />
            <JsonRow claimKey="typ" value={decoded.header.typ} />
          </div>
          <div className="info-box" style={{ marginTop: 10, fontSize: '0.72rem' }}>
            <strong>alg: RS256</strong><br />
            RSA + SHA-256。秘密鍵で署名し公開鍵で検証。HS256と違い秘密鍵をAPIサーバーに渡さなくてよい。
          </div>
        </div>

        {/* PAYLOAD */}
        <div className="jwt-section jwt-section-payload-card">
          <div className="jwt-section-title">② Payload（クレーム）</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {Object.entries(decoded.payload).map(([k, v]) => (
              <JsonRow key={k} claimKey={k} value={v} isCustom={CUSTOM_CLAIM_KEYS.has(k)} />
            ))}
          </div>
          <div className="info-box" style={{ marginTop: 10, fontSize: '0.72rem' }}>
            <strong>★ マーク</strong>はABAC用のカスタムクレーム。<br />
            このデータはBase64URLエンコードされているだけで<strong>暗号化されていない</strong>。<br />
            誰でもデコードして読める → 機密情報はJWTに入れないこと。
          </div>
        </div>

        {/* SIGNATURE */}
        <div className="jwt-section jwt-section-sig-card">
          <div className="jwt-section-title">③ Signature</div>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.68rem',
            color: 'var(--jwt-sig-color)',
            wordBreak: 'break-all',
            lineHeight: 1.6,
          }}>
            {decoded.rawSignature}
          </div>
          <div className="info-box" style={{ marginTop: 10, fontSize: '0.72rem' }}>
            <strong>生成式:</strong><br />
            RSASHA256(<br />
            &nbsp;&nbsp;Base64URL(Header)<br />
            &nbsp;&nbsp;+ "." +<br />
            &nbsp;&nbsp;Base64URL(Payload),<br />
            &nbsp;&nbsp;秘密鍵<br />
            )<br /><br />
            Payloadを1文字でも変更すると署名が一致せず<strong>401 InvalidSignature</strong>になる。
          </div>
        </div>
      </div>
    </div>
  )
}
