#!/usr/bin/env bash
# Actualiza la aplicación en el servidor (EC2 o VM de Azure) después de hacer cambios en GitHub.
# Uso: bash despliegue/actualizar.sh
set -euo pipefail
cd "$(dirname "$0")/.."
[[ -d .git ]] && git pull   # si copiaste un .zip, no hay git: solo reinstala y recompila
npm ci --omit=dev
(cd frontend && npm ci && npm run build)
pm2 reload red-social-insta
echo "Aplicación actualizada."
