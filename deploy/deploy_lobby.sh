#!/usr/bin/env bash
# Despliega server/ y web/ en el lobby y reinicia el servicio. Se ejecuta desde TU computador.
#   ./deploy/deploy_lobby.sh USUARIO@lobby
# Requiere que setup_pi.sh lobby ya se haya ejecutado en la Pi (crea /opt/council y el servicio).
set -euo pipefail
TARGET="${1:?uso: $0 USUARIO@lobby}"
cd "$(dirname "$0")/.."
tar czf - --exclude='__pycache__' --exclude='server/data' --exclude='server/tests' --exclude='.pytest_cache' server web \
  | ssh "$TARGET" 'sudo tar xzf - -C /opt/council/app && sudo chown -R council:council /opt/council/app && sudo systemctl restart council-lobby'
sleep 2
ssh "$TARGET" 'curl -fsS http://127.0.0.1:8080/api/health && echo' || { echo "El servicio no respondió: ssh $TARGET journalctl -u council-lobby -n 50"; exit 1; }
