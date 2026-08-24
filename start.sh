#!/usr/bin/env bash
# WSL / Linux 一鍵啟動 Dashboard + API（對應 Windows 的 start.cmd）
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"
PORT="${PORT:-3000}"

if ! command -v node >/dev/null; then
  echo "[ERR] 找不到 node" >&2
  exit 1
fi

if [[ ! -d node_modules ]]; then
  npm install
fi

if curl -fsS "http://127.0.0.1:${PORT}/api/v1/health" >/dev/null 2>&1; then
  echo "[OK] 服務已在 http://127.0.0.1:${PORT} 運作"
  exit 0
fi

echo "[..] 啟動開發伺服器（第一次會爬三家，約 1 分鐘）"
exec npm run dev
