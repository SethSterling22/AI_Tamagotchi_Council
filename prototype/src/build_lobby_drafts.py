import os, sys, json, base64, io
sys.path.insert(0, os.path.dirname(__file__))
from PIL import Image, ImageDraw, ImageFont
import mascotas_v2 as M

OUT = '/mnt/user-data/outputs/ai_council/lobby_drafts'
os.makedirs(OUT, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))

# ---- atlas de fuente pixel (DejaVu Sans Mono a 10 px, 1 bit)
MAP = ''.join(chr(c) for c in range(32, 127)) + '¡¿ÁÉÍÓÚÑÜáéíóúñü…·▶◀●■♥★✓✗▲▼█░▒°×—≤≥→←↑↓›«»'
def atlas(path):
    f = ImageFont.truetype(path, 10)
    im = Image.new('RGBA', (6 * len(MAP), 13), (0, 0, 0, 0))
    for i, ch in enumerate(MAP):
        cell = Image.new('L', (6, 13), 0)
        d = ImageDraw.Draw(cell); d.fontmode = '1'
        d.text((0, 1), ch, font=f, fill=255)
        px = cell.point(lambda v: 255 if v > 127 else 0)
        white = Image.new('RGBA', (6, 13), (255, 255, 255, 255))
        im.paste(white, (i * 6, 0), px)
    b = io.BytesIO(); im.save(b, 'PNG'); return base64.b64encode(b.getvalue()).decode()
FR = atlas('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf')
FB = atlas('/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf')

# ---- hojas de sprites (6 col x 9 filas) y meta
COLS, ROWS = 6, len(M.ORDER)
sheets = {}
for key in M.SPECIES:
    fr = M.all_frames(key)
    sh = Image.new('RGBA', (COLS * 32, ROWS * 32), (0, 0, 0, 0))
    for ri, a in enumerate(M.ORDER):
        for ci, im in enumerate(fr[a]):
            sh.alpha_composite(im, (ci * 32, ri * 32))
    b = io.BytesIO(); sh.save(b, 'PNG'); sheets[key] = base64.b64encode(b.getvalue()).decode()
meta = {'actions': {a: {'row': i, 'frames': len(M.ANIMS[a]['frames']), 'fps': M.ANIMS[a]['fps']} for i, a in enumerate(M.ORDER)}}

lib = open(os.path.join(HERE, 'lobby_lib.js'), encoding='utf-8').read()
data = ('const FONT_R_B64="%s";const FONT_B_B64="%s";const MAP=%s;const SHEETS=%s;const META=%s;\n'
        % (FR, FB, json.dumps(MAP), json.dumps(sheets), json.dumps(meta)))

DRAFTS = [
    ('A', 'lobby_A_hotel.html', 'Borrador A · El Hotel',
     'Una habitación por nodo y la recepción (Pi 2 B) abajo. Clic en una habitación: normal → glitch → error.'),
    ('B', 'lobby_B_consejo.html', 'Borrador B · La Mesa del Consejo',
     'Debate por turnos: proponer, criticar, votar, sintetizar. Clic: avanzar al siguiente turno.'),
    ('C', 'lobby_C_consola.html', 'Borrador C · Consola de nodos',
     'Menú tipo JRPG con ficha por nodo. Flechas ↑↓ o clic en la lista; clic en el panel derecho: normal → glitch → error.'),
]
PAGE = '''<!doctype html><html lang="es"><head><meta charset="utf-8"><title>%(title)s</title>
<style>html,body{margin:0;background:#0b0c16;color:#94b0c2;font-family:ui-monospace,Menlo,Consolas,monospace}
.wrap{max-width:1152px;margin:0 auto;padding:12px}h1{font-size:15px;margin:2px 0 8px;color:#ffcd75}
canvas{display:block;width:100%%;image-rendering:pixelated;image-rendering:crisp-edges;background:#000;border:2px solid #333c57;cursor:pointer}
p{font-size:12px;margin:8px 0 0}</style></head><body><div class="wrap"><h1>%(title)s</h1>
<canvas id="c"></canvas><p>%(hint)s &nbsp;·&nbsp; Datos de ejemplo (no son mediciones reales).</p></div>
<script>%(data)s%(lib)s%(scene)s</script></body></html>'''
for letter, fn, title, hint in DRAFTS:
    scene = open(os.path.join(HERE, 'lobby_%s.js' % letter), encoding='utf-8').read()
    html = PAGE % dict(title=title, hint=hint, data=data, lib=lib, scene=scene)
    open(os.path.join(OUT, fn), 'w', encoding='utf-8').write(html)
print('ok', OUT)
