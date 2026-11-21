#!/usr/bin/env bash
# Entorno de desarrollo sin hardware: lobby en :8080 + tres Ollama falsos (11501 ok, 11502 OOM, 11503 sin modelos).
set -e
cd "$(dirname "$0")/.."
export COUNCIL_DB="${COUNCIL_DB:-/tmp/council_dev.db}" COUNCIL_INTERVAL_OK=3 COUNCIL_INTERVAL_BAD=2
python3 tools/fake_ollama.py --port 11501 --models "qwen3:0.6b,qwen3:1.7b,qwen3-embedding:0.6b" & P1=$!
python3 tools/fake_ollama.py --port 11502 --mode oom --models "qwen3:0.6b" & P2=$!
python3 tools/fake_ollama.py --port 11503 --models "" & P3=$!
trap 'kill $P1 $P2 $P3 2>/dev/null' EXIT
python3 -m council
