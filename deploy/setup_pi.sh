#!/usr/bin/env bash
# AI Council · preparación de un nodo Raspberry Pi según su rol.
#
# Uso:
#   sudo [VARIABLES] bash setup_pi.sh <lobby|ocelote|erizo|panda>
#
# Variables opcionales:
#   TS_AUTHKEY=tskey-auth-...   clave de autenticación de Tailscale (si no, imprime un enlace para iniciar sesión)
#   TS_TAGS=tag:council         etiqueta de Tailscale (solo si ya definiste tagOwners en tus ACL)
#   TS_SSH=1                    activa Tailscale SSH
#   MODEL=qwen3:1.7b            fuerza el modelo a descargar (por defecto se elige según el rol y la RAM)
#   EMBED=1                     descarga también el modelo de embeddings (qwen3-embedding:0.6b)
#   KIOSK=1                     (solo lobby) instala el navegador en modo kiosco para una pantalla conectada
#   SKIP_UPGRADE=1              omite apt full-upgrade
#
# Pensado para Raspberry Pi OS Lite. Ollama necesita 64 bits: ocelote, erizo y panda deben ser aarch64.
# El lobby (Pi 2 B) es de 32 bits y no ejecuta modelos.

set -euo pipefail

say() { printf '\n\033[1;33m== %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

ROL="${1:-}"
case "$ROL" in
  lobby|ocelote|erizo|panda) ;;
  *) die "uso: sudo bash $0 <lobby|ocelote|erizo|panda>" ;;
esac
[ "$(id -u)" -eq 0 ] || die "ejecuta con sudo."

ARCH="$(uname -m)"
if [ "$ROL" != "lobby" ] && [ "$ARCH" != "aarch64" ]; then
  die "$ROL necesita un sistema de 64 bits (aarch64) y este equipo es $ARCH. Vuelve a grabar la tarjeta con Raspberry Pi OS Lite (64-bit)."
fi
RAM_MB="$(awk '/MemTotal/ {printf "%d", $2/1024}' /proc/meminfo)"
KUSER="${SUDO_USER:-pi}"
export DEBIAN_FRONTEND=noninteractive

# ---------------------------------------------------------------- 1. base
say "1/5 Sistema base (${ROL}, ${ARCH}, ${RAM_MB} MB de RAM)"
apt-get update
if [ "${SKIP_UPGRADE:-0}" != "1" ]; then apt-get -y full-upgrade; fi
apt-get install -y curl ca-certificates git jq tmux htop sqlite3 ufw zram-tools

if [ "$(hostname)" != "$ROL" ]; then
  hostnamectl set-hostname "$ROL"
  if grep -q '^127.0.1.1' /etc/hosts; then
    sed -i "s/^127.0.1.1.*/127.0.1.1\t${ROL}/" /etc/hosts
  else
    printf '127.0.1.1\t%s\n' "$ROL" >> /etc/hosts
  fi
fi

printf 'ALGO=lz4\nPERCENT=50\n' > /etc/default/zramswap
systemctl enable zramswap >/dev/null 2>&1 || true
systemctl restart zramswap >/dev/null 2>&1 || true

# ---------------------------------------------------------------- 2. tailscale
say "2/5 Tailscale"
if ! command -v tailscale >/dev/null 2>&1; then
  curl -fsSL https://tailscale.com/install.sh | sh
fi
systemctl enable --now tailscaled
TS_ARGS=(--hostname="$ROL")
if [ -n "${TS_AUTHKEY:-}" ]; then TS_ARGS+=(--auth-key="$TS_AUTHKEY"); fi
if [ -n "${TS_TAGS:-}" ]; then TS_ARGS+=(--advertise-tags="$TS_TAGS"); fi
if [ "${TS_SSH:-0}" = "1" ]; then TS_ARGS+=(--ssh); fi
echo "Si no diste TS_AUTHKEY, abre en un navegador el enlace que aparece abajo para autorizar este nodo."
tailscale up "${TS_ARGS[@]}"
TS_IP="$(tailscale ip -4 | head -n1)"
echo "IP de Tailscale: ${TS_IP}"

# ---------------------------------------------------------------- 3. firewall
say "3/5 Firewall (solo SSH y la red de Tailscale)"
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'ssh'
ufw allow in on tailscale0 comment 'tailnet'
ufw --force enable

