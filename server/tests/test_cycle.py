"""Ciclo día/noche: las mascotas (nocturnas) trabajan mientras el usuario duerme y planifican de día."""
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

from council import cycle, db

PR = "America/Puerto_Rico"  # sin horario de verano
BASE = {"wake": "07:00", "sleep": "23:00", "tz": PR}


def at(s, tz=PR):
    return datetime.fromisoformat(s).replace(tzinfo=ZoneInfo(tz)).timestamp()


@pytest.mark.parametrize("hora,fase", [
    ("2026-11-21 12:00", "dia"), ("2026-11-21 22:40", "atardecer"), ("2026-11-21 23:00", "noche"),
    ("2026-11-22 03:00", "noche"), ("2026-11-22 07:00", "amanecer"), ("2026-11-22 07:29", "amanecer"),
    ("2026-11-22 07:30", "dia"),
])
def test_phase_follows_user_schedule(hora, fase):
    st = cycle.phase_at(at(hora), BASE)
    assert st["phase"] == fase
    assert st["work"] is (fase == "noche")


def test_phase_boundaries_and_progress():
    st = cycle.phase_at(at("2026-11-22 03:00"), BASE)
    assert st["started_at"] == at("2026-11-21 23:00") and st["ends_at"] == at("2026-11-22 07:00")
    assert st["next_phase"] == "amanecer" and st["progress"] == pytest.approx(0.5)
    assert st["local_time"] == "03:00" and st["label"] == "NOCHE"


def test_inverted_schedule_night_shift_user():
    # quien duerme de día: la «noche» del Consejo cae a mediodía
    sch = {"wake": "15:00", "sleep": "06:00", "tz": PR}
    assert cycle.phase_at(at("2026-11-21 10:00"), sch)["phase"] == "noche"
    assert cycle.phase_at(at("2026-11-21 20:00"), sch)["phase"] == "dia"
    assert cycle.phase_at(at("2026-11-21 05:45"), sch)["phase"] == "atardecer"


def test_dst_night_is_one_hour_shorter():
    # Nueva York adelanta la hora el 8-mar-2026: la noche de 23:00 a 07:00 dura 7 h reales
    sch = {"wake": "07:00", "sleep": "23:00", "tz": "America/New_York"}
    st = cycle.phase_at(at("2026-03-08 04:00", "America/New_York"), sch)
    assert st["phase"] == "noche" and st["ends_at"] - st["started_at"] == 7 * 3600


@pytest.mark.parametrize("body,field", [
    ({"wake": "7am", "sleep": "23:00", "tz": PR}, "wake"),
    ({"wake": "07:00", "sleep": "24:10", "tz": PR}, "sleep"),
    ({"wake": "07:00", "sleep": "23:00", "tz": "Marte/Olympus"}, "tz"),
    ({"wake": "07:00", "sleep": "23:00", "tz": "../../etc/passwd"}, "tz"),
    ({"wake": "07:00", "sleep": "08:00", "tz": PR}, "sleep"),   # despierto solo 1 h: no cabe la planificación
    ({"wake": "07:00", "sleep": "06:00", "tz": PR}, "sleep"),   # noche de 1 h: no cabe el turno
])
def test_schedule_validation(body, field):
    with pytest.raises(cycle.CycleError) as e:
        cycle.validate(body)
    assert e.value.field == field


def test_watcher_logs_only_transitions(app):
    w = cycle.Watcher(lambda: BASE)
    assert w.tick(at("2026-11-21 22:00")) is None      # arranque: no anuncia nada
    assert w.tick(at("2026-11-21 22:10")) is None
    assert w.tick(at("2026-11-21 22:31"))["phase"] == "atardecer"
    assert w.tick(at("2026-11-21 23:00"))["phase"] == "noche"
    kinds = [(e["kind"], e["pet_id"]) for e in db.events(10)]
    assert kinds.count(("cycle", None)) == 2


# ------------------------------------------------------------ API
def test_cycle_api_default_and_update(client, app, monkeypatch):
    monkeypatch.setenv("COUNCIL_TZ", PR)
    d = client.get("/api/cycle").get_json()
    assert d["configured"] is False and d["tz"] == PR and d["wake"] == "07:00" and d["sleep"] == "23:00"
    assert d["phase"] in cycle.PHASES
    v0 = app.config["monitor"].version
    r = client.put("/api/cycle", json={"wake": "06:30", "sleep": "22:15", "tz": "Europe/Madrid"})
    d = r.get_json()
    assert r.status_code == 200 and d["configured"] and d["tz"] == "Europe/Madrid" and d["wake"] == "06:30"
    assert app.config["monitor"].version > v0
    assert any(e["kind"] == "cycle_edited" for e in db.events(5))
    assert client.get("/api/pets").get_json()["cycle"]["sleep"] == "22:15"


def test_cycle_api_rejects_bad_input(client):
    r = client.put("/api/cycle", json={"wake": "07:00", "sleep": "07:30", "tz": PR})
    assert r.status_code == 400 and r.get_json()["error"]["field"] == "sleep"
    assert client.get("/api/cycle").get_json()["configured"] is False


def test_sse_snapshot_includes_cycle(client):
    r = client.get("/api/stream", buffered=False)
    first = next(iter(r.response)).decode()
    assert '"cycle"' in first and '"phase"' in first
    r.close()


def test_monitor_runs_hooks_and_survives_broken_one(app):
    import time
    from council.monitor import Monitor
    mon, seen = Monitor(), []
    mon.hooks += [lambda now: 1 / 0, seen.append]
    mon.start(); time.sleep(1.3); mon.stop()
    assert seen and any(e["kind"] == "monitor_error" and "ZeroDivisionError" in e["detail"] for e in db.events(10))
