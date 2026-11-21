#!/data/data/com.termux/files/usr/bin/bash
# AI Council · preparación de un celular (Termux) como nodo con Ollama.
#
# Uso (dentro de Termux):
#   bash setup_termux.sh <buho|kakapo> <IP_DE_TAILSCALE>
#
# La IP (100.x.y.z) se ve en la app de Tailscale del celular. Ollama se enlaza solo a esa IP,
# así no queda expuesto en la red Wi-Fi.
# Variables opcionales:  MODEL=qwen3:1.7b   (por defecto: buho -> qwen3:0.6b, kakapo -> solo embeddings)
#
# Requisitos previos: app de Tailscale instalada e iniciada en el celular; Termux y Termux:Boot
# instalados desde F-Droid (las versiones de Play Store de Termux están desactualizadas).

set -euo pipefail

say() { printf '\n== %s\n' "$*"; }
die() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

ROL="${1:-}"
TS_IP="${2:-}"
case "$ROL" in buho|kakapo) ;; *) die "uso: bash $0 <buho|kakapo> <IP_DE_TAILSCALE>" ;; esac
[ -n "$TS_IP" ] || die "falta la IP de Tailscale (100.x.y.z) como segundo argumento."
case "$TS_IP" in 100.*) ;; *) die "esa IP no parece de Tailscale (debe empezar con 100.)" ;; esac

say "1/4 Paquetes"
pkg update -y
pkg upgrade -y
pkg install -y tmux curl jq termux-api openssh
command -v ollama >/dev/null 2>&1 || pkg install -y ollama

case "$ROL" in
  buho)   MODEL="${MODEL:-qwen3:0.6b}"; EMBED=1 ;;
  kakapo) MODEL="${MODEL:-}";           EMBED=1 ;;
esac

say "2/4 Script de arranque"
START="$HOME/council-start.sh"
cat > "$START" <<EOF
#!/data/data/com.termux/files/usr/bin/bash
# Mantiene el celular despierto y levanta Ollama enlazado a la IP de Tailscale.
termux-wake-lock
export OLLAMA_HOST=${TS_IP}:11434
export OLLAMA_KEEP_ALIVE=10m
export OLLAMA_MAX_LOADED_MODELS=1
export OLLAMA_NUM_PARALLEL=1
export OLLAMA_CONTEXT_LENGTH=2048
tmux has-session -t council 2>/dev/null && exit 0
# Si Tailscale aún no tiene la IP lista, ollama falla al enlazar: se reintenta cada 10 s.
tmux new-session -d -s council 'until ollama serve; do sleep 10; done'
EOF
chmod +x "$START"

mkdir -p "$HOME/.termux/boot"
cp "$START" "$HOME/.termux/boot/council-start.sh"
chmod +x "$HOME/.termux/boot/council-start.sh"

say "3/4 Arrancando Ollama"
bash "$START"
for _ in $(seq 1 30); do
  curl -fs "http://${TS_IP}:11434/api/version" >/dev/null && break
  sleep 2
done
curl -fs "http://${TS_IP}:11434/api/version" >/dev/null \
  || die "Ollama no respondió en ${TS_IP}:11434. ¿Está encendido Tailscale? Mira: tmux attach -t council"

export OLLAMA_HOST="${TS_IP}:11434"
if [ -n "$MODEL" ]; then say "Descargando ${MODEL}"; ollama pull "$MODEL"; fi
if [ "$EMBED" = "1" ]; then ollama pull qwen3-embedding:0.6b; fi

say "4/4 Listo: ${ROL}"
echo "Ollama : http://${TS_IP}:11434"
echo "Ver el servicio : tmux attach -t council   (salir sin cerrarlo: Ctrl+B y luego D)"
echo "Pendiente en Android: batería de Termux en 'Sin restricciones' y desactivar el monitor de procesos fantasma (ver README)."
