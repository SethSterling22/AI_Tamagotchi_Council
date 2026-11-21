# AI Council · estado del proyecto

Última actualización: 21-nov-2026 · Proyecto padre en Linear: **SEB-23** (`docs/hitos.md` solo cita SEB-27 a SEB-30).

## 1. Qué es

Seis mascotas, cada una con un trabajo en una línea de producción de IA. Aprenden del usuario con minijuegos y formularios, y producen newsletters, sugerencias de búsqueda y mini-apps. Deciden en grupo (estilo AI Council), suben de nivel como en un juego y usan modelos pequeños con RAG propio por nodo. El **lobby** (web) muestra el estado de todos; si un nodo cae, su mascota aparece dormida o con glitch y un error descriptivo ("rotura de la cuarta pared").

| Mascota | Rol | Equipo | Modelo | Nombre de host |
|---|---|---|---|---|
| Lobby | recepción, estado, datos | Raspberry Pi 2 B v1.1 (32 bits, 1 GB, **sin Wi-Fi**: cable) | no ejecuta modelos | `lobby` |
| Ocelote | Constructor | Raspberry Pi 4 B Rev 1.4 (4 GB) | qwen3:1.7b (medido) | `ocelote` |
| Búho | Investigador | Galaxy A21s (Termux) *(por confirmar)* | qwen3:0.6b (sugerido) | `buho` (hoy `qwen-a21s`) |
| Erizo | Crítico | Raspberry Pi 3 B v1.2 | qwen3:0.6b (sugerido) | `erizo` |
| Panda rojo | Anfitrión | Raspberry Pi 3 B v1.2 | qwen3:0.6b (sugerido) | `panda` |
| Kakapo | Archivista | Galaxy A03s (Termux) *(por confirmar; el plan original decía A12)* | qwen3-embedding:0.6b (sugerido) | `kakapo` (hoy `qwen-a03s`) |
| Armiño | *bloqueado* hasta nivel 5 del Consejo | por definir (¿Pi Zero 2 W?) | – | `armino` |

## 2. Qué está hecho

**Hecho y probado** (27 pruebas pytest + e2e con Playwright, contra un Ollama falso):

- Backend: alta/edición/baja de mascotas, catálogo de especies, validación (nombre único, host/puerto, presupuesto de puntos de rama), **ciclo de conexión** con histéresis y eventos, saludo con prompt de personalidad, SSE.
- Front: tablero en vivo con sprites según estado (idle/think/sleep/glitch/error) y panel de alta/edición (personaje, nombre, host + puerto + modelo con "PROBAR CONEXIÓN", personalidad con vista previa del prompt, estadísticas iniciales). Horizontal y vertical (escritorio 1152×648 y móvil 390×844).
- Instalación: `deploy/setup_pi.sh`, `setup_termux.sh`, `deploy_lobby.sh`, `inventario_nodo.sh`.

**Solo prototipo** (datos simulados, en `prototype/`): CONSEJO, ROADMAP, MASCOTAS, BUSCAR. Son la especificación visual de los hitos 3–7.

## 3. H1 en curso: primer contacto con hardware

Sondeado desde el portátil de desarrollo, que está en la misma tailnet (`council.probe` y `curl` contra `http://<nodo>:11434`).

| Nodo | Tailscale | Ollama | Modelos | Resultado |
|---|---|---|---|---|
| ocelote (Pi 4, 4 GB) | 100.126.26.11 | 0.40.16 | qwen3:1.7b | sondeo 32 ms; saludo OK, **3,3 tok/s**, carga del modelo ≈35 s, primer saludo 49 s. Inventario: 3796 MB de RAM, 2 GB de swap, 48 GB libres, 38,5 °C, `throttled=0x0`; benchmark 3,2 tok/s de generación, ≈8–9 tok/s de lectura del prompt |
| qwen-a21s (Galaxy A21s) | 100.104.48.53 | 0.31.1 | qwen2.5:0.5b, qwen2.5:1.5b | saludo OK con qwen2.5:0.5b, **15,7 tok/s**, 12 s; lectura del prompt ≈30 tok/s |
| qwen-a03s (Galaxy A03s) | 100.123.66.1 | 0.31.1 | qwen2.5:0.5b | saludo OK con qwen2.5:0.5b, **15,2 tok/s**, 15 s |
| lobby, panda, erizo | 100.68.15.108 · 100.68.253.40 · 100.81.114.43 | – | – | apagados (`ETIMEDOUT`) |

**Confirmado contra Ollama real:** `/api/version` → `{"version"}`; `/api/tags` → `models[].name` (además trae `details` y `capabilities`); `/api/chat` con `think:false` devuelve `message.content` sin `<think>` y con `eval_count`/`eval_duration`. En Ocelote, `keep_alive` efectivo = 10 min y contexto por defecto = 2048 (vía `/api/ps`). Al generar sin el modelo, Ollama responde HTTP 404 `model '…' not found` → se clasifica como `MODEL_MISSING`.

