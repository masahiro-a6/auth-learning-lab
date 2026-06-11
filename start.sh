#!/bin/bash
# 認証認可 学習ラボ — 統合起動スクリプト
# backends/ 配下の3 backend (8000/8001/8002) と frontend (5173) を起動する
# .venv / node_modules がなければ初回に自動セットアップする

set -u

ROOT="$(cd "$(dirname "$0")" && pwd)"
FRONTEND="$ROOT/frontend"

PIDS=()

cleanup() {
  echo ""
  echo "停止中..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null
  done
  exit 0
}
trap cleanup INT TERM

start_backend() {
  local dir="$1"
  local port="$2"
  local name="$3"
  echo "▶ $name (port $port) を起動..."
  (
    cd "$dir" || exit 1
    if [ ! -d ".venv" ]; then
      echo "  初回セットアップ: $name の .venv を作成中..."
      python3 -m venv .venv
      ./.venv/bin/pip install -q -r requirements.txt
    fi
    # shellcheck disable=SC1091
    source ".venv/bin/activate"
    exec uvicorn main:app --host 0.0.0.0 --port "$port"
  ) &
  PIDS+=($!)
}

start_backend "$ROOT/backends/oidc"     8000 "① OIDC / JWT backend"
start_backend "$ROOT/backends/rotation" 8001 "② 鍵ローテーション backend"
start_backend "$ROOT/backends/scim"     8002 "③ SCIM backend"

echo "▶ 統合 frontend (port 5173) を起動..."
(
  cd "$FRONTEND" || exit 1
  if [ ! -d "node_modules" ]; then
    echo "  初回セットアップ: npm install 実行中..."
    npm install
  fi
  exec npm run dev
) &
PIDS+=($!)

echo ""
echo "=========================================="
echo " 認証認可 学習ラボ"
echo "   Frontend: http://localhost:5173"
echo "   Backends: 8000 / 8001 / 8002"
echo " Ctrl+C で全プロセスを停止"
echo "=========================================="
wait
