"""Servicio del lobby: API REST + SSE + sitio estático (../web)."""
from __future__ import annotations
import json
import os
import re

from flask import Flask, Response, jsonify, request, send_from_directory

from . import db, persona, probe as P
from .monitor import Monitor
from .species import LIMITS, SPECIES, public_catalog

WEB = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "web"))
NAME_RE = re.compile(r"^[A-Za-zÁÉÍÓÚÑÜáéíóúñü0-9][A-Za-zÁÉÍÓÚÑÜáéíóúñü0-9 _-]*$")


class ApiError(Exception):
    def __init__(self, code, message, field=None, status=400):
        self.code, self.message, self.field, self.status = code, message, field, status


def _clamp_int(v, lo, hi, field):
    try:
        v = int(v)
    except (TypeError, ValueError):
        raise ApiError("BAD_NUMBER", "Debe ser un número.", field)
    if not lo <= v <= hi:
        raise ApiError("OUT_OF_RANGE", f"Debe estar entre {lo} y {hi}.", field)
    return v


def validate_pet(d: dict, partial=False, exclude_id=None) -> dict:
    out = {}
    sp_key = d.get("species")
    if not partial:
        sp = SPECIES.get(sp_key)
        if not sp:
            raise ApiError("BAD_SPECIES", "Elige un personaje de la lista.", "species")
        if sp["locked"] and os.environ.get("COUNCIL_UNLOCK_ALL") != "1":
            raise ApiError("SPECIES_LOCKED", sp.get("unlock", "Personaje bloqueado."), "species", 403)
        out["species"] = sp_key
    else:
        sp = SPECIES.get(db.get_pet(exclude_id)["species"])
    if "name" in d or not partial:
        name = (d.get("name") or "").strip()
        if not name or len(name) > LIMITS["name_max"]:
            raise ApiError("BAD_NAME", f"El nombre debe tener entre 1 y {LIMITS['name_max']} caracteres.", "name")
        if not NAME_RE.match(name):
            raise ApiError("BAD_NAME", "Usa solo letras, números, espacios, guion o guion bajo.", "name")
        slug = db.slugify(name)
        for p in db.list_pets():
            if p["slug"] == slug and p["id"] != exclude_id:
                raise ApiError("NAME_TAKEN", "Ya existe una mascota con ese nombre.", "name", 409)
        out["name"], out["slug"] = name, slug
    if "host" in d or "port" in d or not partial:
        cur = db.get_pet(exclude_id) if partial else None
        host = d.get("host", cur["host"] if cur else "")
        port = d.get("port", cur["port"] if cur else 11434)
        try:
            out["host"], out["port"] = P.validate_target(host, port)
        except P.ProbeError as e:
            raise ApiError(e.code, e.message, "port" if e.code == "BAD_PORT" else "host")
    if "model" in d or not partial:
        m = (d.get("model") or sp["model_suggested"] or "").strip()
        if not re.fullmatch(r"[A-Za-z0-9._:/-]{0,64}", m):
            raise ApiError("BAD_MODEL", "Nombre de modelo no válido (ejemplo: qwen3:0.6b).", "model")
        out["model"] = m
    if "traits" in d or not partial:
        base = dict(sp["traits"]); base.update(d.get("traits") or {})
        out["traits"] = {k: _clamp_int(base.get(k, 50), 0, 100, f"traits.{k}") for k in sp["traits"]}
    if "voice" in d or not partial:
        v = (d.get("voice") if d.get("voice") is not None else sp["voice"]).strip()
        if len(v) > LIMITS["voice_max"]:
            raise ApiError("VOICE_TOO_LONG", f"Máximo {LIMITS['voice_max']} caracteres.", "voice")
        out["voice"] = v
    if not partial:
        mood = _clamp_int((d.get("stats") or {}).get("mood", sp["stats"]["mood"]), 0, 100, "stats.mood")
        out["stats"] = {"mood": mood, "energy": 100, "know": 0}
        lv = d.get("branch_levels") or [0, 0, 0]
        if not (isinstance(lv, list) and len(lv) == 3):
            raise ApiError("BAD_BRANCHES", "Se esperan 3 niveles de rama.", "branch_levels")
        lv = [_clamp_int(x, 0, LIMITS["branch_max_at_start"], "branch_levels") for x in lv]
        if sum(lv) > LIMITS["branch_budget"]:
            raise ApiError("BUDGET", f"Solo tienes {LIMITS['branch_budget']} puntos iniciales para las ramas.", "branch_levels")
        out["branches"] = [(sp["branches"][i][0], lv[i]) for i in range(3)]
        out["level"], out["xp"], out["points"] = 1, 0, LIMITS["branch_budget"] - sum(lv)
    return out


