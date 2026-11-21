"""Sondeo de un nodo Ollama. Solo stdlib (la Pi 2 B tiene 1 GB).

Estados que devuelve (alimentan los sprites del lobby):
  online  -> responde y el modelo está disponible          (idle / think)
  glitch  -> sin señal: DNS, conexión rechazada o timeout   (sprite glitch)
  error   -> el equipo contesta pero algo falla: HTTP 5xx, respuesta rara, falta el modelo, OOM (sprite error)
"""
from __future__ import annotations
import ipaddress
import json
import os
import re
import socket
import time
import urllib.error
import urllib.request

HOST_RE = re.compile(r"^(?=.{1,253}$)([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$")
CGNAT = ipaddress.ip_network("100.64.0.0/10")  # rango de Tailscale


class ProbeError(Exception):
    def __init__(self, state, code, message):
        super().__init__(message)
        self.state, self.code, self.message = state, code, message

    def as_dict(self):
        return {"state": self.state, "code": self.code, "message": self.message}


def validate_target(host: str, port) -> tuple[str, int]:
    """Valida host/puerto. Protege contra SSRF: solo red local, Tailscale, loopback o nombres cortos (MagicDNS).
    Para permitir IPs públicas: COUNCIL_ALLOW_PUBLIC=1."""
    host = (host or "").strip().lower()
    try:
        port = int(port)
    except (TypeError, ValueError):
        raise ProbeError("error", "BAD_PORT", "El puerto debe ser un número.")
    if not 1 <= port <= 65535:
        raise ProbeError("error", "BAD_PORT", "El puerto debe estar entre 1 y 65535.")
    if not host or not HOST_RE.match(host):
        raise ProbeError("error", "BAD_HOST", "Escribe una IP o un nombre de host válido (por ejemplo 100.64.0.12 o ocelote).")
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        ip = None
    allow_public = os.environ.get("COUNCIL_ALLOW_PUBLIC") == "1"
    if ip is not None:
        if ip.is_link_local or ip.is_multicast or ip.is_unspecified:
            raise ProbeError("error", "HOST_FORBIDDEN", "Esa dirección no está permitida (enlace local, multicast o 0.0.0.0).")
        ok = ip.is_loopback or ip.is_private or ip in CGNAT
        if not ok and not allow_public:
            raise ProbeError("error", "HOST_FORBIDDEN", "Solo se permiten IPs de red local o Tailscale (100.64.0.0/10).")
    else:
        short = "." not in host
        if not (short or host.endswith(".ts.net") or host.endswith(".local") or host.endswith(".lan") or allow_public):
            raise ProbeError("error", "HOST_FORBIDDEN", "Usa el nombre corto de MagicDNS (ocelote), un nombre .ts.net o una IP privada.")
    return host, port


def _url(host, port, path):
    h = f"[{host}]" if ":" in host else host
    return f"http://{h}:{port}{path}"


def _classify(exc) -> ProbeError:
    reason = getattr(exc, "reason", exc)
    if isinstance(reason, socket.gaierror):
        return ProbeError("glitch", "ENOTFOUND", "No se encuentra ese nombre. ¿Tailscale/MagicDNS activo en este equipo?")
    if isinstance(reason, ConnectionRefusedError):
        return ProbeError("glitch", "ECONNREFUSED", "El equipo responde pero Ollama no escucha en ese puerto.")
    if isinstance(reason, (socket.timeout, TimeoutError)):
        return ProbeError("glitch", "ETIMEDOUT", "Sin señal: el nodo está apagado, dormido o fuera de Tailscale.")
    if isinstance(reason, OSError):
        return ProbeError("glitch", "ENETUNREACH", f"Red inalcanzable ({reason.strerror or reason}).")
    return ProbeError("glitch", "ECONN", str(reason))


MISSING_RE = re.compile(r"""model ['"]([^'"]+)['"] not found""")  # 0.40.16: 'x' · 0.31.1 (embed): "x", try pulling it first


