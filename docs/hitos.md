# Hitos (en orden)

Cada hito termina con pruebas verdes y `HANDOFF.md` actualizado. Referencia visual: la pantalla equivalente en `prototype/dist/lobby_concilio_v1.html` (escritorio) y `_movil.html`.

## H0 · Esqueleto + ciclo de conexión — **hecho** (ver HANDOFF §2)
Aceptación cumplida: dar de alta una mascota con host/puerto/personaje/nombre/personalidad/stats, ver su estado real, editarla, saludarla y borrarla.

## H1 · Primer contacto con hardware real
1. Confirmar contra Ollama real los campos de API usados (`docs/protocolo_conexion.md` §8); corregir `probe.py` y `fake_ollama.py` si difieren.
2. Alta de las 6 mascotas reales; `python -m council` en la Pi 2 B; medir CPU/RAM del lobby con 6 nodos y SSE abierto *(si pasa de ~40 % de CPU, pasar a diffs en SSE)*.
3. `inventario_nodo.sh` en cada nodo → guardar tok/s reales y ajustar `model_suggested` en `species.py`.
**Aceptación:** las 6 en línea; apagar un nodo lo muestra en `glitch` ≤ 15 s con `ETIMEDOUT`/`ECONNREFUSED`; volver a encenderlo lo recupera solo.

## H2 · Latido del nodo y actividad (SEB-27)
Cada nodo publica por MQTT (`council/<slug>/hb`) estado, tarea actual y RAM/temperatura; el lobby lo cruza con el sondeo. Mosquitto ya lo instala `setup_pi.sh lobby`. Añadir `paho-mqtt` solo en el lobby (ya está en el venv). El sprite pasa a reflejar la actividad real (`type`, `read`, `think`, `walk`).
**Aceptación:** sin latido > 30 s con sondeo OK → "nodo vivo, agente parado" (error descriptivo distinto de glitch).

## H3 · Pestañas y tablero completo
Portar la cabecera con pestañas y el TABLERO del prototipo (muebles de las habitaciones, tarea actual con barra, registro del lobby). La barra de energía y el ánimo ya existen en BD (`stats`): hacer que se muevan (decaen con el trabajo, suben con el cuidado).
**Aceptación:** el tablero del prototipo, con datos reales.

## H4 · MASCOTAS: cuidado, minijuegos y ramas reales
Portar la pantalla MASCOTAS. Persistir puntos, XP y niveles en `pets`/`branches`. Cada rama cambia un **parámetro medible** (tabla en la especificación §5), leído por el runner de tareas. Nodo caído → panel de ramas bloqueado con el error.
**Aceptación:** subir INVESTIGAR del Búho cambia `search_budget` de sus tareas (con prueba).

## H5 · CONSEJO: planificación con modelos reales
Tabla `brief`. La Panda formula las preguntas con su modelo (salida estructurada, ≤400 tokens; con plantilla de respaldo si el modelo falla). Etapas PREGUNTAR → PROPONER → CRITICAR → ACORDAR. Si quien debe preguntar está caído, otra pregunta por ella y el lobby lo anuncia.

## H6 · ROADMAP y ejecución de micro-tareas
Generar el roadmap (JSON de la especificación §3) con un modelo real, validando contra un esquema; el Erizo parte tareas que crecen. Runner con dependencias, reintentos y espera si el dueño está caído. Tabla `tasks`.

## H7 · Buscador con filtro de privacidad (bloqueado por decisión 1 y 2)
Protocolo `{"need":"search",...}` → filtro → motor → resumen ≤800 caracteres → respuesta con fuente. Límites 2 por tarea / 30 por día, caché SQLite, tabla `searches`. **Primero el filtro y su batería de pruebas** (nombres, correos, teléfonos, IPs, identificadores tipo paciente/MRN); nada sale a internet sin pasarlas.

## H8 · Operación
Servicio systemd endurecido (`ProtectSystem`, usuario `council`), respaldo nocturno de la BD al Pi 4, contraseña en MQTT, kiosco (si hay pantalla), versión móvil pulida con teléfono real, Armiño al llegar a nivel 5.
