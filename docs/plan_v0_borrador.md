# AI Council — Raspberry Pi Concilio
## Plan v0 (borrador para debatir)

Este documento recoge lo que entendí del proyecto, una propuesta de arquitectura, recomendaciones de modelos según el hardware y una evaluación honesta del cerebro de mosca. Es un punto de partida para discutir, no una decisión cerrada. Las preguntas abiertas están al final.

**Qué está verificado y qué no.** No pude abrir el proyecto de Linear (pide iniciar sesión), así que trabajé con la lista de issues de tu captura (SEB-23 a SEB-33) y con tu descripción. Tampoco pude leer las páginas de benchmarks: el lector de páginas fue rechazado con un 404 del proxy en todos los intentos. Por eso, **las cifras de velocidad y memoria de abajo son estimaciones mías (marcadas "est.")**, no mediciones. La forma correcta de cerrarlas es correr `inventario_nodo.sh` en cada dispositivo (adjunto) y ver los números reales. Lo que sí confirmé por los resultados de búsqueda: existe un fork de Ollama para Termux en Android ARM64, hay guías de Qwen 3.5 en Termux, Qwen3 cubre desde 0.6B hasta 235B, `qwen3-embedding` está en la librería de Ollama, y hay un modelo publicado en Nature (2024) que simula el cerebro completo de la mosca en un portátil.

---

## 1. La idea en una frase

Cuatro mascotas tipo Tamagotchi, cada una con personalidad y trabajo propio en una línea de producción de IA, que aprenden del usuario jugando y deciden en conjunto (un "consejo") qué newsletters, búsquedas o mini-apps ofrecerle. Suben de nivel con el uso. Un nodo central ("lobby") las coordina y muestra el estado de cada una; si una falla, aparece dormida o "glitcheada" con un error descriptivo, rompiendo la cuarta pared a propósito.

## 2. Hardware: qué puede hacer cada dispositivo

| Dispositivo | Qué es (técnicamente) | ¿Ollama? | Rol sugerido |
|---|---|---|---|
| Samsung Galaxy A21s (SM-A217M) | Exynos 850, 8 × Cortex-A55 a 2.0 GHz, 3 GB (2.64 GiB útiles), Android 12 | Sí (fork para Termux) | Mascota o ayudante de inferencia pequeño (≤1.7B) |
| Samsung Galaxy A12 (SM-A125U1) | MediaTek MT6765, 8 × Cortex-A53 a 2.3 GHz, 3 GB (2.67 GiB útiles), Android 12 | Sí (fork para Termux) | Mascota o ayudante de inferencia pequeño (≤0.6B, quizá 1.7B) |
| Raspberry Pi 4 B | Cortex-A72, 4 núcleos, 1/2/4/8 GB según versión | Sí con SO de 64 bits | Lobby + memoria RAG + orquestador (y/o mascota con modelo propio) |
| Raspberry Pi 3 B v1.2 (×2) | Cortex-A53 de 64 bits, 1 GB | Posible con SO de 64 bits, sin margen | Mascota con modelo mínimo (≤0.6B) o solo interfaz que consulta a un cerebro remoto |
| Raspberry Pi 2 B v1.1 | Cortex-A7, **32 bits solamente**, 900 MHz, 1 GB | **No** (Ollama necesita 64 bits) | **Lobby central** (recomendado): broker de mensajes, estado, vigilante de latidos y panel de control |

Hay una decisión de diseño que simplifica todo: **la mascota no tiene por qué ser el lugar donde corre su modelo.** Una mascota es pantalla + personalidad + memoria; la inferencia puede ocurrir en el nodo que tenga capacidad. Así la Pi 2 B participa del consejo sin correr ningún LLM, y las dos Pi 3 no sufren con modelos que no les caben.

**Corrección tras ver tu `fastfetch`.** La primera versión de este plan asumía celulares con 8 GB o más. En realidad son dos equipos de gama baja con 3 GB de RAM y ya tienen cerca de 1.8 GiB ocupados, así que quedan menos de 1 GiB libres para un modelo. No son "cerebros grandes": sirven para modelos de 0.6B a 1.7B. El A21s tiene núcleos Cortex-A55 y el A12 tiene A53; los A55 suelen incluir instrucciones de producto punto que aceleran los modelos cuantizados (se puede comprobar con `grep -m1 Features /proc/cpuinfo | grep -o asimddp`). Los 4 GB de swap del A21s no deben ser plan: un modelo que se pasa a swap se vuelve inusable. También se ve una interfaz `tun0` con IP 100.x, que parece una VPN tipo Tailscale: puede servir para comunicar nodos fuera de casa, pero la red del consejo debería ir por la Wi-Fi o el cable local.

