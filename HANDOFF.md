# AI Council · Handoff a Claude Code

Fecha: 14-nov-2026 · Proyecto padre en Linear: **SEB-23** (sub-incidencias SEB-24…SEB-33; no pude leerlas sin sesión, así que `docs/hitos.md` no está atado a sus números salvo SEB-27, SEB-28, SEB-29 y SEB-30, citados en la especificación).

## 1. Qué es

Seis mascotas, cada una con un trabajo en una línea de producción de IA. Aprenden del usuario con minijuegos y formularios, y producen newsletters, sugerencias de búsqueda y mini-apps. Deciden en grupo (estilo AI Council), suben de nivel como en un juego y usan modelos pequeños con RAG propio por nodo. El **lobby** (web) muestra el estado de todos; si un nodo cae, su mascota aparece dormida o con glitch y un error descriptivo ("rotura de la cuarta pared").

| Mascota | Rol | Equipo | Modelo (sugerido) | Nombre de host |
|---|---|---|---|---|
| Lobby | recepción, estado, datos | Raspberry Pi 2 B v1.1 (32 bits, 1 GB, **sin Wi-Fi**: cable) | no ejecuta modelos | `lobby` |
| Ocelote | Constructor | Raspberry Pi 4 B | qwen3:4b (8 GB) o qwen3:1.7b | `ocelote` |
| Búho | Investigador | Galaxy A21s (Termux) | qwen3:0.6b | `buho` |
| Erizo | Crítico | Raspberry Pi 3 B v1.2 | qwen3:0.6b | `erizo` |
| Panda rojo | Anfitrión | Raspberry Pi 3 B v1.2 | qwen3:0.6b | `panda` |
| Kakapo | Archivista | Galaxy A12 (Termux) | qwen3-embedding:0.6b | `kakapo` |
| Armiño | *bloqueado* hasta nivel 5 del Consejo | por definir (¿Pi Zero 2 W?) | – | `armino` |

Los modelos y los reparos de RAM vienen de `deploy/`; ninguno se ha medido en el hardware real todavía.

## 2. Qué incluye este paquete

**Hecho y probado (contra un Ollama falso):**

- Backend: alta/edición/baja de mascotas, catálogo de especies, validación (nombre único, host/puerto, presupuesto de puntos de rama), **ciclo de conexión** con histéresis y eventos, saludo con prompt de personalidad, SSE. 27 pruebas pytest.
- Front: tablero en vivo con sprites según estado (idle/think/sleep/glitch/error), y el **panel de alta/edición** que pediste: personaje, nombre, host + puerto + modelo con "PROBAR CONEXIÓN" (muestra latencia, versión y modelos descargados, clicables), personalidad (5 rasgos + voz, con vista previa del prompt), estadísticas iniciales (ánimo y 3 puntos para repartir entre 3 ramas). Horizontal y vertical, probado con Playwright (escritorio 1152×648 y móvil 390×844).
- Instalación: `deploy/setup_pi.sh`, `setup_termux.sh`, `deploy_lobby.sh` (el servicio del lobby ahora ejecuta esta app).

**Solo prototipo (datos simulados, en `prototype/`):** CONSEJO (planificación con preguntas), ROADMAP (8 micro-tareas con dependencias), MASCOTAS (cuidado, minijuegos, ramas), BUSCAR (buscador con filtro). Son la especificación visual de los hitos 3–7.

**No verificado:**

- Nada se ha ejecutado en las Pi ni en los celulares. Los scripts de `deploy/` pasan `bash -n` y `shellcheck`, pero se escribieron de memoria sobre los métodos oficiales de Tailscale, Ollama y Termux.
- ~~Los campos de la API de Ollama vienen de memoria.~~ Verificados el 21-nov-2026 contra Ollama real (ver §2b), salvo una respuesta correcta de `/api/embed`.
- Rendimiento de Flask/SSE en una Pi 2 B (1 GB, ARMv7): sin medir.
- El panel se probó solo en Chromium (Playwright). Falta Safari/Firefox y un teléfono real.

## 2b. H1 en curso: primer contacto con hardware (21-nov-2026)

Sondeado desde el portátil de desarrollo, que está en la misma tailnet (`council.probe` y `curl` contra `http://<nodo>:11434`).

| Nodo | Tailscale | Ollama | Modelos | Resultado |
|---|---|---|---|---|
| ocelote (Pi 4) | 100.126.26.11 | 0.40.16 | qwen3:1.7b | sondeo 32 ms; saludo OK, **3,3 tok/s**, carga del modelo ≈35 s, primer saludo 49 s |
| qwen-a21s (Galaxy A21s) | 100.104.48.53 | 0.31.1 | qwen2.5:0.5b, qwen2.5:1.5b | saludo OK con qwen2.5:0.5b, **15,7 tok/s**, 12 s |
| qwen-a03s (Galaxy A03s) | 100.123.66.1 | 0.31.1 | qwen2.5:0.5b | saludo OK con qwen2.5:0.5b, **15,2 tok/s**, 15 s |
| lobby, panda, erizo | 100.68.15.108 · 100.68.253.40 · 100.81.114.43 | – | – | apagados (`ETIMEDOUT`) |

**Confirmado contra Ollama real:** `/api/version` → `{"version"}`; `/api/tags` → `models[].name` (además trae `details` y `capabilities`); `/api/chat` con `think:false` devuelve `message.content` sin `<think>` y con `eval_count`/`eval_duration`. En Ocelote, `keep_alive` efectivo = 10 min y contexto por defecto = 2048 (pregunta 7 resuelta **solo para Ocelote**, vía `/api/ps`).

