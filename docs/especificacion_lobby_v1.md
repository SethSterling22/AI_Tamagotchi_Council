# AI Council · Especificación del lobby v1

Borrador de trabajo para SEB-27 (protocolo del lobby), SEB-29 (pantalla de las mascotas) y SEB-28/30 (flujo de planificación). Lo que está marcado como *(est.)* es una estimación mía, no una medición. El prototipo que acompaña este documento (`lobby_concilio_v1.html`) usa datos de ejemplo.

## 1. Las cinco pantallas

El lobby es un servicio web que corre en la Pi 2 B y se muestra en el navegador kiosco. Combina los tres borradores anteriores con dos pantallas nuevas.

| Pestaña | Viene de | Para qué sirve |
|---|---|---|
| TABLERO | Borrador A (hotel) | Resumen de una mirada: qué hace cada mascota, su tarea actual con barra de avance, los fallos con su error descriptivo y el registro de eventos del lobby. |
| CONSEJO | Borrador B (tribunal) | La planificación. Las mascotas hacen preguntas directas al usuario, con tres opciones más una respuesta libre, y luego proponen, critican y acuerdan. |
| ROADMAP | Nueva | El plan resultante, repartido en tareas pequeñas por mascota y por etapa (reunir, construir, revisar, entregar), con dependencias y avance en vivo. |
| MASCOTAS | Borrador C (consola) | Cuidado individual: energía, ánimo, XP, minijuegos para que la mascota conozca al usuario y árbol de ramas para subir atributos. |
| BUSCAR | Nueva | Transparencia del buscador: historial, cuota diaria y reglas de privacidad. |

## 2. Fases de un proyecto

El estado vive en el lobby y todas las pantallas lo leen. Hay cuatro fases: **plan** (el Consejo pregunta), **review** (el usuario revisa el roadmap y lo aprueba), **work** (las mascotas ejecutan las tareas) y **done** (entrega y celebración). Desde `done` se puede abrir un proyecto nuevo.

En CONSEJO, la etapa PREGUNTAR hace una pregunta por mascota (la que mejor entiende el tema), luego el lobby narra PROPONER, el Erizo hace CRITICAR y se cierra con ACORDAR. Dos reglas de resiliencia: si una pregunta ya se respondió en un minijuego, se salta, y si la mascota que debe preguntar está caída, otra la formula por ella y el lobby lo anuncia.

## 2b. Ciclo día/noche (encomiendas nocturnas)

Las interacciones con el Consejo son **encomiendas programadas**, a largo plazo: no se espera una respuesta instantánea. Las mascotas (todas de especies nocturnas) **trabajan mientras el usuario duerme** y, de día, descansan y planifican con él. El ciclo sigue el horario del usuario (hora de despertar y de dormir en su zona horaria IANA), no el sol, así que quien duerme de día tiene la «noche» del Consejo a mediodía.

| Fase | Intervalo | Qué pasa |
|---|---|---|
| ATARDECER | 30 min antes de dormir | despiertan; se cierran las encomiendas de la noche |
| NOCHE | de dormir a despertar | turno de trabajo: el ejecutor de tareas (H6) solo corre aquí |
| AMANECER | 30 min tras despertar | entregas de la noche |
| DÍA | el resto | descansan (sprite `sleep`, se las puede despertar con SALUDAR) y planifican con el usuario (CONSEJO/ROADMAP, H5) |

Reglas: despierto y dormido deben durar al menos 2 h cada uno; las cuentas se hacen en tiempo absoluto (una noche con cambio de hora dura lo que dura de verdad); un nodo caído o con error muestra su estado por encima de la fase. Cada cambio de fase se anota en el registro del lobby. API: `GET/PUT /api/cycle`; la instantánea de `/api/pets` y del SSE incluye `cycle`. La lentitud de los modelos (3 tok/s en la Pi 4) es parte del juego: se encarga de día y se recoge por la mañana.

## 3. Roadmap: micro-tareas para modelos pequeños

Cada tarea debe caber en un modelo de 0.6B–4B con contexto de 2k. Las reglas son: un solo objetivo por tarea, salida de hasta unos 400 tokens, entradas explícitas (nada de "mira todo el historial") y un criterio de listo de una línea que el Erizo pueda comprobar. Si una tarea crece, el Erizo la parte en dos antes de que empiece.

El reparto sigue la especialidad. El Panda (anfitrión) lleva lo que habla con el usuario: tests, saludos y textos. El Búho (investigador) reúne y resume fuentes. El Ocelote (constructor) arma plantillas y mini-apps. El Erizo (crítico) revisa enlaces, tono y la entrega final. Kakapo y Armiño no tienen tareas hasta desbloquearse.