Notas prácticas para los celulares (de memoria, hay que confirmarlas en tu modelo). Los dos usan Android 12, que es justo la versión donde el "phantom process killer" mata procesos hijos de Termux, por lo que hay que desactivarlo para el servidor 24/7: Android mata procesos en segundo plano agresivamente, así que hay que usar `termux-wake-lock`, quitar la optimización de batería para Termux y, en Android 12 o superior, revisar el "phantom process killer". Los teléfonos se calientan y reducen velocidad si trabajan seguido. Si van a estar enchufados 24/7, conviene activar el límite de carga al 80% (en One UI se llama "Proteger batería") para evitar que se hinche la batería.

## 3. Modelos recomendados (todo est. hasta medir)

Reglas generales para este hardware: cuantización Q4, contexto corto (2k–4k tokens, porque el caché de contexto también consume RAM), respuestas cortas (≤60–80 tokens) y modelos distintos por nodo. Esto último es una ventaja para el concepto: un consejo donde cada miembro piensa con un modelo diferente tiene voces genuinamente distintas y evita que las cuatro opinen igual.

| Nodo | Modelo propuesto | Tamaño aprox. Q4 (est.) | Velocidad esperada (est.) |
|---|---|---|---|
| Galaxy A21s (3 GB, ya con ~1.8 GiB en uso) | Qwen3 0.6B cómodo; Qwen3 1.7B al límite | ~0.5 GB / ~1.2 GB | 0.6B: del orden de 5–10 tok/s; 1.7B: 2–4 tok/s y con riesgo de usar swap |
| Galaxy A12 (3 GB, ya con ~1.9 GiB en uso) | Qwen3 0.6B | ~0.5 GB | del orden de 3–6 tok/s (los núcleos A53 son más lentos que los A55) |
| Pi 4 B de 4 GB o más | Qwen3 1.7B (o Gemma/Llama pequeños para variar voz) | ~1.2 GB | del orden de 3–6 tok/s |
| Pi 3 B de 1 GB | Qwen3 0.6B | ~0.5 GB | del orden de 1–3 tok/s |
| Pi 2 B | ninguno; consulta remota | — | — |

Qwen3 tiene modo "thinking" que se puede desactivar; en estos equipos hay que dejarlo apagado salvo para tareas puntuales, o gastará todos los tokens razonando. Los tamaños exactos de la familia Qwen 3.5 y otras alternativas pequeñas (Gemma 3, Llama 3.2 1B/3B, SmolLM, LFM2) las nombro de memoria: antes de decidir hay que confirmar en la librería de Ollama qué existe hoy.

**Embeddings y RAG.** Cada mascota tiene su propia "estantería de memoria", y el RAG se mantiene minúsculo: una tarjeta de personalidad (~300 tokens), hechos del usuario (clave-valor más embeddings), un registro episódico que se resume solo, y recuperación de 2–3 fragmentos por consulta para no desbordar el contexto. Para almacenamiento vectorial, `sqlite-vec` (un solo archivo, sin servidor). Para embeddings, `qwen3-embedding` (0.6B, multilingüe, disponible en Ollama) en los teléfonos y la Pi 4, y un modelo mucho más liviano (tipo MiniLM o bge-small, vía ONNX) en las Pi pequeñas. Como el usuario habla español, hay que probar la calidad de recuperación en español antes de elegir.

**Personalidad.** Con modelos tan pequeños, la personalidad se construye con prompt (tarjeta de rol + ejemplos cortos), con la memoria propia de cada mascota y con su "estado interno" (energía, ánimo), no con fine-tuning. Es más barato, más depurable y más divertido, porque el estado emocional modula el prompt.

## 4. Cerebro de mosca: ¿sí o no?

