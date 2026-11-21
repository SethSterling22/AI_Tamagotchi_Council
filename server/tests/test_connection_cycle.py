import time

from council import persona, probe
from council.species import SPECIES
from tools.fake_ollama import FakeOllama


def mk(client, ollama, **kw):
    body = {"species": "erizo", "name": "Erizo", "host": "127.0.0.1", "port": ollama.port, "model": "qwen3:0.6b"}
    body.update(kw)
    return client.post("/api/pets", json=body)


# ------------------------------------------------------------ validación
def test_species_catalog(client):
    r = client.get("/api/species").get_json()
    keys = [s["key"] for s in r["species"]]
    assert keys == ["ocelote", "buho", "erizo", "panda_rojo", "kakapo", "armino"]
    assert next(s for s in r["species"] if s["key"] == "armino")["locked"] is True
    assert len(r["traits"]) == 5


def test_locked_species_rejected(client, ollama):
    r = mk(client, ollama, species="armino", name="X")
    assert r.status_code == 403 and r.get_json()["error"]["code"] == "SPECIES_LOCKED"


def test_name_rules(client, ollama):
    assert mk(client, ollama, name="").status_code == 400
    assert mk(client, ollama, name="x" * 13).get_json()["error"]["code"] == "BAD_NAME"
    assert mk(client, ollama, name="<b>").get_json()["error"]["code"] == "BAD_NAME"
    assert mk(client, ollama, name="Spike").status_code == 201
    r = mk(client, ollama, name="spike")
    assert r.status_code == 409 and r.get_json()["error"]["code"] == "NAME_TAKEN"


def test_host_port_rules(client, ollama):
    assert mk(client, ollama, port=0).get_json()["error"]["field"] == "port"
    assert mk(client, ollama, port="abc").get_json()["error"]["code"] == "BAD_PORT"
    assert mk(client, ollama, host="").get_json()["error"]["field"] == "host"
    assert mk(client, ollama, host="8.8.8.8").get_json()["error"]["code"] == "HOST_FORBIDDEN"
    assert mk(client, ollama, host="169.254.169.254").get_json()["error"]["code"] == "HOST_FORBIDDEN"
    assert mk(client, ollama, host="google.com").get_json()["error"]["code"] == "HOST_FORBIDDEN"
    for ok in ("100.64.0.12", "192.168.1.20", "ocelote", "pi4.tail1234.ts.net", "127.0.0.1"):
        probe.validate_target(ok, 11434)


def test_branch_budget(client, ollama):
    assert mk(client, ollama, branch_levels=[2, 2, 0]).get_json()["error"]["code"] == "BUDGET"
    assert mk(client, ollama, branch_levels=[4, 0, 0]).get_json()["error"]["code"] == "OUT_OF_RANGE"
    r = mk(client, ollama, branch_levels=[1, 1, 0]).get_json()
    assert [b["level"] for b in r["branches"]] == [1, 1, 0] and r["points"] == 1 and r["level"] == 1


def test_defaults_from_species(client, ollama):
    r = client.post("/api/pets", json={"species": "buho", "name": "Hoot", "host": "127.0.0.1", "port": ollama.port}).get_json()
    assert r["model"] == "qwen3:0.6b" and r["traits"]["curiosidad"] == 90 and r["voice"]
    assert [b["name"] for b in r["branches"]] == ["INVESTIGAR", "RESUMIR", "CITAR"]


# ------------------------------------------------------------ sondeo
def test_probe_ok_and_models(client, ollama):
    r = client.post("/api/probe", json={"host": "127.0.0.1", "port": ollama.port, "model": "qwen3:0.6b"}).get_json()
    assert r["ok"] and r["state"] == "online" and r["models"] == ["qwen3:0.6b"] and r["model_present"] is True
    assert r["latency_ms"] is not None and r["version"]


def test_probe_missing_model_is_error_state(client, ollama):
    r = client.post("/api/probe", json={"host": "127.0.0.1", "port": ollama.port, "model": "qwen3:4b"}).get_json()
    assert not r["ok"] and r["state"] == "error" and r["error"]["code"] == "MODEL_MISSING"
    assert "ollama pull qwen3:4b" in r["error"]["message"]


def test_probe_refused_is_glitch(client):
    f = FakeOllama().start(); port = f.port; f.stop()  # puerto cerrado
    r = client.post("/api/probe", json={"host": "127.0.0.1", "port": port}).get_json()
    assert r["state"] == "glitch" and r["error"]["code"] == "ECONNREFUSED"


