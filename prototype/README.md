# Prototipo v1 (datos simulados)

Referencia visual y de comportamiento de **todas** las pantallas. No se conecta a nada.

- `dist/lobby_concilio_v1.html` (escritorio 384×216) y `dist/lobby_concilio_v1_movil.html` (vertical 216×384): autocontenidos, ábrelos en el navegador. `?speed=4` acelera la simulación.
- `dist/lobby_A_hotel.html`, `lobby_B_consejo.html`, `lobby_C_consola.html`: los tres borradores originales.
- `src/`: fuentes JS (`lobby_core.js` lógica compartida, `lobby_view_desktop.js`, `lobby_view_mobile.js`, `lobby_lib.js`). Los scripts `build_*.py` los empaquetan en HTML; tienen rutas absolutas del entorno donde se crearon (`/home/claude/scripts`, `/mnt/user-data/outputs`): ajústalas si los vuelves a ejecutar.
- Para portar una pantalla a la app real: copia su lógica de dibujo a un módulo de `web/js/` (como `board.js`), cambia los datos simulados (`PET`, `ST`, `TASKS`) por los de la API y cubre el comportamiento con pruebas.