**Lo que existe.** El conectoma completo de la mosca de la fruta (FlyWire, del orden de 139 000 neuronas y decenas de millones de sinapsis) ya se usó en un modelo computacional publicado en Nature en 2024 que lo simula en un portátil. Hay repositorios abiertos con distintas implementaciones (Brian2, NEST, PyTorch, hasta chips neuromórficos) y hasta un proyecto de demostración con "aprendizaje por dopamina".

**Lo que no es.** Ese modelo no habla, no razona y no está entrenado para tareas; propaga actividad por la red real y permite predecir qué neuronas se activan ante ciertos estímulos. No sirve como "cerebro" del LLM. Tampoco tengo medido cuánto corre en ARM: mi estimación es que la matriz dispersa ocupa cientos de MB, lo que descarta las Pi de 1 GB y deja justa a la Pi 4, y que en Python sería mucho más lento que tiempo real. Hay que probarlo primero en un PC.

**Propuesta en tres niveles de ambición**

1. **Inspiración (ahora, barato, útil de verdad).** Un módulo de aprendizaje inspirado en el cuerpo fungiforme de la mosca, el centro de memoria asociativa del insecto: codificación dispersa de miles de "células de Kenyon" más un refuerzo tipo dopamina. Son unos pocos miles de unidades, corren hasta en la Pi 2 B y encajan perfecto con los juegos que aprenden gustos: el usuario acepta o rechaza, el módulo refuerza o debilita asociaciones. Es una forma honesta y liviana de "usar el cerebro de la mosca".
2. **Módulo límbico en el lobby (investigación, más adelante).** Un subcircuito del conectoma, o el modelo completo precalculado en un PC, que genere ritmos de sueño, arousal y comportamientos espontáneos de las mascotas. El LLM sigue siendo el motor de lenguaje; la mosca solo modula el humor.
3. **Cerebro completo en cada nodo.** No lo recomiendo: no cabe en las Pi de 1 GB y no aporta nada al lenguaje.

Como toque de cuarta pared: una pantalla en el lobby donde "el cerebro de la mosca sueña" mientras todas duermen, con actividad real del modelo visualizada.

## 5. Arquitectura propuesta

**Lobby.** Un nodo central con un broker de mensajes liviano (MQTT con Mosquitto, o HTTP más eventos) y una base SQLite. Guarda el estado de cada mascota, una "pizarra" compartida donde se acumula el debate y la cola de trabajos. Con el hardware confirmado, el candidato natural es la **Pi 2 B v1.1**: no puede correr un LLM de todos modos y el lobby solo mueve mensajes, así que libera a todos los nodos con capacidad de inferencia. Conviene conectarla por cable y usar log2ram o una tarjeta SD de buena calidad para cuidar la memoria. Las alternativas son la Pi 4 (desperdicia el mejor nodo de cómputo) o un teléfono (Android puede matar procesos en segundo plano). Es una decisión para debatir.

**Estados y fallos.** Cada nodo envía un latido cada pocos segundos. Si el latido falta o el nodo informa un error, el lobby cambia el estado de la mascota: despierta, pensando, durmiendo (inactiva por diseño) o **glitcheada** (falló). En el estado glitch la pantalla muestra el sprite deformado más un error descriptivo real: qué proceso, qué modelo, cuánta RAM libre, última excepción. Se trata de una función de depuración disfrazada de personaje. Esto requiere dos animaciones nuevas que puedo dibujar con el mismo rig: **glitch** y **offline/durmiendo profundo**.

**Motor de debate semi-espontáneo.** Cada mascota tiene un "impulso" (curiosidad, aburrimiento, energía) que sube con el tiempo. Cuando supera un umbral y la palabra está libre en la pizarra, puede intervenir, con un tope de tokens por hora para no saturar el hardware. En una decisión formal el ciclo es: propone, critica, vota, y una de ellas sintetiza. Los mensajes son cortos (≤60 tokens) y la pizarra se resume periódicamente.

**Roles (propuesta para SEB-24).** Los seis animales que diseñamos sugieren esto, para empezar con cuatro y desbloquear los otros dos como progresión:

