import os, sys, json, base64, io, zipfile
sys.path.insert(0, os.path.dirname(__file__))
from PIL import Image, ImageDraw, ImageFont
import mascotas_v2 as M

OUT = sys.argv[1]
os.makedirs(os.path.join(OUT, 'spritesheets'), exist_ok=True)
os.makedirs(os.path.join(OUT, 'gifs'), exist_ok=True)
os.makedirs(os.path.join(OUT, 'showcase'), exist_ok=True)

COLS = 6
ROWS = len(M.ORDER)


def to_p(im):
    a = im.split()[3]
    p = im.convert('RGB').quantize(colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    mask = a.point(lambda v: 255 if v < 128 else 0)
    p.paste(255, mask)
    return p


def save_gif(frames, path, durations, scale=8):
    ps = [to_p(M.up(f, scale)) for f in frames]
    ps[0].save(path, save_all=True, append_images=ps[1:], duration=durations, loop=0,
               transparency=255, disposal=2, optimize=False)


meta = {
    'sprite_size': 32,
    'columns': COLS,
    'rows': ROWS,
    'note': 'Cada fila de la spritesheet es una accion; cada columna, un frame. Origen arriba a la izquierda.',
    'actions': {},
    'pets': {},
}
for i, a in enumerate(M.ORDER):
    A = M.ANIMS[a]
    meta['actions'][a] = {'row': i, 'frames': len(A['frames']), 'fps': A['fps'],
                          'label': A['label'], 'status': A['status']}

sheets_b64 = {}
all_frames = {}
for key, (sp, name) in M.SPECIES.items():
    meta['pets'][key] = {'name': name, 'sheet': f'spritesheets/{key}_spritesheet.png'}
    fr = M.all_frames(key)
    all_frames[key] = fr
    sheet = Image.new('RGBA', (COLS * 32, ROWS * 32), (0, 0, 0, 0))
    for ri, a in enumerate(M.ORDER):
        for ci, im in enumerate(fr[a]):
            sheet.alpha_composite(im, (ci * 32, ri * 32))
        durs = int(1000 / M.ANIMS[a]['fps'])
        save_gif(fr[a], os.path.join(OUT, 'gifs', f'{key}_{a}.gif'), durs)
    path = os.path.join(OUT, 'spritesheets', f'{key}_spritesheet.png')
    sheet.save(path)
    buf = io.BytesIO(); sheet.save(buf, 'PNG')
    sheets_b64[key] = base64.b64encode(buf.getvalue()).decode()
    # GIF resumen con todas las acciones seguidas (2 vueltas por accion para que se aprecie)
    seq, durs = [], []
    for a in M.ORDER:
        d = int(1000 / M.ANIMS[a]['fps'])
        for _ in range(2):
            for im in fr[a]:
                seq.append(im); durs.append(d)
    save_gif(seq, os.path.join(OUT, 'showcase', f'{key}_todas_las_acciones.gif'), durs)

json.dump(meta, open(os.path.join(OUT, 'animations.json'), 'w'), indent=2, ensure_ascii=False)

# ---------- hoja resumen
K = 5
cell = 32 * K
lab_w, head_h, pad = 200, 44, 6
sheet = Image.new('RGBA', (lab_w + 6 * (cell + pad), head_h + ROWS * (cell + pad)), (38, 42, 56, 255))
d = ImageDraw.Draw(sheet)
f_path = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
font = ImageFont.truetype(f_path, 17)
font_b = ImageFont.truetype(f_path, 18)
for ci, (key, (sp, name)) in enumerate(M.SPECIES.items()):
    x = lab_w + ci * (cell + pad)
    tw = d.textlength(name, font=font_b)
    d.text((x + (cell - tw) / 2, 12), name, font=font_b, fill=(235, 238, 246, 255))
for ri, a in enumerate(M.ORDER):
    y = head_h + ri * (cell + pad)
    d.text((12, y + cell / 2 - 10), M.ANIMS[a]['label'], font=font, fill=(200, 206, 222, 255))
    for ci, (key, (sp, name)) in enumerate(M.SPECIES.items()):
        x = lab_w + ci * (cell + pad)
        d.rectangle([x, y, x + cell - 1, y + cell - 1], fill=(74, 82, 104, 255))
        sheet.alpha_composite(M.up(all_frames[key][a][2 if a == 'glitch' else 1], K), (x, y))
sheet.save(os.path.join(OUT, 'hoja_resumen_mascotas.png'))

# ---------- demo HTML
html = open(os.path.join(os.path.dirname(__file__), 'demo_template_v2.html'), encoding='utf-8').read()
html = html.replace('/*SHEETS*/', 'const SHEETS=' + json.dumps(sheets_b64) + ';')
html = html.replace('/*META*/', 'const META=' + json.dumps(meta, ensure_ascii=False) + ';')
open(os.path.join(OUT, 'demo_mascotas.html'), 'w', encoding='utf-8').write(html)

# ---------- zip
zp = OUT.rstrip('/') + '.zip'
with zipfile.ZipFile(zp, 'w', zipfile.ZIP_DEFLATED) as z:
    for root, _, files in os.walk(OUT):
        for fn in files:
            full = os.path.join(root, fn)
            z.write(full, os.path.relpath(full, os.path.dirname(OUT.rstrip('/'))))
print('ok', zp)