**Corregido:** al generar sin el modelo, Ollama responde **HTTP 404** con `model 'x' not found` (0.40.16) o `model "x" not found, try pulling it first` (0.31.1, en `/api/embed`). Antes el saludo lo mostraba como `HTTP_404`; ahora es `MODEL_MISSING` con la orden `ollama pull`. Una ruta inexistente (`404 page not found`, texto plano) sigue siendo `HTTP_404`. El Ollama falso ahora responde 404 igual que el real si el modelo no está, y anuncia la versión 0.40.16. Pruebas: `test_hello_missing_model_is_model_missing` y `test_http_404_classification` (con los textos reales). Verificado además contra Ocelote y qwen-a21s.

**Pendiente / no verificado:**
- `/api/embed` con un modelo de embeddings real (ningún nodo lo tiene aún).
- Los celulares usan **qwen2.5** y Ollama 0.31.1, no qwen3; los nombres de Tailscale (`qwen-a21s`, `qwen-a03s`) no coinciden con `buho`/`kakapo` de `species.py`, y el handoff decía que Kakapo era un Galaxy A12. Falta que Sebastian decida qué celular es cada mascota y qué modelo lleva.
- Ocelote tiene qwen3:1.7b; `species.py` sugiere qwen3:4b (falta saber la RAM de esa Pi 4).
- Pi 3 (Panda, Erizo) y el lobby en la Pi 2 B: sin probar (apagados).

**Problemas del handoff corregidos (21-nov-2026):**
- `make test` fallaba de forma intermitente en `test_monitor_thread_end_to_end` con `database is locked`: el hilo del monitor y una petición abrían la BD nueva a la vez y el paso a WAL chocaba. Ahora `db.conn()` serializa la apertura con un candado (vale porque el lobby es un solo proceso; dos procesos sobre la misma BD seguirían expuestos). Prueba: `test_db_first_open_from_many_threads` (8 hilos × 10 BD nuevas; antes fallaba 2 de cada 3 veces, ahora 15/15 y `make test` 10/10).
- `server/tools/dev.sh` y `deploy/*.sh` habían perdido el bit de ejecución; restaurado (`make dev` vuelve a funcionar).
- ELIMINAR en el panel daba `TypeError` (se leía `S.pet` después de `close()`) y el registro no se refrescaba. Corregido en `panel.js`; la e2e ahora elimina a Búho y comprueba que desaparece sin errores de JS (antes de la corrección fallaba con ese error).

## 3. Cómo arrancar (5 minutos)

```bash
cd ai-council
pip install -r server/requirements.txt pytest playwright
make test          # 27 pruebas
make dev           # abre http://localhost:8080
```

`make dev` levanta tres Ollama falsos: **11501** (todo bien, modelos `qwen3:0.6b`, `qwen3:1.7b`, `qwen3-embedding:0.6b`), **11502** (sondeo bien, pero el saludo falla con OOM) y **11503** (sin modelos → `MODEL_MISSING`). En el panel, usa host `127.0.0.1` y esos puertos para ver cada estado. Un puerto sin servidor (p. ej. 11599) da `ECONNREFUSED` (glitch).

Con hardware real: `deploy/README_instalacion.md` (orden: Tailscale → lobby → mascotas con Pi → celulares) y luego `./deploy/deploy_lobby.sh USUARIO@lobby`. En el panel, el host es la IP de Tailscale (`100.x.y.z`) o el nombre MagicDNS (`ocelote`), puerto 11434.

## 4. Decisiones ya tomadas

- Un solo servicio Flask en el lobby sirve API + SSE + web estática; SQLite en WAL; sin npm ni bundler.
- Estado de la mascota derivado del sondeo: `glitch` = sin señal, `error` = contesta pero falla. Detalle en `docs/protocolo_conexion.md`.
- Personalidad = 5 rasgos (curiosidad, cautela, locuacidad, orden, humor; 0–100) + una "voz" libre de ≤280 caracteres → prompt de sistema de unos 600 caracteres (`persona.py`).
- Al alta: nivel 1, XP 0, 3 puntos que el usuario reparte entre las 3 ramas (máx. 3 por rama al inicio, 5 en total); los no gastados quedan como `points`.
- Armiño bloqueado (`COUNCIL_UNLOCK_ALL=1` lo desbloquea para desarrollo).
- Tablero: habitaciones del "Borrador A"; cuidado individual/ramas del "C"; planificación del "B"; roadmap nuevo; buscador nuevo (ver `docs/especificacion_lobby_v1.md`).

## 5. Preguntas abiertas (necesitan decisión de Sebastian)

1. **Buscador:** ¿SearXNG propio en la Pi 4 o API de pago (Brave, Tavily)? No lo pude verificar desde mi entorno. Bloquea el hito 6.
2. ¿Las búsquedas van en español, inglés o ambos? (los modelos pequeños suelen ir mejor en inglés, *est.*)
3. ¿Quién reasigna una tarea cuando su dueño cae? (hoy: espera.)
4. ¿Cuántos puntos de rama por nivel y por minijuego?
5. Función y equipo del Armiño.
6. ¿El lobby tiene pantalla (kiosco) o solo se abre desde otros equipos? Cambia el hito 8.
7. Los ajustes de contexto/keep-alive de Ollama del script (`CONTEXT_LENGTH=2048`, `KEEP_ALIVE=10m`) no están verificados contra la versión instalada.

## 6. Archivos clave para leer primero

`CLAUDE.md` → `docs/hitos.md` → `docs/protocolo_conexion.md` → `docs/especificacion_lobby_v1.md` → `server/council/app.py` y `web/js/panel.js`.
