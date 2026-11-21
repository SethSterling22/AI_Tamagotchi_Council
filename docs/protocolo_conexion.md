# Ciclo de conexión (lobby ⇄ nodos)

Implementado en `server/council/probe.py`, `monitor.py` y `app.py`. Probado contra un Ollama falso (`server/tools/fake_ollama.py`); **no probado contra Ollama real ni en hardware**.

## 1. Vida de una mascota

```
ALTA (panel)            GUARDAR                 CICLO (monitor, hilo propio)
 elegir personaje  →    POST /api/pets   →      pending ──sondeo──► online ◄──┐
 nombre                 (valida todo)             │                    │ fallo │ éxito
 host + puerto + modelo                           │                    ▼       │
 PROBAR (POST /api/probe, opcional)               └────────────►  glitch / error
 personalidad + stats                                   (2 fallos seguidos si estaba online)
```

El alta **no exige** que la prueba salga bien: el nodo puede estar aún instalándose. La mascota aparece en el tablero con su error descriptivo hasta que conteste.

## 2. Estados y su sprite

| Estado | Significa | Sprite | Códigos |
|---|---|---|---|
| `pending` | aún no se ha sondeado | `sleep` | – |
| `online` | responde y el modelo existe | `idle` (`think` mientras genera) | – |
| `glitch` | **sin señal**: no hay conversación posible | `glitch` | `ENOTFOUND`, `ECONNREFUSED`, `ETIMEDOUT`, `ENETUNREACH`, `ECONN` |
| `error` | el nodo contesta pero algo falla | `error` | `MODEL_MISSING`, `OOM`, `HTTP_5xx`, `BAD_RESPONSE`, `EMPTY` |

El mensaje de `error.message` se guarda tal cual en SQLite (`pets.last_error`) y el tablero lo enseña: es la "rotura de la cuarta pared" del diseño original.

## 3. Sondeo (`probe.probe`)

`GET /api/version` y `GET /api/tags` con timeout de 3 s. No carga el modelo (no gasta RAM). Devuelve latencia, versión, lista de modelos y si el modelo pedido está. Para `kakapo` el modelo es de embeddings.

## 4. Histéresis y reintentos (`Monitor`)

- Un nodo `online` tolera **1 fallo suelto**; al 2.º seguido pasa a `glitch`/`error` (`fails_to_drop=2`).
- Un nodo nuevo, o recién editado (host/puerto/modelo), no tiene histéresis: cae al primer fallo.
- Intervalos: 15 s si está en línea; 5 s si falla, con espera exponencial hasta 60 s (`COUNCIL_INTERVAL_OK`, `COUNCIL_INTERVAL_BAD`).
- Un solo sondeo por nodo a la vez; un fallo inesperado se registra como evento `monitor_error` y no detiene el ciclo.
- Cada cambio de estado escribe un evento (`inicio → online`, `online → glitch · ECONNREFUSED`…), que el tablero muestra en el registro.

## 5. Primer contacto (`POST /api/pets/<id>/hello`)

Una generación mínima (`num_predict 64`, `num_ctx 2048`, `think:false`) con el *prompt de sistema* construido a partir de rasgos + voz (`persona.py`). Comprueba el ciclo completo (carga del modelo incluida) y devuelve texto, ms y tok/s. Kakapo usa `/api/embed` y devuelve las dimensiones. El primer saludo puede tardar mucho en una Pi 3 o un celular (carga del modelo); el timeout por defecto es 90 s (`COUNCIL_HELLO_TIMEOUT`).

## 6. Tiempo real

`GET /api/stream` (SSE) emite el snapshot completo cada vez que `monitor.version` cambia, con *keepalive* cada 15 s. El front cae a sondeo cada 5 s si SSE falla. Con ≤10 mascotas el snapshot es pequeño; si crece, enviar solo diferencias.

## 7. Seguridad

- El sondeo hace peticiones **desde el lobby** al host que escribe el usuario → riesgo SSRF. `validate_target` solo admite IPs de red local, loopback y Tailscale (100.64.0.0/10), nombres cortos (MagicDNS), `.ts.net`, `.local` y `.lan`. Bloquea enlace local (`169.254.x.x`, p. ej. metadatos de nube), multicast y `0.0.0.0`. `COUNCIL_ALLOW_PUBLIC=1` lo relaja (no recomendado).
- No hay autenticación: se asume acceso solo por Tailscale + `ufw` (ver `deploy/setup_pi.sh`). Si el lobby sale de la tailnet, añadir login antes.
- Los textos se pintan con `textContent` / canvas; nunca con `innerHTML`.

## 8. Pendiente / siguiente

- Latido iniciado por el nodo (MQTT) además del sondeo, para saber qué está *haciendo* (SEB-27). Hoy el lobby solo sabe "contesta / no contesta".
- ~~Verificar con Ollama real los campos usados.~~ Hecho el 21-nov-2026 con Ollama 0.40.16 (Pi 4) y 0.31.1 (Termux): `/api/version`, `/api/tags` y `/api/chat` con `think:false` coinciden. Falta una respuesta correcta de `/api/embed` (ningún nodo tiene aún el modelo de embeddings). Al generar sin el modelo, Ollama responde HTTP 404 `model '…' not found` → se clasifica como `MODEL_MISSING` (detalle en `docs/estado.md` §3).
- Ollama expulsa el modelo de RAM tras `OLLAMA_KEEP_ALIVE`; un sondeo ligero no lo recarga, así que "en línea" no garantiza "modelo cargado".
