"""Encomiendas: se encargan de día y las mascotas las trabajan de noche, una a la vez por nodo."""
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

from council import db
from tools.fake_ollama import FakeOllama

PR = ZoneInfo("America/Puerto_Rico")
NIGHT = datetime(2026, 11, 22, 2, 0, tzinfo=PR).timestamp()
DAY = datetime(2026, 11, 22, 13, 0, tzinfo=PR).timestamp()


@pytest.fixture
def setup(app, client, ollama):
    client.put("/api/cycle", json={"wake": "07:00", "sleep": "23:00", "tz": "America/Puerto_Rico"})
    mon, runner = app.config["monitor"], app.config["runner"]
    runner.sync = True  # en pruebas el trabajo corre en el mismo hilo

    def pet(name="Ocelote", species="ocelote", port=None, online=True):
        pid = client.post("/api/pets", json={"species": species, "name": name, "host": "127.0.0.1",
                                             "port": port or ollama.port, "model": "qwen3:0.6b"}).get_json()["id"]
        if online:
            mon.check(pid)
        return pid

    def task(pid, title="Ideas de menú", prompt="Propón tres cenas rápidas."):
        return client.post("/api/tasks", json={"pet_id": pid, "title": title, "prompt": prompt})
    return mon, runner, pet, task


def tasks(client, **q):
    return client.get("/api/tasks", query_string=q).get_json()["tasks"]


# ------------------------------------------------------------ alta
def test_create_task_validation(client, setup):
    mon, runner, pet, task = setup
    pid = pet()
    assert task(pid, title="").get_json()["error"]["field"] == "title"
    assert task(pid, title="x" * 61).get_json()["error"]["field"] == "title"
    assert task(pid, prompt="").get_json()["error"]["field"] == "prompt"
    assert task(pid, prompt="x" * 601).get_json()["error"]["field"] == "prompt"
    assert task(9999).status_code == 404
    kak = pet("Kaka", "kakapo", online=False)
    r = task(kak)
    assert r.status_code == 400 and r.get_json()["error"]["code"] == "NO_TASKS"
    r = task(pid)
    t = r.get_json()
    assert r.status_code == 201 and t["status"] == "queued" and t["pet_name"] == "Ocelote" and t["attempts"] == 0


def test_event_log_never_contains_task_text(client, setup):
    mon, runner, pet, task = setup
    pid = pet()
    task(pid, title="Plan secreto", prompt="contenido privado")
    runner.tick(NIGHT)
    text = " ".join(e["detail"] or "" for e in db.events(50))
    assert "Plan secreto" not in text and "contenido privado" not in text and "#1" in text


# ------------------------------------------------------------ ejecutor
def test_runner_waits_for_night_then_delivers(client, setup, ollama):
    mon, runner, pet, task = setup
    pid = pet()
    tid = task(pid).get_json()["id"]
    runner.tick(DAY)
    assert tasks(client)[0]["status"] == "queued"
    runner.tick(NIGHT)
    t = tasks(client)[0]
    assert t["id"] == tid and t["status"] == "done" and "mascota de prueba" in t["result"]
    assert "<think>" not in t["result"] and t["tokens"] == 12 and t["tps"] == 5.0 and t["seen_at"] is None
    sent = [c for c in ollama.calls if c[0] == "POST" and c[1] == "/api/chat"][-1][2]
    assert sent["options"]["num_predict"] == 400 and sent["options"]["num_ctx"] == 2048 and sent["think"] is False
    assert "Ideas de menú" in sent["messages"][1]["content"] and "Propón tres cenas" in sent["messages"][1]["content"]
    assert "Ocelote" in sent["messages"][0]["content"] and "frase" not in sent["messages"][0]["content"]
    assert any(e["kind"] == "task_done" for e in db.events(10))