| Animal | Rol propuesto | Qué hace en la línea de producción |
|---|---|---|
| Búho | Investigador | Busca, filtra y cura contenido; arma newsletters |
| Ocelote | Constructor | Convierte ideas en mini-apps y prototipos |
| Erizo | Crítico/Guardián | Cuestiona, verifica, cuida privacidad y calidad ("las púas") |
| Panda rojo | Anfitrión | Juega con el usuario, hace las preguntas y aprende sus gustos |
| Kakapo (desbloqueable) | Archivista | Cura la memoria y el RAG compartido |
| Armiño (desbloqueable) | Editor/Sintetizador | Resume y pule las salidas finales |

**Progresión tipo juego.** Cada interacción da experiencia y mueve estadísticas (confianza, curiosidad, energía). El nivel desbloquea capacidades: conversar; proponer temas para newsletters; generar mini-apps con plantillas; participar en votaciones del consejo. Los juegos para conocer al usuario pueden ser: elegir entre dos opciones, escoger entre tres titulares, chequeos de ánimo, trivia y un formulario corto de personalidad. Además, un conjunto inicial de temas de IA que el usuario marca como "me interesa / no me interesa" alimenta el módulo de preferencias. Los datos del usuario son sensibles: todo debe quedarse en la red local y con los archivos cifrados en reposo.

## 6. Sistemas operativos y despliegue

Todo el consejo corre dentro de una red Tailscale. Los nodos se llaman por nombre (MagicDNS) y el lobby se publica solo dentro de esa red privada. Nombres sugeridos: `lobby`, `buho`, `ocelote`, `erizo`, `panda` y los dos celulares.

| Nodo | Sistema operativo | Qué corre | Notas |
|---|---|---|---|
| Pi 2 B v1.1 (lobby) | Raspberry Pi OS Lite **32 bits** (es la única opción: ARMv7) más `cage` y Chromium en modo kiosco | Mosquitto, servicio web del lobby, SQLite y el navegador a pantalla completa apuntando a `localhost` | No tiene Wi-Fi: usar cable. La página debe ser liviana (HTML y JS simple, eventos del servidor, sprites en canvas), sin frameworks pesados |
| Pi 4 B | Raspberry Pi OS Lite **64 bits** | Ollama o llama.cpp, embeddings, base de recuerdos y una mascota | Disipador, fuente oficial de 3 A y, si es posible, SSD por USB para el sistema y la base de datos |
| Pi 3 B (×2) | Raspberry Pi OS Lite **64 bits** | llama.cpp (servidor) con Qwen3 0.6B, o cerebro remoto, y una mascota | Solo 1 GB: usar zram, sin swap en la SD y sin escritorio. Sistema de archivos de solo lectura (overlay) porque se van a desenchufar a lo bruto |
| 2 celulares | Android 12 con Termux y la app de Tailscale | Ollama (0.6B a 1.7B) | Quitar la optimización de batería, usar wake lock y enlazar Ollama solo a la IP de Tailscale, no a toda la red |

**Por qué Raspberry Pi OS Lite en todas.** Es el sistema mejor documentado para estas placas, el Raspberry Pi Imager permite preconfigurar nombre, usuario, clave SSH y Wi-Fi antes de arrancar, y tener una sola familia reduce el mantenimiento. DietPi usa menos RAM, pero en su repositorio hay varios reportes de fallos con Chromium en modo kiosco, justo lo que necesita el lobby. Un escritorio completo desperdicia memoria que aquí es oro.

**Lobby con navegador.** El esquema es: el servicio web del lobby corre en la misma Pi 2, y Chromium en kiosco muestra `http://localhost` en la pantalla conectada. El resto de dispositivos lo ve por el navegador con la dirección Tailscale. Chromium en una Pi 2 será lento, pero para una página sencilla debería servir; si se queda corto, la salida es aligerar la página, no cambiar de placa. Chromium consume del orden de 300 a 500 MB (est.), por eso solo se usa en el lobby, que no corre ningún modelo.

**Pantalla de las mascotas.** Depende de qué pantalla lleve cada una (aún no la sé). Pintar sprites directamente con pygame sin escritorio en las versiones recientes de Raspberry Pi OS tiene reportes de problemas al inicializar la pantalla. Propongo que SEB-29 empiece con una prueba rápida en cada Pi, comparando Chromium en kiosco, pygame bajo `cage` y KMS directo, y elegir lo más liviano que funcione. En las Pi 3, que tienen 1 GB y también corren un modelo, el navegador no cabe.

