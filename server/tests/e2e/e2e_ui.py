"""E2E del panel de alta con Playwright. Requiere el entorno de tools/dev.sh corriendo en :8080.
   python tests/e2e/e2e_ui.py [carpeta_capturas]"""
import sys
from playwright.sync_api import sync_playwright

OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/shots"
URL = "http://localhost:8080/"
errs = []

def add_pet(page, species, name, host, port, model, probe=True, branch=None):
    page.evaluate("window.__click('btn:add')")
    page.wait_for_selector(".sheet")
    page.click(f'.tile[data-species="{species}"]')
    page.fill("#f-name", name); page.fill("#f-host", host); page.fill("#f-port", str(port)); page.fill("#f-model", model)
    if probe:
        page.click("#btn-probe"); page.wait_for_selector(".conn-result.ok, .conn-result.err, .conn-result.glitch")
    for i, n in enumerate(branch or []):
        for _ in range(n):
            page.click(f".branch:nth-child({i+1}) .pm:last-child")
    return page

with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page(viewport={"width": 1152, "height": 648}, device_scale_factor=1)
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.on("console", lambda m: errs.append(m.text) if m.type == "error" and "Failed to load resource" not in m.text else None)  # 4xx/5xx esperados en las pruebas de validación
    page.goto(URL); page.wait_for_selector("body[data-ready]"); page.wait_for_timeout(600)
    page.screenshot(path=f"{OUT}/01_vacio.png")

    page.evaluate("window.__click('btn:add')"); page.wait_for_selector(".sheet")
    page.screenshot(path=f"{OUT}/02_panel_vacio.png")
    assert page.is_disabled("#btn-save"), "guardar debe estar deshabilitado sin personaje"
    assert page.is_disabled('.tile[data-species="armino"]'), "armiño bloqueado"
    page.keyboard.press("Escape")

    # 1) Ocelote: prueba ok, ramas 2+1
    add_pet(page, "ocelote", "Ocelote", "127.0.0.1", 11501, "qwen3:1.7b", branch=[2, 1, 0])
    page.wait_for_timeout(500)
    page.screenshot(path=f"{OUT}/03_panel_conexion_ok.png")
    assert "EN LÍNEA" in page.inner_text(".conn-result")
    assert "PUNTOS INICIALES: 0" in page.inner_text(".pts")
    page.click("#btn-save"); page.wait_for_selector(".sheet", state="detached")

    # 2) Búho: puerto cerrado → glitch (guardar igual)
    add_pet(page, "buho", "Búho", "127.0.0.1", 11599, "qwen3:0.6b")
    page.wait_for_timeout(300)
    page.screenshot(path=f"{OUT}/04_panel_glitch.png")
    assert "SIN SEÑAL" in page.inner_text(".conn-result") and "ECONNREFUSED" in page.inner_text(".conn-result")
    page.click("#btn-save"); page.wait_for_selector(".sheet", state="detached")

    # 3) Panda: sin modelos → MODEL_MISSING (error)
    add_pet(page, "panda_rojo", "Panda", "127.0.0.1", 11503, "qwen3:0.6b")
    assert "MODEL_MISSING" in page.inner_text(".conn-result")
    page.click("#btn-save"); page.wait_for_selector(".sheet", state="detached")

    # 4) Erizo: ok pero OOM al saludar
    add_pet(page, "erizo", "Erizo", "127.0.0.1", 11502, "qwen3:0.6b", branch=[0, 0, 0])
    page.click("#btn-save"); page.wait_for_selector(".sheet", state="detached")

    # 5) Kakapo (embeddings)
    add_pet(page, "kakapo", "Kakapo", "127.0.0.1", 11501, "qwen3-embedding:0.6b")
    page.click("#btn-save"); page.wait_for_selector(".sheet", state="detached")

    # validaciones del servidor reflejadas en el formulario
    page.evaluate("window.__click('slot:add')"); page.wait_for_selector(".sheet")
    page.click('.tile[data-species="ocelote"]'); page.fill("#f-name", "erizo"); page.fill("#f-host", "8.8.8.8")
    page.click("#btn-save"); page.wait_for_timeout(400)
    assert "Ya existe" in page.inner_text('.ferr[data-for="name"]'), page.inner_text(".sheet")
    page.fill("#f-name", "Rex"); page.click("#btn-save"); page.wait_for_timeout(400)
    assert "IPs de red local" in page.inner_text('.ferr[data-for="host"]')
    page.screenshot(path=f"{OUT}/05_panel_errores.png")
    page.keyboard.press("Escape")

    page.wait_for_timeout(2500)
    page.screenshot(path=f"{OUT}/06_tablero.png")
    states = page.evaluate("window.__state.pets.map(p => [p.name, p.status.state, p.status.error && p.status.error.code])")
    print(states)
    st = dict((n, s) for n, s, _ in states)
    assert st["Ocelote"] == "online" and st["Búho"] == "glitch" and st["Panda"] == "error" and st["Erizo"] == "online" and st["Kakapo"] == "online", st

    # edición: abrir Erizo, saludar (OOM), ver prompt
    page.evaluate("window.__click('room:erizo')"); page.wait_for_selector(".sheet")
    page.click("#btn-hello"); page.wait_for_selector(".hello.err")
    assert "OOM" in page.inner_text("#hello-out")
    page.click("summary"); page.wait_for_timeout(500)
    page.screenshot(path=f"{OUT}/07_editar_saludo_oom.png")
    page.keyboard.press("Escape")
    # edición: abrir Ocelote, saludar ok
    page.evaluate("window.__click('room:ocelote')"); page.wait_for_selector(".sheet")
    page.click("#btn-hello"); page.wait_for_selector(".hello.ok")
    print(page.inner_text("#hello-out"))
    page.keyboard.press("Escape")
    # eliminar: Búho (doble clic de confirmación); antes daba TypeError tras cerrar el panel
    page.evaluate("window.__click('room:buho')"); page.wait_for_selector(".sheet")
    page.click("#btn-delete"); assert "SEGURO" in page.inner_text("#btn-delete")
    page.click("#btn-delete"); page.wait_for_selector(".sheet", state="detached")
    page.wait_for_function("!window.__state.pets.some(p => p.name === 'Búho')", timeout=5000)

    # ciclo día/noche: horas relativas a «ahora» en la zona de prueba
    hhmm = "(m) => new Intl.DateTimeFormat('en-GB', {timeZone: 'America/Puerto_Rico', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).format(new Date(Date.now() + m * 60000))"
    assert page.evaluate("window.__state.cycle && ['noche','amanecer','dia','atardecer'].includes(window.__state.cycle.phase)")
    page.evaluate(f"""async () => {{ const f = {hhmm};
      await fetch('api/cycle', {{method: 'PUT', headers: {{'Content-Type': 'application/json'}},
        body: JSON.stringify({{sleep: f(-60), wake: f(300), tz: 'America/Puerto_Rico'}})}}); }}""")
    page.wait_for_function("window.__state.cycle.phase === 'noche' && window.__state.cycle.configured", timeout=5000)
    page.wait_for_timeout(600)
    acts = dict(page.evaluate("window.__acts()"))
    assert acts["Ocelote"] == "idle" and acts["Panda"] == "error", acts  # de noche: de guardia; el error manda sobre la fase
    page.screenshot(path=f"{OUT}/11_noche.png")
    # abrir la hoja desde la cabecera, probar la validación y pasar a pleno día
    page.evaluate("window.__click('btn:cycle')"); page.wait_for_selector("#cy-save")
    assert "NOCHE" in page.inner_text(".phases .ph.now")
    page.fill("#cy-wake", page.evaluate(f"({hhmm})(-180)")); page.fill("#cy-sleep", page.evaluate(f"({hhmm})(-150)"))
    page.click("#cy-save"); page.wait_for_timeout(400)
    assert "2 horas despierto" in page.inner_text('.ferr[data-for="sleep"]'), page.inner_text(".sheet")
    page.fill("#cy-sleep", page.evaluate(f"({hhmm})(480)"))
    page.screenshot(path=f"{OUT}/12_ajustes_ciclo.png")
    page.click("#cy-save"); page.wait_for_selector("#cy-save", state="detached")
    page.wait_for_function("window.__state.cycle.phase === 'dia'", timeout=5000)
    page.wait_for_timeout(600)
    acts = dict(page.evaluate("window.__acts()"))
    assert acts["Ocelote"] == "sleep" and acts["Kakapo"] == "sleep", acts  # de día duermen
    page.screenshot(path=f"{OUT}/13_dia.png")

    # encomiendas: se encargan de día, se trabajan de noche y se recogen al amanecer
    setcy = lambda sleep, wake: page.evaluate(f"""async () => {{ const f = {hhmm};
      await fetch('api/cycle', {{method: 'PUT', headers: {{'Content-Type': 'application/json'}},
        body: JSON.stringify({{sleep: f({sleep}), wake: f({wake}), tz: 'America/Puerto_Rico'}})}}); }}""")
    task_of = "(n) => window.__state.pets.find(p => p.name === n).tasks"
    page.evaluate("window.__click('btn:tasks')"); page.wait_for_selector("#tk-save")
    assert "pacientes" in page.inner_text("#tk-privacy")
    opts = page.eval_on_selector_all("#tk-pet option", "os => os.map(o => o.textContent)")
    assert any("Ocelote" in o for o in opts) and not any("Kakapo" in o for o in opts), opts  # Kakapo es de embeddings
    page.select_option("#tk-pet", label=next(o for o in opts if "Ocelote" in o))
    page.fill("#tk-title", "Ideas de cena"); page.click("#tk-save"); page.wait_for_timeout(300)
    assert "encargo" in page.inner_text('.ferr[data-for="prompt"]').lower()
    page.fill("#tk-prompt", "Propón tres cenas rápidas con lo que suele haber en casa.")
    page.click("#tk-save"); page.wait_for_selector("#tasks-queue .task")
    assert "Ideas de cena" in page.inner_text("#tasks-queue") and "la trabajará esta noche" in page.inner_text("#tk-msg")
    page.screenshot(path=f"{OUT}/14_encomienda_nueva.png")
    page.keyboard.press("Escape")
    page.wait_for_function(f"({task_of})('Ocelote').queued === 1")
    assert dict(page.evaluate("window.__acts()"))["Ocelote"] == "sleep"  # de día no trabaja: duerme con su encargo en cola
    setcy(-60, 300)  # noche: el ejecutor la arranca contra el Ollama falso
    page.wait_for_function(f"({task_of})('Ocelote').unseen === 1", timeout=10000)
    setcy(-310, -10)  # amanecer: entrega lista
    page.wait_for_function("window.__state.cycle.phase === 'amanecer'", timeout=5000); page.wait_for_timeout(600)
    assert dict(page.evaluate("window.__acts()"))["Ocelote"] == "celebrate"
    page.screenshot(path=f"{OUT}/15_amanecer_entrega.png")
    page.evaluate("window.__click('btn:tasks')"); page.wait_for_selector("#tasks-done .task.done")
    assert "mascota de prueba" in page.inner_text("#tasks-done") and "NUEVA" in page.inner_text("#tasks-done")
    page.screenshot(path=f"{OUT}/16_entregas.png")
    page.click('#tasks-done [data-act="seen"]')
    page.wait_for_function(f"({task_of})('Ocelote').unseen === 0", timeout=5000)
    page.keyboard.press("Escape")

    # móvil vertical
    m = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    m.on("pageerror", lambda e: errs.append(str(e)))
    m.goto(URL); m.wait_for_selector("body[data-ready]"); m.wait_for_timeout(2500)
    m.screenshot(path=f"{OUT}/08_movil_tablero.png")
    m.evaluate("window.__click('btn:add')"); m.wait_for_selector(".sheet")
    m.click('.tile[data-species="panda_rojo"]'); m.wait_for_timeout(300)
    m.screenshot(path=f"{OUT}/09_movil_panel.png")
    m.evaluate("document.querySelector('.body').scrollTo(0, 99999)"); m.wait_for_timeout(300)
    m.screenshot(path=f"{OUT}/10_movil_panel_stats.png")
    b.close()
print("errores de consola/JS:", errs)
assert not errs
print("E2E OK")
