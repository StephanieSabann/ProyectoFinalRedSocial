#!/usr/bin/env bash
# ==================================================================
#  Instalación en un servidor Ubuntu 24.04:
#   - AWS EC2 t2.small (usuario ubuntu)  o
#   - Máquina virtual de Azure (usuario azureuser)
#
#  Uso (conectado por SSH a la instancia):
#     git clone https://github.com/USUARIO/RedSocial_Insta.git
#     cd RedSocial_Insta
#     sudo bash despliegue/instalar-ec2.sh midominio.com
#     (en Azure sin dominio propio: sudo bash despliegue/instalar-ec2.sh minombre.eastus.cloudapp.azure.com)
#
#  Antes de ejecutar:
#   - Crea la base en SQL Server (RDS o Azure) con los scripts de basededatos/sqlserver.
#   - Crea el archivo .env (copia .env.example) con los datos de SQL Server, S3,
#     Google y reCAPTCHA. Ver docs/02-instrucciones-despliegue.md
#   - El dominio debe apuntar a la IP pública del servidor (Route 53, Azure DNS
#     o la etiqueta DNS gratuita de la IP pública de Azure).
# ==================================================================
set -euo pipefail

DOMINIO="${1:-}"
CARPETA="$(cd "$(dirname "$0")/.." && pwd)"
USUARIO_APP="${SUDO_USER:-ubuntu}"

echo "==> 1/8 Actualizando el sistema"
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y

echo "==> 2/8 Memoria de intercambio de 2 GB (Sharp necesita memoria en una t2.small)"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> 3/8 Node.js 20, Nginx y Certbot"
if ! command -v node >/dev/null || [[ "$(node -v)" != v20* && "$(node -v)" != v22* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
apt-get install -y nginx certbot python3-certbot-nginx unzip
npm install -g pm2
mkdir -p /var/log/red-social && chown "$USUARIO_APP":"$USUARIO_APP" /var/log/red-social

echo "==> 4/8 Comprobando la conexión a SQL Server (RDS o Azure SQL)"
if [[ ! -f "$CARPETA/.env" ]]; then
  echo "    Falta el archivo .env. Copia .env.example como .env y llénalo." >&2
  exit 1
fi
echo "    La base de datos se crea antes con los scripts de basededatos/sqlserver (ver docs/02)."

echo "==> 5/8 Dependencias y compilación del frontend React"
cd "$CARPETA"
sudo -u "$USUARIO_APP" npm ci --omit=dev
sudo -u "$USUARIO_APP" bash -c "cd frontend && npm ci && npm run build"

echo "==> 6/8 Iniciar la aplicación con PM2 (se reinicia sola si falla o si la EC2 se reinicia)"
sudo -u "$USUARIO_APP" pm2 start despliegue/ecosystem.config.js --env production
sudo -u "$USUARIO_APP" pm2 save
env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$USUARIO_APP" --hp "/home/$USUARIO_APP" >/dev/null

echo "==> 7/8 Nginx como proxy inverso"
cp despliegue/nginx.conf /etc/nginx/sites-available/red-social
if [[ "$DOMINIO" == *.cloudapp.azure.com ]]; then
  sed -i "s/ www\.DOMINIO_AQUI//" /etc/nginx/sites-available/red-social
fi
sed -i "s/DOMINIO_AQUI/${DOMINIO:-_}/g" /etc/nginx/sites-available/red-social
ln -sf /etc/nginx/sites-available/red-social /etc/nginx/sites-enabled/red-social
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "==> 8/8 HTTPS con Let's Encrypt (requiere que el dominio ya apunte a esta IP)"
if [[ -n "$DOMINIO" ]]; then
  # Un dominio propio lleva también www.; un nombre de Azure (*.cloudapp.azure.com) no
  NOMBRES=(-d "$DOMINIO")
  [[ "$DOMINIO" != *.cloudapp.azure.com && "$DOMINIO" != www.* ]] && NOMBRES+=(-d "www.$DOMINIO")
  certbot --nginx "${NOMBRES[@]}" --non-interactive --agree-tos --register-unsafely-without-email --redirect || \
    echo "    No se pudo obtener el certificado todavía. Ejecuta luego: sudo certbot --nginx ${NOMBRES[*]}"
fi

echo ""
echo "Listo. Comprueba: curl http://localhost:3000/salud"
echo "Sitio: http://${DOMINIO:-<IP-de-la-instancia>}"
