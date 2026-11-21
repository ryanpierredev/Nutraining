#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${API_SERVICE:?Defina API_SERVICE com o nome da unidade systemd existente}"
[[ -z "$(git status --porcelain)" ]] || { echo 'Checkout com alterações locais. Preserve-as antes de atualizar.' >&2; exit 1; }
[[ "$(git branch --show-current)" == main ]] || { echo 'Execute na branch main após o merge.' >&2; exit 1; }
git pull --ff-only origin main
cd api
npm ci --omit=dev
node --env-file=.env migrate.mjs
sudo systemctl restart "$API_SERVICE"
node --env-file=.env --input-type=module <<'JS'
let ready = false;
for (let attempt = 0; attempt < 15; attempt++) {
  try {
    const response = await fetch(`http://127.0.0.1:${process.env.PORT || 3001}/health`, { signal: AbortSignal.timeout(3000) });
    const body = await response.json();
    if (response.ok && body.status === 'ok' && body.database === 'connected') { ready = true; break; }
  } catch { /* Wait for systemd startup. */ }
  await new Promise(resolve => setTimeout(resolve, 1000));
}
if (!ready) { console.error('API ou banco indisponível após atualização. Consulte journalctl.'); process.exit(1); }
console.log('API atualizada; PostgreSQL conectado.');
JS
