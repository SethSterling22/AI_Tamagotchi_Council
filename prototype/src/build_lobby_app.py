import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
# reutiliza el atlas de fuente, hojas y meta del builder de borradores
import importlib.util
HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, 'build_lobby_drafts.py'), encoding='utf-8').read()
src = src.split("DRAFTS = [")[0].replace("OUT = '/mnt/user-data/outputs/ai_council/lobby_drafts'", "OUT = '/tmp/_unused'")
ns = {'__file__': os.path.join(HERE, 'build_lobby_drafts.py')}
exec(compile(src, 'drafts_head', 'exec'), ns)
data = ns['data']
lib = open(os.path.join(HERE, 'lobby_lib.js'), encoding='utf-8').read()
A = open(os.path.join(HERE, 'lobby_A.js'), encoding='utf-8').read()
furn = A[A.index('const WALL'):A.index('function room(')]
app = open(os.path.join(HERE, 'lobby_core.js'), encoding='utf-8').read() + open(os.path.join(HERE, 'lobby_view_desktop.js'), encoding='utf-8').read()
OUT = '/mnt/user-data/outputs/ai_council/lobby_v1'
os.makedirs(OUT, exist_ok=True)
PAGE = '''<!doctype html><html lang="es"><head><meta charset="utf-8"><title>AI Council · Lobby v1 (prototipo)</title>
<style>html,body{margin:0;background:#0b0c16;color:#94b0c2;font-family:ui-monospace,Menlo,Consolas,monospace}
.wrap{max-width:1152px;margin:0 auto;padding:12px}h1{font-size:15px;margin:2px 0 8px;color:#ffcd75}
canvas{display:block;width:100%%;image-rendering:pixelated;image-rendering:crisp-edges;background:#000;border:2px solid #333c57}
p{font-size:12px;margin:8px 0 0;line-height:1.5}b{color:#ffcd75}</style></head><body><div class="wrap"><h1>AI Council · Lobby v1 (prototipo)</h1>
<canvas id="c"></canvas>
<p><b>Demo guiada:</b> CONSEJO (responde las preguntas) → ROADMAP (aprueba) → TABLERO (mira trabajar) → entrega. Pestañas con clic o teclas 1–5.
En TABLERO, clic en una habitación rompe el nodo (normal → glitch → error). En MASCOTAS puedes jugar, cuidar y subir ramas. Datos y búsquedas de ejemplo, no reales.</p></div>
<script>%s%s%s%s</script></body></html>'''
html = PAGE % (data, lib, furn, app)
open(os.path.join(OUT, 'lobby_concilio_v1.html'), 'w', encoding='utf-8').write(html)
print('ok', len(html))

# ---------------- version movil (vertical) ----------------
core = open(os.path.join(HERE, 'lobby_core.js'), encoding='utf-8').read()
mob = open(os.path.join(HERE, 'lobby_view_mobile.js'), encoding='utf-8').read()
MPAGE = '''<!doctype html><html lang="es"><head><meta charset="utf-8"><title>AI Council · Lobby móvil</title>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no"><meta name="theme-color" content="#0e0f1a">
<style>html,body{margin:0;height:100%%;background:#0b0c16;overflow:hidden;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
canvas{display:block;margin:0 auto;height:100vh;height:100dvh;max-width:100vw;aspect-ratio:216/384;image-rendering:pixelated;image-rendering:crisp-edges;background:#000}
#ti{position:fixed;left:-2000px;top:0;width:10px;opacity:0;font-size:16px}</style></head><body>
<canvas id="c"></canvas><input id="ti" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="send">
<script>window.LW_=216;window.LH_=384;%s%s%s%s</script></body></html>'''
mhtml = MPAGE % (data, lib, core, mob)
open(os.path.join(OUT, 'lobby_concilio_v1_movil.html'), 'w', encoding='utf-8').write(mhtml)
print('ok movil', len(mhtml))
