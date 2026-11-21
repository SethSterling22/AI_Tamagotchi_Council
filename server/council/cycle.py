"""Ciclo día/noche sincronizado con el usuario. Las mascotas son nocturnas: trabajan sus encomiendas
mientras el usuario duerme y de día descansan y planifican con él.

  noche      [dormir, despertar)          turno de trabajo (ventana del ejecutor de tareas)
  amanecer   [despertar, despertar+30')   entregas de la noche
  día        [despertar+30', dormir-30')  descanso y planificación con el usuario
  atardecer  [dormir-30', dormir)         despiertan; se cierran las encomiendas de la noche

Las horas son locales en la zona del usuario (IANA); las cuentas se hacen en tiempo absoluto,
así una noche con cambio de hora dura lo que dura de verdad.
"""
from __future__ import annotations
import os
import re
from datetime import date, datetime, time as dtime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from . import db

PHASES = ("noche", "amanecer", "dia", "atardecer")
LABEL = {"noche": "NOCHE", "amanecer": "AMANECER", "dia": "DÍA", "atardecer": "ATARDECER"}
TRANSITION = 30 * 60
MIN_SPAN = 2 * 3600  # despierto y dormido: al menos 2 h cada uno
DEFAULT = {"wake": "07:00", "sleep": "23:00"}
HHMM = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")
TZ_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_+\-]*(/[A-Za-z0-9_+\-]+){0,2}$")
NEWS = {"noche": "cae la noche · empieza el turno del Consejo", "amanecer": "amanece · hora de las entregas",
        "dia": "es de día · el Consejo descansa y planifica contigo", "atardecer": "atardece · el Consejo despierta"}


class CycleError(Exception):
    def __init__(self, field, message):
        super().__init__(message)
        self.field, self.message = field, message


def lobby_tz() -> str:
    """Zona por defecto: COUNCIL_TZ o la del sistema del lobby (enlace /etc/localtime)."""
    name = os.environ.get("COUNCIL_TZ", "")
    if not name:
        try:
            name = os.path.realpath("/etc/localtime").split("zoneinfo/", 1)[1]
        except (IndexError, OSError):
            name = "UTC"
    try:
        ZoneInfo(name)
        return name
    except (ZoneInfoNotFoundError, ValueError):
        return "UTC"


def _minutes(v, field):
    m = HHMM.match(str(v or ""))
    if not m:
        raise CycleError(field, "Usa el formato HH:MM de 24 horas (por ejemplo 07:00).")
    return int(m[1]) * 60 + int(m[2])


def validate(d: dict) -> dict:
    wake, sleep = _minutes(d.get("wake"), "wake"), _minutes(d.get("sleep"), "sleep")
    tz = str(d.get("tz") or "")
    if not TZ_RE.match(tz) or len(tz) > 64:
        raise CycleError("tz", "Zona horaria no válida (ejemplo: America/Puerto_Rico).")
    try:
        ZoneInfo(tz)
    except (ZoneInfoNotFoundError, ValueError):
        raise CycleError("tz", "No conozco esa zona horaria (ejemplo: America/Puerto_Rico).")
    awake = (sleep - wake) % 1440
    if awake * 60 < MIN_SPAN:
        raise CycleError("sleep", "Necesitas al menos 2 horas despierto para planificar con el Consejo.")
    if (1440 - awake) * 60 < MIN_SPAN:
        raise CycleError("sleep", "La noche debe durar al menos 2 horas: es el turno de trabajo del Consejo.")
    return {"wake": d["wake"], "sleep": d["sleep"], "tz": tz}


def schedule() -> dict:
    saved = db.get_setting("cycle")
    if saved:
        return {**saved, "configured": True}
    return {**DEFAULT, "tz": lobby_tz(), "configured": False}


def _at(day: date, hhmm: str, tz) -> float:
    h, m = map(int, hhmm.split(":"))
    return datetime.combine(day, dtime(h, m), tz).timestamp()


def phase_at(now: float, sch: dict) -> dict:
    tz = ZoneInfo(sch["tz"])
    today = datetime.fromtimestamp(now, tz).date()
    marks = []
    for k in (-1, 0, 1):
        d = today + timedelta(days=k)
        w, s = _at(d, sch["wake"], tz), _at(d, sch["sleep"], tz)
        marks += [(w, "amanecer"), (w + TRANSITION, "dia"), (s - TRANSITION, "atardecer"), (s, "noche")]
    marks.sort()
    i = max(j for j, (t, _) in enumerate(marks) if t <= now)
    (start, phase), (end, nxt) = marks[i], marks[i + 1]
    return {"phase": phase, "label": LABEL[phase], "work": phase == "noche",
            "started_at": start, "ends_at": end, "next_phase": nxt, "next_label": LABEL[nxt],
            "progress": round((now - start) / (end - start), 4), "now": now,
            "local_time": datetime.fromtimestamp(now, tz).strftime("%H:%M"),
            "wake": sch["wake"], "sleep": sch["sleep"], "tz": sch["tz"], "configured": sch.get("configured", True)}


def state(now: float) -> dict:
    return phase_at(now, schedule())


class Watcher:
    """Lo llama el hilo del monitor cada segundo: anota en el registro cada cambio de fase."""

    def __init__(self, get_schedule=schedule, on_change=None):
        self.get_schedule, self.on_change, self.last = get_schedule, on_change, None

    def tick(self, now: float):
        st = phase_at(now, self.get_schedule())
        prev, self.last = self.last, st["phase"]
        if prev is None or prev == st["phase"]:
            return None
        db.add_event(None, "cycle", NEWS[st["phase"]])
        if self.on_change:
            self.on_change(st)
        return st
