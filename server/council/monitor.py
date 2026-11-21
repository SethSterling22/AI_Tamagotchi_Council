"""Ciclo de conexión: sondea cada nodo, aplica histéresis y notifica cambios (SSE / polling)."""
from __future__ import annotations
import threading
import time

from . import db, probe as P


class Monitor:
    def __init__(self, interval_ok=15.0, interval_bad=5.0, fails_to_drop=2, timeout=3.0):
        self.interval_ok, self.interval_bad = interval_ok, interval_bad
        self.fails_to_drop, self.timeout = fails_to_drop, timeout
        self.rt: dict[int, dict] = {}
        self.cond = threading.Condition()
        self.version = 0
        self._stop = threading.Event()
        self._thread = None
        self._lock = threading.Lock()
        self.hooks = []  # funciones f(now) que el hilo llama cada segundo (p. ej. el ciclo día/noche)

    # ---------------------------------------------------------------- estado
    def _blank(self, pet_id):
        st = db.saved_states().get(pet_id, ("pending", None, None))
        return {"state": st[0], "error": st[1], "latency_ms": None, "version": None, "models": [],
                "model_present": None, "fails": 0, "next_at": 0.0, "checked": False,
                "last_seen": st[2], "activity": "idle"}

    def bump(self):
        with self.cond:
            self.version += 1
            self.cond.notify_all()

    def forget(self, pet_id):
        self.rt.pop(pet_id, None)
        self.bump()

    def set_activity(self, pet_id, activity):
        r = self.rt.setdefault(pet_id, self._blank(pet_id))
        r["activity"] = activity
        self.bump()

    def snapshot(self) -> list[dict]:
        out = []
        for pet in db.list_pets():
            r = self.rt.get(pet["id"]) or self._blank(pet["id"])
            pet["status"] = {k: r[k] for k in ("state", "error", "latency_ms", "version", "models",
                                                 "model_present", "last_seen", "activity", "checked")}
            out.append(pet)
        return out

    # ---------------------------------------------------------------- sondeo
    def check(self, pet_id: int) -> dict | None:
        pet = db.get_pet(pet_id)
        if not pet:
            return None
        kind = "embed" if pet["species"] == "kakapo" else "chat"
        res = P.probe(pet["host"], pet["port"], pet["model"], kind, self.timeout)
        with self._lock:
            r = self.rt.setdefault(pet_id, self._blank(pet_id))
            prev = r["state"] if r["checked"] else None
            new = res["state"]
            if new == "online":
                r["fails"] = 0
            else:
                r["fails"] += 1
                # histéresis: un nodo que estaba bien tolera fallos sueltos antes de caer
                if prev == "online" and r["fails"] < self.fails_to_drop:
                    new = "online"
            r.update(state=new, checked=True,
                     error=None if new == "online" else res["error"],
                     latency_ms=res["latency_ms"] if res["ok"] or res["latency_ms"] else r["latency_ms"],
                     version=res["version"] or r["version"], models=res["models"] or r["models"],
                     model_present=res["model_present"])
            if res["ok"]:
                r["last_seen"] = time.time()
            r["next_at"] = time.time() + (self.interval_ok if new == "online" else
                                          min(self.interval_bad * (2 ** min(r["fails"] - 1, 3)), 60))
            if prev != new:
                detail = f"{prev or 'inicio'} → {new}" + (f" · {r['error']['code']}" if r["error"] else "")
                db.add_event(pet_id, "state", detail)
            db.save_state(pet_id, new, r["error"], r["last_seen"] if res["ok"] else None)
            snap = dict(r)
        self.bump()
        return snap

    def recheck_soon(self, pet_id):
        r = self.rt.setdefault(pet_id, self._blank(pet_id))
        r["next_at"] = 0.0
        r["checked"] = False  # sin histéresis tras editar host/puerto/modelo
        r["fails"] = 0

    # ---------------------------------------------------------------- hilo
    def run(self):
        while not self._stop.is_set():
            now = time.time()
            try:
                for pet in db.list_pets():
                    r = self.rt.setdefault(pet["id"], self._blank(pet["id"]))
                    if now >= r["next_at"]:
                        r["next_at"] = now + 1.0  # evita doble disparo mientras dura el sondeo
                        threading.Thread(target=self._safe_check, args=(pet["id"],), daemon=True).start()
            except Exception:
                pass
            for hook in self.hooks:
                try:
                    hook(now)
                except Exception as e:  # un gancho roto no detiene el sondeo
                    db.add_event(None, "monitor_error", repr(e)[:200])
            self._stop.wait(1.0)

    def _safe_check(self, pet_id):
        try:
            self.check(pet_id)
        except Exception as e:  # nunca matar el ciclo por un nodo
            db.add_event(pet_id, "monitor_error", repr(e)[:200])

    def start(self):
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self.run, daemon=True, name="council-monitor")
        self._thread.start()

    def stop(self):
        self._stop.set()