def test_probe_garbage_is_error(client):
    f = FakeOllama(mode="garbage").start()
    try:
        r = client.post("/api/probe", json={"host": "127.0.0.1", "port": f.port}).get_json()
        assert r["state"] == "error" and r["error"]["code"] == "BAD_RESPONSE"
    finally:
        f.stop()


def test_probe_dns_failure_is_glitch(client):
    r = client.post("/api/probe", json={"host": "nodo-que-no-existe", "port": 11434}).get_json()
    assert r["state"] == "glitch" and r["error"]["code"] in ("ENOTFOUND", "ENETUNREACH", "ETIMEDOUT")


# ------------------------------------------------------------ ciclo completo
def test_full_cycle_online_drop_recover(app, client, ollama):
    mon = app.config["monitor"]
    pet = mk(client, ollama).get_json()
    pid = pet["id"]
    mon.check(pid)
    assert client.get(f"/api/pets/{pid}").get_json()["status"]["state"] == "online"
    # el nodo cae: primer fallo tolerado (histéresis), segundo → glitch
    ollama.stop()
    mon.check(pid)
    assert mon.rt[pid]["state"] == "online"
    mon.check(pid)
    st = client.get(f"/api/pets/{pid}").get_json()["status"]
    assert st["state"] == "glitch" and st["error"]["code"] == "ECONNREFUSED"
    ev = client.get("/api/events").get_json()["events"]
    assert any("online → glitch" in e["detail"] for e in ev)
    # vuelve en el mismo puerto
    f2 = FakeOllama(port=ollama.port).start()
    try:
        mon.check(pid)
        assert mon.rt[pid]["state"] == "online" and mon.rt[pid]["error"] is None
    finally:
        f2.stop()


def test_new_pet_unreachable_goes_glitch_immediately(app, client):
    f = FakeOllama().start(); port = f.port; f.stop()
    pid = client.post("/api/pets", json={"species": "erizo", "name": "Solo", "host": "127.0.0.1", "port": port}).get_json()["id"]
    app.config["monitor"].check(pid)
    assert app.config["monitor"].rt[pid]["state"] == "glitch"


def test_edit_host_rechecks_without_hysteresis(app, client, ollama):
    mon = app.config["monitor"]
    pid = mk(client, ollama).get_json()["id"]
    mon.check(pid)
    f = FakeOllama().start(); dead = f.port; f.stop()
    client.patch(f"/api/pets/{pid}", json={"port": dead})
    time.sleep(0.3)
    mon.check(pid)
    assert mon.rt[pid]["state"] == "glitch"


def test_hello_ok_and_failure(app, client, ollama):
    pid = mk(client, ollama).get_json()["id"]
    r = client.post(f"/api/pets/{pid}/hello").get_json()
    assert r["ok"] and "mascota de prueba" in r["text"] and "think" not in r["text"] and r["tps"] == 5.0
    # system prompt enviado con la personalidad
    sent = [c for c in ollama.calls if c[0] == "POST"][-1][2]
    assert sent["messages"][0]["role"] == "system" and "Erizo" in sent["messages"][0]["content"]
    assert sent["think"] is False and sent["options"]["num_ctx"] == 2048
    ollama.mode = "oom"
    r = client.post(f"/api/pets/{pid}/hello")
    assert r.status_code == 502 and r.get_json()["error"]["code"] == "OOM"


def test_kakapo_uses_embeddings(app, client, ollama):
    ollama.models.append("qwen3-embedding:0.6b")
    pid = client.post("/api/pets", json={"species": "kakapo", "name": "Kaka", "host": "127.0.0.1",
                                         "port": ollama.port}).get_json()["id"]
    r = client.post(f"/api/pets/{pid}/hello").get_json()
    assert r["ok"] and r["dims"] == 1024


def test_hello_missing_model_is_model_missing(app, client, ollama):
    # Ollama real (0.31.1 y 0.40.16) responde 404 {"error":"model '…' not found"} al generar sin el modelo
    pid = mk(client, ollama).get_json()["id"]
    ollama.models.clear()
    r = client.post(f"/api/pets/{pid}/hello")
    err = r.get_json()["error"]
    assert r.status_code == 502 and err["code"] == "MODEL_MISSING" and err["state"] == "error"
    assert "ollama pull qwen3:0.6b" in err["message"]
    pid = client.post("/api/pets", json={"species": "kakapo", "name": "Kaka", "host": "127.0.0.1",
                                         "port": ollama.port}).get_json()["id"]
    err = client.post(f"/api/pets/{pid}/hello").get_json()["error"]
    assert err["code"] == "MODEL_MISSING" and "qwen3-embedding:0.6b" in err["message"]


