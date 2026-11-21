# AI Council · instrucciones para Claude Code

Proyecto personal de Sebastian: un "consejo" de mascotas pixel-art (Tamagotchi) donde cada una es un modelo pequeño (Qwen3) en su propio dispositivo (4 Raspberry Pi + 2 celulares con Termux), todo conectado por Tailscale. Un servicio central, el **lobby**, muestra su estado, les da personalidad y reparte el trabajo. El estado actual, las mediciones y las preguntas abiertas están en `docs/estado.md`: léelo primero.

## Reglas del proyecto

- **Idioma:** interfaz, mensajes de error, commits y documentación en **español**. Identificadores de código en español o inglés, pero sin mezclar dentro de un mismo módulo (hoy el backend usa inglés técnico y textos de usuario en español).
- **Recursos mínimos.** El lobby corre en una **Pi 2 B (32 bits, 1 GB)**. Backend = Flask + SQLite + `urllib` de la biblioteca estándar. **No añadas dependencias** (requests, SQLAlchemy, npm, bundlers) sin justificarlo por escrito en `docs/estado.md`. El front es JavaScript con módulos ES nativos, **sin paso de compilación**.
- **Estética 32 bits.** Paleta única en `web/js/pixel.js` (`P`) y variables CSS en `web/css/app.css`. Canvas lógico 384×216 (horizontal) y 216×384 (vertical), dibujado 1:1 y escalado por CSS. La fuente bitmap está en `web/assets/font/`. No uses fuentes ni bordes redondeados modernos.
- **Los modelos son pequeños.** Cada tarea que se les dé debe caber en ~400 tokens de salida y 2k de contexto (`num_ctx 2048`). Prompts cortos, entradas explícitas.
- **Estados honestos.** No simules datos reales. Lo que sea de ejemplo debe decirlo en pantalla. Marca como *(est.)* toda cifra no medida.
- **Privacidad (obligatorio).** El dueño trabaja en radiología: **ningún dato de pacientes ni clínico debe entrar al Consejo ni a las búsquedas.** Cuando se construya el buscador, el filtro de privacidad es requisito previo a salir a internet (ver `docs/especificacion_lobby_v1.md` §4). No registres en logs el contenido de las consultas sin filtrar.
- **Seguridad de red.** El lobby hace peticiones a hosts que escribe el usuario: respeta `validate_target` (SSRF). No expongas el lobby fuera de la tailnet sin añadir autenticación.
- **Nada de `innerHTML` con datos del usuario.** Usa `textContent` o el helper `el()` de `panel.js`.
- **Verifica lo que dices.** Una función no está lista hasta que hay prueba que la ejercita (pytest para backend; `tests/e2e/e2e_ui.py` para interfaz). Documenta qué **no** se probó en hardware real.

## Comandos

```bash
pip install -r server/requirements.txt pytest playwright   # una vez
make test        # 27 pruebas del backend (≈10 s)
make dev         # lobby en http://localhost:8080 + 3 Ollama falsos (puertos 11501 ok, 11502 OOM, 11503 sin modelos)
make e2e         # interfaz con Playwright (con `make dev` corriendo); deja capturas en /tmp/council_shots
./deploy/deploy_lobby.sh USUARIO@lobby   # despliega en la Pi del lobby
```

## Mapa del código

| Ruta | Qué hay |
|---|---|
| `server/council/species.py` | Catálogo de las 6 especies: rol, modelo sugerido, rasgos, stats y ramas por defecto. **Fuente única**: el front lo lee de `/api/species`. |
| `server/council/probe.py` | Validación de host/puerto (SSRF), sondeo de Ollama, clasificación de errores, saludo. |
| `server/council/monitor.py` | Ciclo de conexión: hilo, histéresis, eventos, notificación a SSE. |
| `server/council/persona.py` | Rasgos + voz → prompt de sistema corto. |
| `server/council/db.py` | SQLite (WAL): `pets`, `branches`, `events`. |
| `server/council/app.py` | API REST + SSE + sirve `web/`. |
| `server/tools/fake_ollama.py` | Ollama falso (modos ok/oom/garbage/slow/vacio). |
| `web/js/pixel.js` | Primitivas canvas, fuente bitmap, sprites. |
| `web/js/board.js` | Tablero (canvas): habitaciones, estados, registro. |
| `web/js/panel.js` | Panel de alta/edición (DOM). |
| `prototype/` | Prototipo v1 de **todas** las pantallas (datos simulados). Es la referencia visual y de comportamiento de lo que falta portar. |
| `art/` | Rig de sprites (Python/PIL), exportadores y GIFs. |
| `deploy/` | Scripts de instalación por nodo (Pi y Termux) y despliegue del lobby. |
| `docs/` | Estado del proyecto, especificación, protocolo de conexión, plan, hitos. |

## Cómo trabajar los hitos

Sigue `docs/hitos.md` en orden. Para cada hito: (1) lee la sección correspondiente de `docs/especificacion_lobby_v1.md` y la pantalla del prototipo, (2) escribe primero las pruebas de aceptación, (3) implementa, (4) actualiza `docs/estado.md` (estado y lo no verificado). Haz commits pequeños en español.

## Sprites (si hay que tocarlos)

`art/rig/mascotas_v2.py` define 6 especies × 9 acciones (`idle think type read sleep celebrate walk error glitch`), 32×32 px, hoja de 6 columnas × 9 filas. `python3 art/rig/mascotas_export_v4.py` regenera hojas y GIFs (revisa la ruta `OUT` al inicio del script). Si cambias el número de frames o fps, regenera `web/assets/sprites/animations.json`: el front lo lee de ahí.