# ---------------------------------------------------------------- 4. rol
install_ollama() {
  say "4/5 Ollama (${ROL})"
  if ! command -v ollama >/dev/null 2>&1; then
    curl -fsSL https://ollama.com/install.sh | sh
  fi
  mkdir -p /etc/systemd/system/ollama.service.d
  cat > /etc/systemd/system/ollama.service.d/council.conf <<'EOF'
[Unit]
After=network-online.target tailscaled.service
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
Environment="OLLAMA_KEEP_ALIVE=10m"
Environment="OLLAMA_MAX_LOADED_MODELS=1"
Environment="OLLAMA_NUM_PARALLEL=1"
Environment="OLLAMA_CONTEXT_LENGTH=2048"
EOF
  systemctl daemon-reload
  systemctl enable ollama
  systemctl restart ollama
  for _ in $(seq 1 30); do
    curl -fs http://127.0.0.1:11434/api/version >/dev/null && break
    sleep 2
  done
  curl -fs http://127.0.0.1:11434/api/version >/dev/null || die "Ollama no respondió. Revisa: journalctl -u ollama -n 50"

  if [ -z "${MODEL:-}" ]; then
    case "$ROL" in
      ocelote) if [ "$RAM_MB" -ge 7000 ]; then MODEL="qwen3:4b"; else MODEL="qwen3:1.7b"; fi ;;
      *)       MODEL="qwen3:0.6b" ;;
    esac
  fi
  say "Descargando ${MODEL}"
  ollama pull "$MODEL"
  if [ "${EMBED:-0}" = "1" ]; then ollama pull qwen3-embedding:0.6b; fi

  say "Prueba rápida"
  curl -s http://127.0.0.1:11434/api/generate \
    -d "{\"model\":\"${MODEL}\",\"prompt\":\"Di hola en una frase corta. /no_think\",\"stream\":false,\"options\":{\"num_predict\":32,\"num_ctx\":2048}}" \
    | jq -r '.response // .error' || true
}

install_lobby() {
  say "4/5 Lobby (servicio web, MQTT y datos)"
  apt-get install -y mosquitto mosquitto-clients python3-venv python3-pip
  cat > /etc/mosquitto/conf.d/council.conf <<'EOF'
# Acceso anónimo: el firewall (ufw) deja entrar solo por la red de Tailscale y SSH.
listener 1883
allow_anonymous true
EOF
  systemctl enable mosquitto
  systemctl restart mosquitto

  id council >/dev/null 2>&1 || useradd --system --home /opt/council --shell /usr/sbin/nologin council
  mkdir -p /opt/council/app /opt/council/data /opt/council/backups
  chown -R council:council /opt/council
  runuser -u council -- python3 -m venv /opt/council/venv
  runuser -u council -- /opt/council/venv/bin/pip install --quiet flask paho-mqtt

  # Servicio del lobby (Flask + SQLite + web). El código se despliega con deploy/deploy_lobby.sh
  cat > /etc/systemd/system/council-lobby.service <<'UNIT'
[Unit]
Description=AI Council - lobby (API, ciclo de conexión y web)
After=network-online.target mosquitto.service
[Service]
User=council
WorkingDirectory=/opt/council/app/server
Environment=COUNCIL_DB=/opt/council/data/council.db
Environment=COUNCIL_PORT=8080
ExecStart=/opt/council/venv/bin/python -m council
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
UNIT
  systemctl daemon-reload
  systemctl enable council-lobby
  if [ -f /opt/council/app/server/council/__main__.py ]; then
    systemctl restart council-lobby
  else
    echo "Aún no hay código en /opt/council/app: despliégalo desde tu computador con deploy/deploy_lobby.sh"
  fi

  if [ "${KIOSK:-0}" = "1" ]; then
    say "Kiosco (cage + Chromium) en la pantalla conectada"
    apt-get install -y cage
    apt-get install -y chromium-browser || apt-get install -y chromium
    CHROMIUM="$(command -v chromium-browser || command -v chromium)"
    cat > /etc/systemd/system/council-kiosk.service <<EOF
[Unit]
Description=AI Council - kiosco (cage + Chromium)
After=council-lobby.service systemd-user-sessions.service
[Service]
User=${KUSER}
PAMName=login
TTYPath=/dev/tty7
StandardInput=tty-fail
StandardOutput=journal
Environment=XDG_RUNTIME_DIR=/run/user/$(id -u "$KUSER")
ExecStart=/usr/bin/cage -s -- ${CHROMIUM} --kiosk --noerrdialogs --disable-infobars --ozone-platform=wayland http://localhost:8080/
Restart=always
[Install]
WantedBy=multi-user.target
EOF
    systemctl daemon-reload
    systemctl enable council-kiosk
    echo "Kiosco instalado. Se inicia en el próximo arranque (o: sudo systemctl start council-kiosk)."
  fi
}

case "$ROL" in
  lobby) install_lobby ;;
  *)     install_ollama ;;
esac

# ---------------------------------------------------------------- 5. resumen
say "5/5 Listo: ${ROL}"
echo "Tailscale : ${TS_IP}  (nombre: ${ROL})"
case "$ROL" in
  lobby) echo "Lobby     : http://${ROL}:8080/  (código: deploy/deploy_lobby.sh USUARIO@${ROL})"
         echo "MQTT      : ${ROL}:1883" ;;
  *)     echo "Ollama    : http://${ROL}:11434   (modelo: ${MODEL})" ;;
esac
echo "Pendiente en la consola de Tailscale: desactivar la caducidad de clave de este nodo (Machines > ··· > Disable key expiry)."