def test_http_404_classification():
    # textos reales copiados de Ollama 0.40.16 (Pi 4) y 0.31.1 (Termux)
    for txt in ('{"error":"model \'qwen3:0.6b\' not found"}',
                '{"error":"model \\"qwen3:0.6b\\" not found, try pulling it first"}'):
        e = probe._http_error(404, txt)
        assert e.code == "MODEL_MISSING" and "ollama pull qwen3:0.6b" in e.message
    e = probe._http_error(404, "404 page not found")  # ruta inexistente: no es falta de modelo
    assert e.code == "HTTP_404"


def test_delete_and_snapshot(app, client, ollama):
    pid = mk(client, ollama).get_json()["id"]
    assert len(client.get("/api/pets").get_json()["pets"]) == 1
    assert client.delete(f"/api/pets/{pid}").status_code == 204
    assert client.get("/api/pets").get_json()["pets"] == []
    assert client.get(f"/api/pets/{pid}").status_code == 404


def test_version_bumps_on_change(app, client, ollama):
    mon = app.config["monitor"]
    v0 = mon.version
    pid = mk(client, ollama).get_json()["id"]
    mon.check(pid)
    assert mon.version > v0


def test_monitor_thread_end_to_end(tmp_path, monkeypatch, ollama):
    from council import db
    from council.app import create_app
    from council.monitor import Monitor
    monkeypatch.setenv("COUNCIL_DB", str(tmp_path / "m.db")); db._local.__dict__.clear()
    mon = Monitor(interval_ok=0.2, interval_bad=0.1, timeout=1.0)
    app = create_app(mon, autostart=True)
    c = app.test_client()
    pid = c.post("/api/pets", json={"species": "erizo", "name": "Vivo", "host": "127.0.0.1", "port": ollama.port}).get_json()["id"]
    for _ in range(40):
        if c.get(f"/api/pets/{pid}").get_json()["status"]["state"] == "online":
            break
        time.sleep(0.1)
    mon.stop()
    assert c.get(f"/api/pets/{pid}").get_json()["status"]["state"] == "online"


def test_db_first_open_from_many_threads(tmp_path, monkeypatch):
    # el hilo del monitor y las peticiones abren la BD nueva a la vez; antes daba «database is locked» (WAL)
    import threading
    from council import db
    for i in range(10):
        monkeypatch.setenv("COUNCIL_DB", str(tmp_path / f"r{i}.db"))
        go, errs = threading.Barrier(8), []

        def worker():
            go.wait()
            try:
                db.list_pets()
            except Exception as e:  # noqa: BLE001
                errs.append(repr(e))
        ts = [threading.Thread(target=worker) for _ in range(8)]
        [t.start() for t in ts]; [t.join() for t in ts]
        assert not errs, errs


# ------------------------------------------------------------ personalidad
def test_persona_prompt_reacts_to_traits():
    t = dict(SPECIES["panda_rojo"]["traits"])
    a = persona.build_system_prompt("panda_rojo", "Bao", "ANFITRIÓN", t, "")
    t.update(locuacidad=5, humor=5)
    b = persona.build_system_prompt("panda_rojo", "Bao", "ANFITRIÓN", t, "Voz X.")
    assert "3 frases" in a and "1 frase." in b and "Voz X." in b and "humor suave" in a and "Tono serio" in b
    assert len(a) < 700  # cabe holgado en ctx 2k


def test_persona_preview_endpoint(client):
    r = client.post("/api/persona-preview", json={"species": "ocelote", "name": "Rex", "traits": {"orden": 10}}).get_json()
    assert "Rex" in r["system_prompt"] and "informal con la estructura" in r["system_prompt"]


def test_armino_unlock_flag(client, ollama, monkeypatch):
    monkeypatch.setenv("COUNCIL_UNLOCK_ALL", "1")
    r = client.post("/api/pets", json={"species": "armino", "name": "Blanco", "host": "127.0.0.1", "port": ollama.port, "model": "qwen3:0.6b"})
    assert r.status_code == 201


def test_sse_first_event_has_snapshot(app, client, ollama):
    mk(client, ollama)
    resp = client.get("/api/stream", buffered=False)
    first = next(iter(resp.response)).decode()
    assert first.startswith("data: ") and '"pets"' in first
    resp.close()


def test_static_front_served(client):
    assert client.get("/").status_code == 200
    for f in ("js/main.js", "js/panel.js", "css/app.css", "assets/sprites/animations.json", "assets/font/font_regular.png",
              "assets/sprites/ocelote_spritesheet.png"):
        assert client.get("/" + f).status_code == 200, f
    assert client.get("/../server/council/app.py").status_code in (404, 400)
    assert client.get("/api/nada").status_code == 404