def _http_error(code, txt) -> ProbeError:
    try:
        txt = str(json.loads(txt).get("error") or txt)  # Ollama: {"error": "..."}; rutas inexistentes: texto plano
    except (ValueError, AttributeError):
        pass
    m = MISSING_RE.search(txt) if code == 404 else None
    if m:
        return ProbeError("error", "MODEL_MISSING", f"Falta el modelo {m.group(1)}. En el nodo: ollama pull {m.group(1)}")
    low = txt.lower()
    if "memory" in low or "oom" in low:
        return ProbeError("error", "OOM", "El modelo no cabe en la RAM del nodo. Usa uno más pequeño.")
    return ProbeError("error", f"HTTP_{code}", f"El nodo respondió HTTP {code}. {txt[:120]}".strip())


def http_json(host, port, path, body=None, timeout=3.0):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(_url(host, port, path), data=data,
                                 headers={"Content-Type": "application/json"} if data else {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read(2_000_000)
    except urllib.error.HTTPError as e:
        txt = ""
        try:
            txt = e.read(300).decode("utf-8", "replace")
        except Exception:
            pass
        raise _http_error(e.code, txt)
    except (urllib.error.URLError, socket.timeout, TimeoutError, OSError) as e:
        raise _classify(e)
    try:
        return json.loads(raw)
    except ValueError:
        raise ProbeError("error", "BAD_RESPONSE", "Responde, pero no parece Ollama (no es JSON).")


def probe(host, port, model: str = "", kind: str = "chat", timeout: float = 3.0) -> dict:
    """Sondeo ligero: /api/version + /api/tags. No carga el modelo en RAM."""
    host, port = validate_target(host, port)
    t0 = time.perf_counter()
    try:
        ver = http_json(host, port, "/api/version", timeout=timeout)
        if not isinstance(ver, dict) or "version" not in ver:
            raise ProbeError("error", "BAD_RESPONSE", "Responde, pero no parece Ollama (falta «version»).")
        latency = round((time.perf_counter() - t0) * 1000)
        tags = http_json(host, port, "/api/tags", timeout=timeout)
        models = sorted(m.get("name", "") for m in (tags.get("models") or []) if isinstance(m, dict))
    except ProbeError as e:
        return {"ok": False, "state": e.state, "error": e.as_dict(), "host": host, "port": port,
                "latency_ms": None, "version": None, "models": [], "model_present": None}
    present = None
    if model:
        present = model in models or (":" not in model and f"{model}:latest" in models)
    out = {"ok": True, "state": "online", "error": None, "host": host, "port": port, "latency_ms": latency,
           "version": ver["version"], "models": models, "model_present": present}
    if model and not present:
        out.update(ok=False, state="error", error={"state": "error", "code": "MODEL_MISSING",
                   "message": f"Falta el modelo {model}. En el nodo: ollama pull {model}"})
    return out


def hello(host, port, model, kind, system_prompt, prompt, timeout=60.0) -> dict:
    """Primer contacto: una generación mínima para comprobar el ciclo completo (carga el modelo en RAM)."""
    host, port = validate_target(host, port)
    t0 = time.perf_counter()
    if kind == "embed":
        r = http_json(host, port, "/api/embed", {"model": model, "input": "hola"}, timeout=timeout)
        vec = (r.get("embeddings") or [[]])[0]
        if not vec:
            raise ProbeError("error", "BAD_RESPONSE", "El modelo no devolvió un embedding.")
        return {"text": f"Embedding de {len(vec)} dimensiones guardado en memoria.", "dims": len(vec),
                "ms": round((time.perf_counter() - t0) * 1000), "tps": None}
    body = {"model": model, "stream": False, "think": False,
            "options": {"num_predict": 64, "num_ctx": 2048, "temperature": 0.7},
            "messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": prompt}]}
    r = http_json(host, port, "/api/chat", body, timeout=timeout)
    text = ((r.get("message") or {}).get("content") or "").strip()
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.S).strip()
    if not text:
        raise ProbeError("error", "EMPTY", "El modelo respondió vacío.")
    ec, ed = r.get("eval_count"), r.get("eval_duration")
    tps = round(ec / (ed / 1e9), 1) if ec and ed else None
    return {"text": text, "ms": round((time.perf_counter() - t0) * 1000), "tps": tps}