```json
{
  "id": "T5",
  "owner": "ocelote",
  "title": "Mini-app oscura",
  "stage": "CONSTRUIR",
  "inputs": ["T3.resumen", "T4.plantilla", "brief.theme"],
  "max_output_tokens": 400,
  "max_context": 2048,
  "done_when": "una sola pantalla HTML con tema oscuro que abre sin errores",
  "depends_on": ["T3", "T4"],
  "search_budget": 2,
  "status": "pending"
}
```

Si el dueño de una tarea está caído, la tarea se queda en espera y el lobby lo muestra; reasignarla a otra mascota es una decisión para el Consejo, no automática. En el prototipo la tarea simplemente espera.

## 4. Buscador para modelos con poco contexto

**Idea.** Un modelo pequeño no debería inventar lo que no sabe. Cuando detecta que le falta un dato, lo declara y el lobby busca por él.

**Flujo.** La mascota responde con una señal estructurada en lugar de texto libre, por ejemplo `{"need":"search","query":"...","why":"..."}`. El lobby la recibe, pasa la consulta por el **filtro de privacidad**, la envía al buscador, acorta los resultados a unos 800 caracteres y se los devuelve a la mascota junto con las fuentes. La mascota responde citando la fuente. En la interfaz esto se ve como la mascota pensando con una lupa, la ventana de búsqueda y el chip "fuente: dominio".

**Filtro de privacidad (obligatorio).** Antes de salir a internet, el lobby elimina nombres propios del usuario, correos, teléfonos, direcciones IP y cualquier cosa que parezca un identificador de paciente. Como las consultas salen de la red local, **no se debe cargar información de pacientes ni datos clínicos en el Consejo**: el filtro es una red de seguridad, no una garantía. Mi recomendación es probar el filtro con una lista de casos antes de activar el buscador.

**Límites.** Máximo 2 búsquedas por tarea y 30 por día (ajustables con la rama INVESTIGAR del Búho), con caché en SQLite para no repetir consultas.

**Motor.** Mi propuesta es un buscador propio tipo SearXNG en la Pi 4, porque es gratuito y no depende de una cuenta externa. No lo pude comprobar desde este entorno (sin acceso a sus páginas), así que antes de decidir conviene verificar sus requisitos y si su API JSON sirve para esto. La alternativa es una API de pago (Brave, Tavily u otra), más simple de instalar pero con costo y con una cuenta externa. Esta decisión queda abierta.

## 5. Ramas, puntos y minijuegos

Cada mascota tiene tres ramas con cinco niveles. Los puntos vienen de subir de nivel y de terminar minijuegos. En el prototipo los minijuegos son rondas de "esto o aquello" que alimentan el brief del usuario, y las ramas son decorativas. En la versión real cada rama debe cambiar un parámetro medible, para que subir de nivel signifique algo:

| Rama | Parámetro que cambia (propuesta) |
|---|---|
| Búho · INVESTIGAR | búsquedas permitidas por tarea |
| Búho · RESUMIR / CITAR | longitud y fidelidad del resumen, cita obligatoria |
| Ocelote · CÓDIGO | tope de tokens de salida por tarea |
| Ocelote · DEPURAR | número de reintentos antes de pedir ayuda |
| Erizo · CRÍTICA / SEGURIDAD | tamaño de la lista de control de revisión |
| Panda · EMPATÍA / JUEGOS | cantidad y variedad de preguntas por sesión |
| Kakapo · MEMORIA | recuerdos guardados por semana |

Un nodo caído no se puede entrenar: el panel de ramas se bloquea y muestra el error.

## 6. Datos mínimos (SQLite en el lobby)

Seis tablas bastan: `nodes` (estado, último latido, error), `brief` (respuestas y lo aprendido en juegos), `tasks` (el JSON de arriba más progreso), `events` (el registro que ve el tablero), `searches` (consulta filtrada, fuente, caché) y `branches` (puntos y niveles por mascota). Los nodos informan por latido y el lobby los marca como dormidos o con glitch cuando dejan de responder; el mensaje de error se guarda tal cual para mostrarlo.

## 7. Qué es prototipo y qué falta

El prototipo simula los modelos, las búsquedas y el avance de las tareas con temporizadores. Falta conectar el protocolo de latidos y eventos (SEB-27), generar el roadmap con un modelo real en lugar de una plantilla fija, implementar el filtro de privacidad y el buscador, y hacer que las ramas modifiquen parámetros reales.

## 8. Preguntas abiertas

1. ¿Buscador propio en la Pi 4 o una API externa de pago?
2. ¿Las búsquedas se hacen en español, en inglés o en ambos? Los modelos pequeños suelen responder mejor en inglés *(est.)*.
3. ¿Qué mascota reasigna una tarea cuando su dueño cae?
4. ¿Cuántos puntos de rama por nivel y por minijuego?
