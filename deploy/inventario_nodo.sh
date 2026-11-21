#!/bin/sh
# AI Council - SEB-25: inventario y mini-benchmark de un nodo.
# Solo LEE informacion del sistema (no instala ni modifica nada).
# Funciona en Raspberry Pi OS y en Termux (Android).
#
# Uso:
#   sh inventario_nodo.sh                 -> solo inventario
#   sh inventario_nodo.sh qwen3:1.7b      -> inventario + prueba de velocidad con ese modelo
#                                            (requiere Ollama corriendo en este equipo)

MODELO="$1"
OLLAMA_URL="${OLLAMA_HOST:-http://127.0.0.1:11434}"

echo "=== NODO: $(hostname 2>/dev/null || echo desconocido) ==="
echo "fecha: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Modelo de placa (Raspberry Pi) o dispositivo Android
if [ -r /proc/device-tree/model ]; then
  echo "placa: $(tr -d '\0' < /proc/device-tree/model)"
fi
if command -v getprop >/dev/null 2>&1; then
  echo "android: $(getprop ro.product.manufacturer) $(getprop ro.product.model) (Android $(getprop ro.build.version.release))"
fi

# Arquitectura y bits del userland (clave: Ollama necesita 64 bits / aarch64)
ARCH="$(uname -m)"
echo "arquitectura: $ARCH"
case "$ARCH" in
  aarch64|arm64|x86_64) echo "userland: 64 bits -> Ollama compatible" ;;
  armv7*|armv6*|arm*)   echo "userland: 32 bits -> Ollama NO corre aqui (solo llama.cpp compilado a mano)" ;;
  *)                    echo "userland: desconocido" ;;
esac
if command -v getconf >/dev/null 2>&1; then echo "LONG_BIT: $(getconf LONG_BIT)"; fi

# CPU
NCPU="$(grep -c '^processor' /proc/cpuinfo 2>/dev/null)"
echo "nucleos: ${NCPU:-?}"
grep -m1 -E 'Model name|Hardware|model name' /proc/cpuinfo 2>/dev/null

# Memoria (desde /proc/meminfo, sirve tambien en Termux)
awk '/MemTotal/ {printf "RAM total: %.0f MB\n", $2/1024}
     /MemAvailable/ {printf "RAM disponible ahora: %.0f MB\n", $2/1024}
     /SwapTotal/ {printf "swap: %.0f MB\n", $2/1024}' /proc/meminfo 2>/dev/null

# Disco libre en el directorio actual
df -h . 2>/dev/null | awk 'NR==2 {print "disco libre aqui: " $4 " de " $2}'

# Temperatura (Raspberry Pi)
if [ -r /sys/class/thermal/thermal_zone0/temp ]; then
  awk '{printf "temperatura CPU: %.1f C\n", $1/1000}' /sys/class/thermal/thermal_zone0/temp
fi
if command -v vcgencmd >/dev/null 2>&1; then echo "throttling: $(vcgencmd get_throttled 2>/dev/null)"; fi

# Ollama
if command -v ollama >/dev/null 2>&1; then
  echo "ollama: $(ollama --version 2>/dev/null | head -n1)"
  echo "modelos instalados:"; ollama list 2>/dev/null | sed 's/^/  /'
else
  echo "ollama: no encontrado en PATH"
fi

# Mini-benchmark opcional via API de Ollama
if [ -n "$MODELO" ]; then
  echo "--- benchmark con $MODELO (prompt corto, 64 tokens max) ---"
  RESP="$(curl -s --max-time 600 "$OLLAMA_URL/api/generate" \
    -d "{\"model\":\"$MODELO\",\"prompt\":\"Di hola en una frase corta.\",\"stream\":false,\"options\":{\"num_predict\":64,\"num_ctx\":2048}}")"
  if [ -z "$RESP" ]; then
    echo "sin respuesta de Ollama en $OLLAMA_URL (esta corriendo? el modelo esta descargado?)"
  elif command -v python3 >/dev/null 2>&1; then
    printf '%s' "$RESP" | python3 -I -c '
import sys, json
try:
    r = json.load(sys.stdin)
except Exception as e:
    print("respuesta no valida:", e); sys.exit()
if "error" in r:
    print("error de Ollama:", r["error"]); sys.exit()
ec, ed = r.get("eval_count", 0), r.get("eval_duration", 1)
pc, pd = r.get("prompt_eval_count", 0), r.get("prompt_eval_duration", 1)
ld = r.get("load_duration", 0)
print("carga del modelo: %.1f s" % (ld/1e9))
print("lectura del prompt: %.1f tok/s" % (pc/(pd/1e9) if pd else 0))
print("generacion: %.1f tok/s (%d tokens)" % (ec/(ed/1e9) if ed else 0, ec))
'
  else
    echo "$RESP" | head -c 600
    echo
    echo "(instala python3 para calcular tok/s automaticamente; eval_count/eval_duration estan en la respuesta)"
  fi
fi
echo "=== fin ==="
