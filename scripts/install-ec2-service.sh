#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
for tool in node npm git ss systemctl sudo sed readlink; do
  command -v "$tool" >/dev/null || { echo "Ferramenta necessária ausente: $tool" >&2; exit 1; }
done
ROOT=$(pwd -P)
APP_USER=$(id -un)
NODE=$(command -v node)
NODE=$(readlink -f "$NODE")
[[ "$EUID" -ne 0 ]] || { echo 'Execute como ubuntu, sem sudo; o script solicita sudo apenas para instalar o serviço.' >&2; exit 1; }
# Paths are rendered into a systemd unit, so reject unsupported characters.
[[ "$ROOT" =~ ^/[a-zA-Z0-9_./-]+$ && "$NODE" =~ ^/[a-zA-Z0-9_./-]+$ && "$APP_USER" =~ ^[a-zA-Z0-9_-]+$ ]] || { echo 'Caminho ou usuário não suportado.' >&2; exit 1; }
[[ -f api/.env ]] || { echo 'Falta api/.env com a configuração existente do PostgreSQL. Não copie senhas para o Git.' >&2; exit 1; }
node -e 'if (Number(process.versions.node.split(".")[0]) < 24) { console.error("Use Node.js 24 ou superior."); process.exit(1); }'
[[ -z "$(git status --porcelain)" ]] || { echo 'Preserve as alterações locais antes de instalar.' >&2; exit 1; }
# Refuse to take over an occupied port, including a previously started API.
if ss -H -ltn 'sport = :3101' | grep -q .; then
  echo 'Porta 3101 ocupada. Identifique o processo antes de instalar; para atualizar um serviço existente use update-ec2.sh.' >&2
  exit 1
fi
if systemctl cat nutraining-api.service >/dev/null 2>&1; then
  echo 'nutraining-api.service já existe; use scripts/update-ec2.sh.' >&2
  exit 1
fi
sudo -v
cd api
npm ci --omit=dev
node --env-file=.env migrate.mjs
cd ..
UNIT=$(mktemp)
trap 'rm -f "$UNIT"' EXIT
sed -e "s|@USER@|$APP_USER|g" -e "s|@ROOT@|$ROOT|g" -e "s|@NODE@|$NODE|g" deploy/nutraining-api.service.in > "$UNIT"
sudo install -m 644 "$UNIT" /etc/systemd/system/nutraining-api.service
sudo systemctl daemon-reload
sudo systemctl enable --now nutraining-api.service
cd api
PORT=3101 node --env-file=.env check-health.mjs
