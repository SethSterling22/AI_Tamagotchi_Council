"""Ollama falso para desarrollar y probar sin hardware.

  python tools/fake_ollama.py --port 11501 --models qwen3:0.6b
  python tools/fake_ollama.py --port 11502 --mode oom        # responde HTTP 500 «out of memory» al generar
  python tools/fake_ollama.py --port 11503 --models ""       # sin modelos (provoca MODEL_MISSING)

Modos: ok | oom | garbage (no es Ollama) | slow (tarda 5 s) | vacío (respuesta vacía)
También se puede importar: FakeOllama(port=0, ...).start() y leer .port.
"""
import argparse
import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


class FakeOllama:
    def __init__(self, port=0, models=("qwen3:0.6b",), mode="ok", version="0.40.16"):
        self.models, self.mode, self.version = list(models), mode, version
        self.done_reason = "stop"  # «length» simula una respuesta cortada por num_predict
        self.calls = []
        outer = self

        class H(BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def _send(self, code, obj, raw=False):
                body = obj.encode() if raw else json.dumps(obj).encode()
                self.send_response(code)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def do_GET(self):
                outer.calls.append(("GET", self.path))
                if outer.mode == "garbage":
                    return self._send(200, "<html>no soy ollama</html>", raw=True)
                if self.path == "/api/version":
                    return self._send(200, {"version": outer.version})
                if self.path == "/api/tags":
                    return self._send(200, {"models": [{"name": m} for m in outer.models]})
                self._send(404, {"error": "not found"})

            def do_POST(self):
                n = int(self.headers.get("Content-Length") or 0)
                body = json.loads(self.rfile.read(n) or b"{}")
                outer.calls.append(("POST", self.path, body))
                if outer.mode == "slow":
                    time.sleep(5)
                m = body.get("model") or ""
                if self.path in ("/api/chat", "/api/embed") and m not in outer.models and f"{m}:latest" not in outer.models:
                    return self._send(404, {"error": f"model '{m}' not found"})  # igual que Ollama 0.40.16
                if outer.mode == "oom":
                    return self._send(500, {"error": "model requires more system memory (1.9 GiB) than is available"})
                if self.path == "/api/chat":
                    txt = "" if outer.mode == "vacio" else "<think></think>Hola, soy una mascota de prueba."
                    return self._send(200, {"message": {"role": "assistant", "content": txt},
                                            "eval_count": 12, "eval_duration": 2_400_000_000,
                                            "done": True, "done_reason": outer.done_reason})
                if self.path == "/api/embed":
                    return self._send(200, {"embeddings": [[0.1] * 1024]})
                self._send(404, {"error": "not found"})

        self.httpd = ThreadingHTTPServer(("127.0.0.1", port), H)
        self.port = self.httpd.server_address[1]

    def start(self):
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()
        return self

    def stop(self):
        self.httpd.shutdown()
        self.httpd.server_close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=11501)
    ap.add_argument("--models", default="qwen3:0.6b")
    ap.add_argument("--mode", default="ok")
    a = ap.parse_args()
    f = FakeOllama(a.port, [m for m in a.models.split(",") if m], a.mode)
    print(f"fake ollama en 127.0.0.1:{f.port} modelos={f.models} modo={a.mode}")
    f.httpd.serve_forever()
