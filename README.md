# 認証認可 学習ラボ

OIDC / JWT / JWKS鍵ローテーション / SCIM を、動かしながら学べる統合デモアプリです。
「🏠 はじめに」タブに認証認可の基礎・全体地図・学習ロードマップ・用語集が入っているので、そこから読み始めてください。

| タブ | 内容 | Backend |
|---|---|---|
| 🏠 はじめに | 認証認可とは・全体地図・学習ロードマップ・用語集 | なし |
| ① OIDC / JWT | JWT直接発行 + OIDC Authorization Code Flow | backends/oidc (port 8000) |
| ② 鍵ローテーション | JWKS鍵管理・ローテーションシナリオ・ワークベンチ | backends/rotation (port 8001) |
| ③ SCIM プロビジョニング | OKTAによるユーザー自動プロビジョニング | backends/scim (port 8002) |

## 構成

```
auth-learning-lab/
├── start.sh          # backend×3 + frontend を一括起動（初回セットアップも自動）
├── README.md
├── backends/
│   ├── oidc/         # FastAPI: OIDC IdP モック（port 8000）
│   ├── rotation/     # FastAPI: JWKS + 鍵ローテーション（port 8001）
│   └── scim/         # FastAPI: SCIM 2.0 サーバーモック（port 8002）
└── frontend/         # Vite + React + TypeScript（port 5173）
    └── src/
        ├── App.tsx       # タブ切り替え
        ├── App.css       # 統合CSS（②③はスコープ付き）
        └── apps/
            ├── guide/    # 🏠 はじめに（学習ガイド）
            ├── oidc/     # App①
            ├── rotation/ # App②
            └── scim/     # App③
```

## 起動方法

```bash
./start.sh
```

これだけです。初回は自動で各 backend の `.venv` 作成・`pip install`・`npm install` が走ります（数分かかります）。

→ http://localhost:5173 を開く。Ctrl+C で全プロセス停止。

必要環境: Python 3.10+ / Node.js 18+

## 注意

- frontend は **5173 ポート固定**で起動してください。各 backend の CORS 許可は
  5173〜5175（SCIMは5176まで）に限定されています。5173 が他プロセスに使われていると
  Vite がポートをずらし、CORS エラーになります。
- App① の「直接発行モード」は Vite の dev proxy（`/idp`, `/api`, `/public-key` → 8000）
  を経由するため、`npm run dev`（start.sh 経由）での利用が前提です。
- 全データはインメモリ管理です。backend を再起動するとリセットされます。
