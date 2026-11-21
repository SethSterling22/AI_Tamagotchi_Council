# AI Council · Instalación por nodo

Orden recomendado: primero Tailscale en tu cuenta, luego el lobby, luego las mascotas con Pi y, al final, los celulares. Los comandos de esta guía y de los scripts los escribí de memoria sobre los métodos de instalación oficiales de Tailscale, Ollama y Termux. No pude abrir sus páginas desde mi entorno para contrastarlos, así que si un paso falla, la salida del error dirá qué ajustar. Los scripts pasaron `bash -n` y `shellcheck`, pero **no se probaron en hardware real**.

## 0. Antes de empezar (una sola vez)

En la consola de Tailscale (login.tailscale.com):

1. **Settings → Keys → Generate auth key.** Márcala como *reusable* y copia el valor `tskey-auth-...`. No la pegues en chats ni la guardes en archivos del repositorio; se pasa como variable de entorno al ejecutar el script.
2. **Caducidad de claves.** Un nodo con la clave caducada se desconecta solo. Después de unir cada equipo, entra a *Machines → ··· → Disable key expiry*. (Los equipos con etiqueta no caducan, pero usar etiquetas exige definir `tagOwners` en tus ACL, así que para empezar es más simple desactivar la caducidad a mano.)
3. **MagicDNS** activado (suele estarlo por defecto). Con él, los nodos se llaman entre sí por `lobby`, `ocelote`, `erizo`, `panda`, `buho` y `kakapo`.

Copia la carpeta `setup` y el archivo `inventario_nodo.sh` a cada Pi (por ejemplo con `scp` desde tu computador, o con una memoria USB).

## 1. Lobby (Pi 2 B, Raspberry Pi OS Lite 32-bit, con cable de red: esta placa no tiene Wi-Fi)

```bash
sudo TS_AUTHKEY=tskey-auth-XXXX bash setup_pi.sh lobby
```

Instala Tailscale, el firewall, Mosquitto (MQTT), un entorno de Python con Flask y el servicio `council-lobby` (puerto 8080). Si el lobby tiene pantalla, agrega `KIOSK=1` para instalar el navegador en modo kiosco (cage + Chromium); en una Pi 2 B con 1 GB puede ir justo, pruébalo antes de dejarlo fijo.

Después despliega la app **desde tu computador** (carpeta raíz del repositorio):

```bash
./deploy/deploy_lobby.sh USUARIO@lobby
```

Y ábrela desde cualquier equipo de tu red de Tailscale: `http://lobby:8080/`. Allí das de alta cada mascota con su host (IP de Tailscale o nombre, p. ej. `ocelote`) y puerto (11434).

## 2. Ocelote (Pi 4 B) y las dos Pi 3 B (Erizo y Panda), todas con Raspberry Pi OS Lite 64-bit

```bash
# Pi 4 B
sudo TS_AUTHKEY=tskey-auth-XXXX bash setup_pi.sh ocelote
# Pi 3 B (una en cada tarjeta)
sudo TS_AUTHKEY=tskey-auth-XXXX bash setup_pi.sh erizo
sudo TS_AUTHKEY=tskey-auth-XXXX bash setup_pi.sh panda
```

Cada script actualiza el sistema, une el equipo a Tailscale, cierra el firewall salvo SSH y Tailscale, instala Ollama con un contexto de 2k y descarga un modelo según el rol. Por defecto, Ocelote usa `qwen3:4b` si la Pi tiene 8 GB y `qwen3:1.7b` en cualquier otro caso; Erizo y Panda usan `qwen3:0.6b`. Puedes forzar otro con `MODEL=qwen3:1.7b`, y añadir `EMBED=1` donde quieras el modelo de embeddings para la memoria personal (Panda es el candidato natural).

Nota: el Pi 4 todavía no sé cuánta RAM tiene; el script la lee solo y elige en consecuencia.

## 3. Celulares (Termux): Búho en el Galaxy A21s y Kakapo en el Galaxy A12

Antes, con la app de Tailscale ya iniciada en el celular, anota la IP que muestra (empieza con `100.`). Luego, dentro de Termux:

```bash
bash setup_termux.sh buho 100.X.Y.Z      # en el A21s
bash setup_termux.sh kakapo 100.X.Y.Z    # en el A12
```

Ollama queda enlazado solo a esa IP, no a la red Wi-Fi. El script también crea un arranque automático para Termux:Boot (instálalo desde F-Droid y ábrelo una vez).

**Para que Android no mate el proceso** (Android 12 es agresivo con los procesos en segundo plano):

1. Ajustes → Aplicaciones → Termux → Batería → **Sin restricciones**. Haz lo mismo con Tailscale.
2. En Termux, `termux-wake-lock` (ya lo hace el script de arranque).
3. Desde un computador con `adb` y el celular conectado (depuración USB activada), desactiva el monitor de procesos fantasma:

```bash
adb shell "settings put global settings_enable_monitor_phantom_procs false"
adb shell "device_config put activity_manager max_phantom_processes 2147483647"
```

4. Si el celular queda enchufado todo el tiempo, limita la carga al 80 % desde los ajustes de batería, si el modelo lo permite.

## 4. Verificar que todo habla con todo

Desde cualquier nodo con Tailscale:

```bash
tailscale status                                # deben aparecer los 6 nombres
curl -s http://ocelote:11434/api/version       # y lo mismo con erizo, panda, buho, kakapo
curl -s http://buho:11434/api/tags | jq '.models[].name'
```

Mide la velocidad real de cada nodo con el script de inventario (dentro de cada equipo; usa el mismo nombre de modelo que descargaste):

```bash
sh inventario_nodo.sh qwen3:0.6b
```

Envíame la salida de los seis y reviso si los modelos asignados son realistas.

## 5. Lo que no hace todavía (y por qué)

- **Buscador:** no se instala nada aún porque falta decidir entre un buscador propio o una API externa (ver la especificación). Cuando se decida, se agrega al Pi 4 o al lobby.
- **Sistema de solo lectura (overlay):** no lo actives hasta decidir dónde viven los modelos de Ollama y la base de datos del lobby; con el overlay activo, lo que se escribe en el sistema se pierde al reiniciar.
- **Respaldo nocturno de la base del lobby al Pi 4:** pendiente; necesita llaves SSH entre ambos nodos.
- **Contraseña en MQTT:** el lobby acepta conexiones anónimas protegido solo por el firewall. Si más adelante abres la red a más dispositivos, conviene añadir usuario y contraseña.

## 6. Si algo falla

| Síntoma | Qué mirar |
|---|---|
| `tailscale up` no termina | Abre el enlace que imprime en otro dispositivo, o usa `TS_AUTHKEY`. |
| Ollama no responde | `journalctl -u ollama -n 50` (Pi) o `tmux attach -t council` (Termux). |
| El modelo no carga o el equipo se congela | Es probable que falte RAM: prueba un modelo más pequeño con `MODEL=...`. |
| Un nodo aparece y desaparece | Batería y procesos fantasma en el celular; cable de red y alimentación suficiente en la Pi (una fuente débil provoca reinicios; `vcgencmd get_throttled` lo delata). |
| `pkg install ollama` no encuentra el paquete | Ya tenías Ollama funcionando en los celulares, así que usa el mismo método con el que lo instalaste y vuelve a ejecutar el script. |