def create_app(monitor: Monitor | None = None, autostart=True) -> Flask:
    app = Flask(__name__, static_folder=None)
    mon = monitor or Monitor(
        interval_ok=float(os.environ.get("COUNCIL_INTERVAL_OK", 15)),
        interval_bad=float(os.environ.get("COUNCIL_INTERVAL_BAD", 5)))
    app.config["monitor"] = mon

    @app.errorhandler(ApiError)
    def _api_err(e):
        return jsonify({"error": {"code": e.code, "message": e.message, "field": e.field}}), e.status

    @app.errorhandler(404)
    def _nf(e):
        if request.path.startswith("/api/"):
            return jsonify({"error": {"code": "NOT_FOUND", "message": "No existe."}}), 404
        return e

    def pet_or_404(pid):
        p = db.get_pet(pid)
        if not p:
            raise ApiError("NOT_FOUND", "Esa mascota no existe.", None, 404)
        return p

    def with_status(pid):
        return next(p for p in mon.snapshot() if p["id"] == pid)

    # ---------------------------------------------------------------- catálogo / salud
    @app.get("/api/health")
    def health():
        return jsonify({"ok": True, "pets": len(db.list_pets()), "monitor": bool(mon._thread and mon._thread.is_alive())})

    @app.get("/api/species")
    def species():
        return jsonify(public_catalog())

    @app.post("/api/persona-preview")
    def persona_preview():
        d = request.get_json(silent=True) or {}
        sp = SPECIES.get(d.get("species"))
        if not sp:
            raise ApiError("BAD_SPECIES", "Elige un personaje.", "species")
        base = dict(sp["traits"]); base.update(d.get("traits") or {})
        voice = d.get("voice") if d.get("voice") is not None else sp["voice"]
        return jsonify({"system_prompt": persona.build_system_prompt(
            sp["key"], (d.get("name") or sp["name"]).strip(), sp["role"], base, voice)})

    # ---------------------------------------------------------------- sondeo previo al alta
    @app.post("/api/probe")
    def probe_api():
        d = request.get_json(silent=True) or {}
        sp = SPECIES.get(d.get("species") or "", {})
        try:
            res = P.probe(d.get("host"), d.get("port", 11434), (d.get("model") or "").strip(),
                          sp.get("kind", "chat"), timeout=mon.timeout)
        except P.ProbeError as e:
            res = {"ok": False, "state": e.state, "error": e.as_dict(), "host": d.get("host"), "port": d.get("port"),
                   "latency_ms": None, "version": None, "models": [], "model_present": None}
        return jsonify(res)

    # ---------------------------------------------------------------- mascotas
    @app.get("/api/pets")
    def pets():
        return jsonify({"pets": mon.snapshot(), "version": mon.version})

    @app.post("/api/pets")
    def create_pet():
        data = validate_pet(request.get_json(silent=True) or {})
        pid = db.insert_pet(data)
        db.add_event(pid, "created", f"{data['name']} ({data['species']}) → {data['host']}:{data['port']}")
        mon.recheck_soon(pid)
        mon.bump()
        import threading
        threading.Thread(target=mon._safe_check, args=(pid,), daemon=True).start()
        return jsonify(with_status(pid)), 201

    @app.get("/api/pets/<int:pid>")
    def get_pet(pid):
        pet_or_404(pid)
        return jsonify(with_status(pid))

    @app.patch("/api/pets/<int:pid>")
    def patch_pet(pid):
        cur = pet_or_404(pid)
        data = validate_pet(request.get_json(silent=True) or {}, partial=True, exclude_id=pid)
        db.update_pet(pid, data)
        if any(k in data for k in ("host", "port", "model")):
            mon.recheck_soon(pid)
            import threading
            threading.Thread(target=mon._safe_check, args=(pid,), daemon=True).start()
        db.add_event(pid, "edited", ", ".join(k for k in data if k != "slug"))
        mon.bump()
        return jsonify(with_status(pid))

    @app.delete("/api/pets/<int:pid>")
    def del_pet(pid):
        pet_or_404(pid)
        db.delete_pet(pid)
        mon.forget(pid)
        return "", 204

    @app.post("/api/pets/<int:pid>/probe")
    def probe_pet(pid):
        pet_or_404(pid)
        mon.recheck_soon(pid)
        mon.check(pid)
        return jsonify(with_status(pid))

    @app.post("/api/pets/<int:pid>/hello")
    def hello(pid):
        pet = pet_or_404(pid)
        sp = SPECIES[pet["species"]]
        sysmsg = persona.build_system_prompt(pet["species"], pet["name"], sp["role"], pet["traits"], pet["voice"])
        mon.set_activity(pid, "think")
        try:
            r = P.hello(pet["host"], pet["port"], pet["model"], sp["kind"], sysmsg, persona.greeting_prompt(pet["species"]),
                        timeout=float(os.environ.get("COUNCIL_HELLO_TIMEOUT", 90)))
            db.add_event(pid, "hello", r["text"][:200])
            mon.check(pid)
            return jsonify({"ok": True, **r})
        except P.ProbeError as e:
            db.add_event(pid, "hello_failed", f"{e.code}: {e.message}"[:200])
            mon.check(pid)
            return jsonify({"ok": False, "error": e.as_dict()}), 502
        finally:
            mon.set_activity(pid, "idle")

    @app.get("/api/events")
    def events():
        pid = request.args.get("pet", type=int)
        return jsonify({"events": db.events(min(request.args.get("limit", 50, type=int), 200), pid)})

    # ---------------------------------------------------------------- tiempo real
    @app.get("/api/stream")
    def stream():
        def gen():
            seen = -1
            while True:
                with mon.cond:
                    if mon.version == seen:
                        mon.cond.wait(timeout=15)
                    ver = mon.version
                if ver == seen:
                    yield ": keepalive\n\n"
                    continue
                seen = ver
                yield "data: " + json.dumps({"pets": mon.snapshot(), "version": ver}) + "\n\n"
        return Response(gen(), mimetype="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

    # ---------------------------------------------------------------- web estática
    @app.get("/")
    def index():
        return send_from_directory(WEB, "index.html")

    @app.get("/<path:p>")
    def static_files(p):
        return send_from_directory(WEB, p)

    if autostart:
        mon.start()
    return app
