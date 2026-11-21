#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
API_SERVICE=${API_SERVICE:-nutraining-api.service}
[[ -z "$(git status --porcelain)" ]] || { echo 'Checkout com alterações locais. Preserve-as antes de atualizar.' >&2; exit 1; }
[[ "$(git branch --show-current)" == main ]] || { echo 'Execute na branch main após o merge.' >&2; exit 1; }
git pull --ff-only origin main
cd api
npm ci --omit=dev
node --env-file=.env migrate.mjs
sudo systemctl restart "$API_SERVICE"
if [[ "$API_SERVICE" == nutraining-api.service ]]; then
  export PORT=3101
fi
node --env-file=.env check-health.mjs