def test_one_task_at_a_time_per_pet(client, setup):
    mon, runner, pet, task = setup
    runner.sync = False
    started = []
    runner.launch = lambda t, p, now: started.append(t["id"])  # no ejecuta: solo registra qué arrancaría
    a, b = pet(), pet("Erizo", "erizo")
    t1, t2, t3 = (task(a).get_json()["id"], task(a).get_json()["id"], task(b).get_json()["id"])
    runner.tick(NIGHT)
    assert sorted(started) == [t1, t3]
    runner.tick(NIGHT + 1)
    assert sorted(started) == [t1, t3]  # t1 sigue en marcha: t2 espera su turno
    st = {t["id"]: t["status"] for t in tasks(client)}
    assert st == {t1: "running", t2: "queued", t3: "running"}


def test_offline_pet_keeps_task_waiting(client, setup):
    mon, runner, pet, task = setup
    f = FakeOllama().start(); dead = f.port; f.stop()
    pid = pet("Buho", "buho", port=dead)
    task(pid)
    runner.tick(NIGHT)
    t = tasks(client)[0]
    assert t["status"] == "queued" and t["attempts"] == 0


def test_failure_retries_then_fails_and_can_be_retried(client, setup, ollama):
    mon, runner, pet, task = setup
    pid = pet()
    tid = task(pid).get_json()["id"]
    ollama.mode = "oom"
    runner.tick(NIGHT)
    t = tasks(client)[0]
    assert t["status"] == "queued" and t["attempts"] == 1 and t["error"]["code"] == "OOM"
    runner.tick(NIGHT + 10)
    assert tasks(client)[0]["attempts"] == 1  # espera antes de reintentar
    runner.tick(NIGHT + runner.backoff + 1)
    runner.tick(NIGHT + 3 * runner.backoff + 2)
    t = tasks(client)[0]
    assert t["status"] == "failed" and t["attempts"] == 3
    ollama.mode = "ok"
    assert client.post(f"/api/tasks/{tid}/retry").get_json()["status"] == "queued"
    runner.tick(NIGHT + 4 * runner.backoff)
    assert tasks(client)[0]["status"] == "done"


def test_truncated_result_is_flagged(client, setup, ollama):
    mon, runner, pet, task = setup
    pid = pet()
    task(pid)
    ollama.done_reason = "length"
    runner.tick(NIGHT)
    assert tasks(client)[0]["truncated"] is True


def test_running_tasks_requeued_after_restart(client, setup):
    mon, runner, pet, task = setup
    pid = pet()
    tid = task(pid).get_json()["id"]
    db.start_task(tid, NIGHT)
    assert db.requeue_running() == 1
    assert tasks(client)[0]["status"] == "queued"


# ------------------------------------------------------------ entregas y gestión
def test_seen_delete_and_summary(client, setup):
    mon, runner, pet, task = setup
    pid = pet()
    done = task(pid).get_json()["id"]
    runner.tick(NIGHT)
    queued = task(pid, title="Otra").get_json()["id"]
    summary = next(p for p in client.get("/api/pets").get_json()["pets"] if p["id"] == pid)["tasks"]
    assert summary == {"queued": 1, "running": None, "unseen": 1, "failed": 0}
    assert client.post(f"/api/tasks/{done}/seen").get_json()["seen_at"] is not None
    assert client.delete(f"/api/tasks/{queued}").status_code == 204
    db.start_task(task(pid).get_json()["id"], NIGHT)
    running = tasks(client, status="running")[0]["id"]
    assert client.delete(f"/api/tasks/{running}").status_code == 409
    summary = next(p for p in client.get("/api/pets").get_json()["pets"] if p["id"] == pid)["tasks"]
    assert summary["unseen"] == 0 and summary["running"]["id"] == running


def test_deleting_pet_removes_its_tasks(client, setup):
    mon, runner, pet, task = setup
    pid = pet()
    task(pid)
    client.delete(f"/api/pets/{pid}")
    assert tasks(client) == []