**Pendiente / no verificado:**
- `/api/embed` con un modelo de embeddings real (ningún nodo lo tiene aún).
- Los celulares usan **qwen2.5** y Ollama 0.31.1, no qwen3, y aún no se les ha pasado `setup_termux.sh`. Falta confirmar qué celular es cada mascota y renombrarlos en Tailscale.
- Pi 3 (Panda, Erizo) y el lobby en la Pi 2 B: sin probar (apagados). Rendimiento de Flask/SSE en la Pi 2 B: sin medir.
- Los scripts de `deploy/` se escribieron de memoria; solo `setup_pi.sh` en Ocelote está comprobado por su resultado.
- El panel se probó solo en Chromium (Playwright). Falta Safari/Firefox y un teléfono real.

**Distribución del código:** cada nodo clona el repo (`git clone --depth 1 … ~/ai-council`; el lobby en `/opt/council/app`) y se actualiza con `git pull --ff-only`. En los nodos no se edita nada.

## 4. Evaluaciones

### Pi (agente de programación) junto al modelo de cada nodo — no recomendado por ahora (21-nov-2026)

Se reprodujo lo que Pi 1.6.0 (`@earendil-works/pi-coding-agent`) envía a Ollama: su prompt de sistema por defecto + las 4 herramientas (read, bash, edit, write), sin ejecutar ninguna herramienta. Misma tarea ("¿cuántos `.sh` hay en `deploy/`?"), `think:false`, `num_ctx 2048`:

| Nodo · modelo | Formato del Consejo | Pi (turno 1) | Pi (turno 2, con resultado de la herramienta) |
|---|---|---|---|
| Ocelote · qwen3:1.7b | 101 tok de prompt, 22 s en total | **1215 tok de prompt, 155 s solo en leerlo**; llamada válida a `bash` | 1316 tok (caché de prefijo), 58 s; cuenta mal (incluye el `.md`) |
| A21s · qwen2.5:0.5b | 93 tok, 16 s | 1207 tok, 61 s; **no llama a ninguna herramienta** | – |

Conclusiones: Pi no acelera el modelo; añade ≈1100 tokens fijos por conversación (≈2,5 min de lectura en la Pi 4 cada vez que se pierde la caché) y deja ≈700 tokens libres de 2048 tras una sola ronda de herramienta. qwen2.5:0.5b no usa herramientas; qwen3:1.7b sí, pero razona mal el resultado. Además exige Node ≥ 22.19 y su herramienta `bash` no tiene permisos: un modelo pequeño ejecutaría órdenes sin control en el nodo. RAM de Node en la Pi: sin medir.

## 5. Decisiones ya tomadas

- Un solo servicio Flask en el lobby sirve API + SSE + web estática; SQLite en WAL; sin npm ni bundler.
- Estado de la mascota derivado del sondeo: `glitch` = sin señal, `error` = contesta pero falla. Detalle en `docs/protocolo_conexion.md`.
- Personalidad = 5 rasgos (curiosidad, cautela, locuacidad, orden, humor; 0–100) + una "voz" libre de ≤280 caracteres → prompt de sistema de unos 600 caracteres (`persona.py`).
- Al alta: nivel 1, XP 0, 3 puntos que el usuario reparte entre las 3 ramas (máx. 3 por rama al inicio, 5 en total); los no gastados quedan como `points`.
- Armiño bloqueado (`COUNCIL_UNLOCK_ALL=1` lo desbloquea para desarrollo).
- Tablero: habitaciones del "Borrador A"; cuidado individual/ramas del "C"; planificación del "B"; roadmap nuevo; buscador nuevo (ver `docs/especificacion_lobby_v1.md`).

## 6. Preguntas abiertas

1. **Buscador:** ¿SearXNG propio en la Pi 4 o API de pago (Brave, Tavily)? Bloquea el hito 7.
2. ¿Las búsquedas van en español, inglés o ambos? (los modelos pequeños suelen ir mejor en inglés, *est.*)
3. ¿Quién reasigna una tarea cuando su dueño cae? (hoy: espera.)
4. ¿Cuántos puntos de rama por nivel y por minijuego?
5. Función y equipo del Armiño.
6. ¿El lobby tiene pantalla (kiosco) o solo se abre desde otros equipos? Cambia el hito 8.
7. ~~Contexto/keep-alive de Ollama.~~ Confirmado en Ocelote (2048 y 10 min); falta en los demás nodos.
8. ¿Qué celular es Búho y cuál Kakapo, y qwen3 o qwen2.5 en los celulares?

## 7. Entorno de desarrollo

`make dev` levanta el lobby en `http://localhost:8080` y tres Ollama falsos: **11501** (todo bien, modelos `qwen3:0.6b`, `qwen3:1.7b`, `qwen3-embedding:0.6b`), **11502** (sondeo bien, pero el saludo falla con OOM) y **11503** (sin modelos → `MODEL_MISSING`). En el panel, usa host `127.0.0.1` y esos puertos. Un puerto sin servidor (p. ej. 11599) da `ECONNREFUSED` (glitch).

Con hardware real: `deploy/README_instalacion.md`. En el panel, el host es la IP de Tailscale (`100.x.y.z`) o el nombre MagicDNS (`ocelote`), puerto 11434.