**Preparación de cada nodo.** Grabar la SD con el Raspberry Pi Imager (en el Imager, al elegir el modelo de placa solo aparecen los sistemas compatibles: es la forma de confirmar qué versión admite la Pi 2), instalar Tailscale, desactivar la expiración de clave de cada nodo en el panel de Tailscale, etiquetar los nodos y limitar con ACL quién habla con quién. La base de datos del lobby debería respaldarse de noche en la Pi 4 por Tailscale, porque la tarjeta SD de la Pi 2 es el punto más frágil.

## 7. Orden de trabajo sugerido sobre los issues de Linear

Pensando en trabajo asincrónico, este orden respeta las dependencias:

1. **SEB-25** Inventario de hardware: correr `inventario_nodo.sh` en los seis dispositivos y pegar los resultados.
2. **SEB-26** Selección de modelos: con los números reales, fijar un modelo por nodo.
3. **SEB-24** Roles y personalidades: cerrar los cuatro roles y la forma de desbloquear los otros dos.
4. **SEB-27** Protocolo de comunicación: esquema de mensajes, estados, latidos y errores.
5. **SEB-31** Red local entre las cuatro Pi (y los teléfonos).
6. **SEB-32** Prompts por rol y memoria corta.
7. **SEB-28** Motor de debate semi-espontáneo.
8. **SEB-29** Interfaz tipo Tamagotchi (ya están los sprites y la demo).
9. **SEB-30** Estado emocional y de salud, incluido glitch/sleep.
10. **SEB-33** Sesión de prueba de punta a punta.

Lo que puedo avanzar sin hardware: esquemas de protocolo, borradores de prompts por rol, los sprites de glitch y durmiendo profundo, una maqueta de la pantalla del lobby y el prototipo del módulo de aprendizaje inspirado en la mosca para probarlo en un PC. Lo que requiere tus dispositivos: medir velocidades reales, probar Ollama en Termux y confirmar cuál Pi queda con qué sistema operativo.

## 8. Preguntas abiertas

1. (Resuelta) Los Samsung son un Galaxy A21s y un Galaxy A12, ambos de 3 GB.
2. ¿La Pi 4 B es de 2, 4 u 8 GB? ¿Y qué sistema operativo (y de cuántos bits) tiene cada Pi hoy?
3. ¿Cada mascota tendrá pantalla propia? ¿Qué tipo (LCD pequeño, HDMI, e-ink)? Afecta al tamaño y a la animación.
4. ¿Confirmas la Pi 2 B como lobby? Con eso, las cuatro mascotas quedarían en la Pi 4, las dos Pi 3 y un teléfono, y el otro teléfono sería ayudante o quinta mascota desbloqueable.
5. ¿Los cuatro roles son los de la tabla (Búho, Ocelote, Erizo, Panda rojo) o prefieres otro reparto?
6. ¿El usuario final eres tú o un público general? Cambia mucho lo que hay que cuidar en privacidad.
7. ¿Qué nivel del cerebro de mosca te interesa explorar primero (el 1, el 2, o solo como pantalla decorativa)?

---

## Fuentes (solo títulos y enlaces de búsqueda; no pude abrir las páginas)

- [ollama-termux (fork de Ollama para Termux)](https://github.com/DioNanos/ollama-termux)
- [Run Qwen 3.5 Offline on Android using Termux](https://sagartamang.com/blog/qwen-3.5-on-android)
- [Biblioteca de Ollama: qwen3](https://ollama.com/library/qwen3), [qwen3.5](https://ollama.com/library/qwen3.5) y [qwen3-embedding](https://ollama.com/library/qwen3-embedding)
- [Ollama en Raspberry Pi con userland de 32 bits (issue #4577)](https://github.com/ollama/ollama/issues/4577)
- [A Drosophila computational brain model reveals sensorimotor processing (Nature)](https://www.nature.com/articles/s41586-024-07763-9)
- [Researchers simulate an entire fly brain on a laptop (Berkeley News)](https://news.berkeley.edu/2024/10/02/researchers-simulate-an-entire-fly-brain-on-a-laptop-is-a-human-brain-next/)
- [Drosophila_brain_model (modelo LIF)](https://github.com/philshiu/Drosophila_brain_model) y [fly-brain de Eon Systems](https://github.com/eonsystemspbc/fly-brain)
