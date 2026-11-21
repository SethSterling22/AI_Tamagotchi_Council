"""Rig chibi v2: cabeza grande casi cuadrada, ojos grandes con brillo, cuerpo pequeno."""
import math, os, sys
from PIL import Image, ImageDraw

W = 32


def H(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


def inside(x, y, cx, cy, rx, ry):
    return ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1


def inside_n(x, y, cx, cy, rx, ry, n):
    return abs((x + .5 - cx) / rx) ** n + abs((y + .5 - cy) / ry) ** n <= 1


class S:
    def __init__(self):
        self.p = [[None] * W for _ in range(W)]
        self.ox = 0
        self.oy = 0

    def _set(self, x, y, c, clip=False):
        if 0 <= x < W and 0 <= y < W:
            if clip and self.p[y][x] is None:
                return
            self.p[y][x] = H(c) if isinstance(c, str) else c

    def px(self, x, y, c, clip=False):
        self._set(int(round(x)) + self.ox, int(round(y)) + self.oy, c, clip)

    def pts(self, lst, c, clip=False):
        for x, y in lst:
            self.px(x, y, c, clip)

    def sym(self, lst, c, clip=False):
        for x, y in lst:
            self.px(x, y, c, clip)
            self.px(31 - x, y, c, clip)

    def rect(self, x0, y0, x1, y1, c, clip=False):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.px(x, y, c, clip)

    def ell(self, cx, cy, rx, ry, c, clip=False):
        cx += self.ox; cy += self.oy
        for y in range(W):
            for x in range(W):
                if inside(x, y, cx, cy, rx, ry):
                    self._set(x, y, c, clip)

    def ellsym(self, cx, cy, rx, ry, c, clip=False):
        self.ell(cx, cy, rx, ry, c, clip)
        self.ell(32 - cx, cy, rx, ry, c, clip)

    def sell(self, cx, cy, rx, ry, base, light, dark, clip=False):
        cx += self.ox; cy += self.oy
        for y in range(W):
            for x in range(W):
                if inside(x, y, cx, cy, rx, ry):
                    c = base
                    if not inside(x, y, cx - 1.3, cy - 1.3, rx, ry):
                        c = dark
                    elif inside(x, y, cx - rx * .35, cy - ry * .42, rx * .42, ry * .38):
                        c = light
                    self._set(x, y, c, clip)

    def sq(self, cx, cy, rx, ry, base, light, dark, n=2.6, clip=False):
        """Cabeza casi cuadrada (superelipse) con sombreado."""
        cx += self.ox; cy += self.oy
        for y in range(W):
            for x in range(W):
                if inside_n(x, y, cx, cy, rx, ry, n):
                    c = base
                    if not inside_n(x, y, cx - 1.2, cy - 1.4, rx, ry, n):
                        c = dark
                    elif inside(x, y, cx - rx * .45, cy - ry * .5, rx * .3, ry * .22):
                        c = light
                    self._set(x, y, c, clip)

    def _mask(self, fn):
        m = Image.new('1', (W, W), 0)
        fn(ImageDraw.Draw(m))
        return m

    def poly(self, pts, c, clip=False):
        pts = [(x + self.ox, y + self.oy) for x, y in pts]
        m = self._mask(lambda d: d.polygon(pts, fill=1))
        for y in range(W):
            for x in range(W):
                if m.getpixel((x, y)):
                    self._set(x, y, c, clip)

    def polysym(self, pts, c, clip=False):
        self.poly(pts, c, clip)
        self.poly([(31 - x, y) for x, y in pts], c, clip)

    def line(self, pts, c, width=1, clip=False):
        pts = [(x + self.ox, y + self.oy) for x, y in pts]
        m = self._mask(lambda d: d.line(pts, fill=1, width=width))
        for y in range(W):
            for x in range(W):
                if m.getpixel((x, y)):
                    self._set(x, y, c, clip)

    def each(self, region, fn):
        if region:
            region = (region[0] + self.ox, region[1] + self.oy, region[2], region[3])
        for y in range(W):
            for x in range(W):
                if self.p[y][x] is None:
                    continue
                if region and not inside(x, y, *region):
                    continue
                r = fn(x, y, self.p[y][x])
                if r:
                    self.p[y][x] = H(r)

    def trail(self, path, colorfn, size=2):
        samples = []
        for i in range(len(path) - 1):
            (x0, y0), (x1, y1) = path[i], path[i + 1]
            n = max(2, int(math.hypot(x1 - x0, y1 - y0) * 3))
            for k in range(n):
                t = k / n
                samples.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t))
        samples.append(path[-1])
        total = len(samples)
        off = size // 2
        for i, (x, y) in enumerate(samples):
            c = colorfn(i / max(1, total - 1))
            for dy in range(size):
                for dx in range(size):
                    self.px(round(x) - off + dx, round(y) - off + dy, c)

    def outline(self, c):
        new = [row[:] for row in self.p]
        for y in range(W):
            for x in range(W):
                if self.p[y][x] is None:
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < W and 0 <= ny < W and self.p[ny][nx] is not None:
                            new[y][x] = H(c)
                            break
        self.p = new

    def paste(self, o):
        for y in range(W):
            for x in range(W):
                if o.p[y][x] is not None:
                    self.p[y][x] = o.p[y][x]

    def paste_under(self, o):
        for y in range(W):
            for x in range(W):
                if o.p[y][x] is not None and self.p[y][x] is None:
                    self.p[y][x] = o.p[y][x]

    def image(self):
        im = Image.new('RGBA', (W, W), (0, 0, 0, 0))
        for y in range(W):
            for x in range(W):
                if self.p[y][x] is not None:
                    im.putpixel((x, y), self.p[y][x])
        return im


# ===================================================================
#  Proporciones: cabeza grande, cuerpo pequeno
# ===================================================================
BODY = (16, 25, 4.8, 4.2)          # filas 21..28
HEAD = (16, 13.4, 11.0, 8.6)       # filas 5..21, columnas 5..26
EYE_L, EYE_R = (9, 10), (19, 10)   # esquina sup. izq. de cada ojo (4x5)


def draw_eye(s, x, y, style, look, col):
    lx, ly = look
    if style == 'open':
        X, Y = x + lx, y + ly
        s.rect(X + 1, Y, X + 2, Y, col)
        s.rect(X, Y + 1, X + 3, Y + 3, col)
        s.rect(X + 1, Y + 4, X + 2, Y + 4, col)
        s.rect(X, Y + 1, X + 1, Y + 1, '#ffffff')      # brillo grande
        s.px(X, Y + 2, '#ffffff')
        s.px(X + 3, Y + 3, '#9fb0d8')                  # brillo pequeno
    elif style == 'blink':
        s.rect(x, y + 2, x + 3, y + 2, col)
    elif style == 'closed':
        s.px(x, y + 2, col); s.px(x + 1, y + 3, col); s.px(x + 2, y + 3, col); s.px(x + 3, y + 2, col)
    elif style == 'happy':
        s.px(x, y + 3, col); s.px(x + 1, y + 2, col); s.px(x + 2, y + 2, col); s.px(x + 3, y + 3, col)
    elif style == 'x':
        s.pts([(x, y + 1), (x + 3, y + 1), (x + 1, y + 2), (x + 2, y + 2),
               (x + 1, y + 3), (x + 2, y + 3), (x, y + 4), (x + 3, y + 4)], col)


def draw_eyes(s, sp, P):
    for (x, y) in (sp.eye_l, sp.eye_r):
        draw_eye(s, x, y, P['eyes'], P['look'], sp.eye_col)


def draw_mouth(s, sp, style):
    my, c = sp.my, sp.mouth_c
    if style == 'smile':
        s.pts([(14, my), (17, my)], c); s.pts([(15, my + 1), (16, my + 1)], c)
    elif style == 'open':
        s.rect(14, my, 17, my, c); s.rect(15, my + 1, 16, my + 1, '#e87a8a')
    elif style == 'o':
        s.rect(15, my, 16, my + 1, c)
    elif style == 'flat':
        s.rect(15, my, 16, my, c)
    elif style == 'wavy':
        s.pts([(13, my + 1), (14, my), (15, my + 1), (16, my), (17, my + 1), (18, my)], c)


def draw_feet(s, sp, P):
    lL, lR = P['lift']
    s.rect(12, 29 - lL, 14, 30 - lL, sp.foot)
    s.rect(17, 29 - lR, 19, 30 - lR, sp.foot)
    s.pts([(12, 30 - lL), (14, 30 - lL), (17, 30 - lR), (19, 30 - lR)], sp.foot_d)


SHOULDER = {'L': (11, 23), 'R': (20, 23)}
HAND = {
    'down': {'L': (9, 26), 'R': (22, 26)},
    'out': {'L': (6, 25), 'R': (25, 25)},
    'up': {'L': (4, 17), 'R': (27, 17)},
    'swing': {'L': (7, 27), 'R': (24, 27)},
    'chin': {'L': (11, 21), 'R': (20, 21)},
}
FRONT = {'chin'}
SKIP = {'type', 'hold'}


def draw_arm(s, sp, side, pose):
    if pose in SKIP:
        return
    sh = SHOULDER[side]
    hand = HAND[pose][side]
    s.line([sh, hand], sp.arm, width=sp.armw)
    s.px(hand[0], hand[1], sp.hand)
    if pose == 'chin':
        hx, hy = hand
        s.rect(hx - 1, hy - 3, hx + 1, hy - 3, sp.OL)
        s.rect(hx - 2, hy - 2, hx + 2, hy, sp.OL)
        s.rect(hx - 1, hy + 1, hx + 1, hy + 1, sp.OL)
        s.rect(hx - 1, hy - 2, hx + 1, hy, sp.hand)
        s.px(hx, hy - 1, sp.arm)
    if sp.armw >= 3:
        s.px(hand[0] + (1 if side == 'R' else -1), hand[1], sp.hand)


def render_char(sp, P):
    s = S()
    s.ox, s.oy = P['dx'], P['dy']
    sp.back(s, P)
    s.ox, s.oy = P['dx'], 0
    draw_feet(s, sp, P)
    s.ox, s.oy = P['dx'], P['dy']
    sp.body(s, P)
    for side, key in (('L', 'armL'), ('R', 'armR')):
        if P[key] not in FRONT:
            draw_arm(s, sp, side, P[key])
    s.ox, s.oy = P['dx'] + P['hdx'], P['dy'] + P['hdy']
    sp.head(s, P)
    draw_eyes(s, sp, P)
    sp.face(s, P)
    s.ox, s.oy = P['dx'], P['dy']
    for side, key in (('L', 'armL'), ('R', 'armR')):
        if P[key] in FRONT:
            draw_arm(s, sp, side, P[key])
    prop_pre(s, sp, P)
    s.ox = s.oy = 0
    s.outline(sp.OL)
    return s


# ===================================================================
#  Props
# ===================================================================
def prop_pre(s, sp, P):
    prop = P['prop']
    s.ox, s.oy = P['dx'], P['dy']
    if prop == 'laptop':
        s.rect(10, 25, 21, 28, '#c9ced8')
        s.rect(10, 25, 21, 25, '#e8ebf2')
        s.rect(10, 28, 21, 28, '#8f97ab')
        s.rect(15, 26, 16, 27, '#e8825a')
        a, b = (23, 24) if P['pframe'] % 2 == 0 else (24, 23)
        s.line([(11, 23), (13, a)], sp.arm, width=2)
        s.line([(20, 23), (18, b)], sp.arm, width=2)
        s.rect(12, a, 14, a, sp.hand); s.rect(17, b, 19, b, sp.hand)
    elif prop == 'book':
        s.rect(10, 24, 21, 28, '#5f7fd8')
        s.rect(10, 24, 21, 24, '#86a0ee')
        s.rect(15, 24, 16, 28, '#3e57a8')
        s.rect(10, 28, 21, 28, '#3e57a8')
        s.sym([(12, 26), (13, 26), (12, 27)], '#cfd9fb')
        s.rect(11, 23, 20, 23, '#f4f0e0')
        if P['pframe'] == 3:
            s.pts([(14, 22), (15, 22), (16, 22), (17, 22)], '#f4f0e0')
        s.line([(11, 23), (9, 26)], sp.arm, width=2)
        s.line([(20, 23), (22, 26)], sp.arm, width=2)
        s.rect(8, 26, 9, 27, sp.hand); s.rect(22, 26, 23, 27, sp.hand)


GLYPH_S = [(0, 0), (1, 0), (2, 0), (3, 0), (2, 1), (1, 2), (0, 3), (1, 3), (2, 3), (3, 3)]
GLYPH_B = [(0, 0), (1, 0), (2, 0), (3, 0), (4, 0), (3, 1), (2, 2), (1, 3), (0, 4), (1, 4), (2, 4), (3, 4), (4, 4)]


def prop_post(s, P):
    L = S()
    prop = P['prop']
    if prop == 'think':
        n = P['dots']
        OLc = '#4a5068'
        for y in range(0, 5):
            for x in range(23, 32):
                if (x in (23, 31)) and (y in (0, 4)):
                    continue
                edge = x in (23, 31) or y in (0, 4)
                L.px(x, y, OLc if edge else '#ffffff')
        for i in range(3):
            L.px(25 + i * 2, 2, OLc if i < n else '#d5d9e6')
        if P.get('bubble_under'):
            s.paste_under(L)
            return
    elif prop == 'zzz':
        for (x, y, big) in P['zspec']:
            g = GLYPH_B if big else GLYPH_S
            for (gx, gy) in g:
                L.px(x + gx + 1, y + gy + 1, '#2a3a66')
            for (gx, gy) in g:
                L.px(x + gx, y + gy, '#a9c8ff')
    elif prop == 'error':
        on = P['pframe'] % 2 == 0
        red, dkr = ('#e8323c', '#8a1220') if on else ('#ffcf3a', '#a06a10')
        tri = [(27, 0), (26, 1), (27, 1), (28, 1), (25, 2), (26, 2), (27, 2), (28, 2), (29, 2),
               (24, 3), (25, 3), (26, 3), (27, 3), (28, 3), (29, 3), (30, 3),
               (23, 4), (24, 4), (25, 4), (26, 4), (27, 4), (28, 4), (29, 4), (30, 4), (31, 4)]
        L.pts([(x + 1, y + 1) for x, y in tri if y < 4], dkr)
        L.pts(tri, red)
        L.pts([(27, 1), (27, 2)], '#ffffff'); L.px(27, 3, '#ffffff')
        if P.get('sweat'):
            sx, sy = P['sweat']
            L.pts([(sx, sy), (sx - 1, sy + 1), (sx, sy + 1), (sx + 1, sy + 1), (sx, sy + 2)], '#8fd4ff')
            L.px(sx, sy + 1, '#e6f6ff')
    elif prop == 'sparkle':
        for (x, y) in P['sparks']:
            for (dx, dy) in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
                L.px(x + dx, y + dy, '#ffd84a')
            L.px(x, y, '#fff6c8')
    s.paste(L)


# ===================================================================
#  Especies
# ===================================================================
class Sp:
    eye_l, eye_r = EYE_L, EYE_R
    eye_col = '#14100c'
    my = 19
    mouth_c = '#3a1e18'
    armw = 2


# ---------------- KAKAPO: verde musgo, disco facial de buho, pico palido
class Kakapo(Sp):
    OL = '#26311a'
    G = ('#6f9438', '#98bb52', '#4a6b28')
    arm = '#5d8230'; hand = '#4a6b28'
    foot = '#d9b79a'; foot_d = '#b8946f'

    def back(self, s, P):
        pass

    def body(self, s, P):
        s.sell(*BODY, *self.G)
        s.each(BODY, lambda x, y, c: '#4a6b28' if (x * 3 + y * 7) % 9 == 0 and c == H('#6f9438') else None)
        s.ell(16, 26.4, 3.0, 2.7, '#cdd36e', clip=True)
        s.ell(16, 27, 1.9, 1.6, '#e2e68a', clip=True)

    def head(self, s, P):
        s.sym([(9, 5), (10, 3), (12, 3), (13, 4), (11, 4)], '#4a6b28')
        s.sq(*HEAD, *self.G)
        s.each(HEAD, lambda x, y, c: '#4a6b28' if (x * 3 + y * 7) % 11 == 0 and c == H('#6f9438') else None)
        s.ell(16, 14.8, 10.2, 7.2, '#a7b955', clip=True)
        s.ell(16, 14.8, 9.2, 6.4, '#c9d577', clip=True)

    def face(self, s, P):
        beak, bd, dk = '#ecdcb0', '#d5c593', '#3a1e1e'
        s.rect(14, 15, 17, 15, beak)
        if P['mouth'] in ('open', 'o'):
            s.pts([(14, 16), (17, 16)], beak); s.rect(15, 16, 16, 16, dk)
            s.rect(15, 17, 16, 17, bd)
        else:
            s.rect(14, 16, 17, 16, bd)
            s.rect(15, 17, 16, 17, '#c2b184')
        s.sym([(11, 18), (10, 19), (11, 19)], '#7a9448')


# ---------------- OCELOTE: manchas negras, rayas en frente y mejillas, hocico crema
class Ocelote(Sp):
    OL = '#2b1a10'
    T = ('#dba644', '#efc66a', '#b07f2c')
    D = '#3a2416'
    arm = '#dba644'; hand = '#f2e0b0'
    foot = '#ecd29a'; foot_d = '#c9a45e'

    TAILS = [
        [(19, 27), (24, 28), (27, 25), (28, 21), (27, 18)],
        [(19, 27), (24, 28), (28, 26), (29, 22), (29, 19)],
        [(19, 27), (24, 28), (26, 25), (26, 21), (25, 18)],
    ]

    def back(self, s, P):
        s.trail(self.TAILS[P['tail']], lambda t: self.D if (t > .9 or int(t * 10) % 3 == 2) else self.T[0], size=2)

    def body(self, s, P):
        s.sell(*BODY, *self.T)
        s.ell(16, 26.4, 3.0, 2.8, '#f2e0b0', clip=True)
        s.sym([(12, 23), (11, 25), (13, 22)], self.D, clip=True)

    def head(self, s, P):
        for cx in (7.8, 24.2):
            s.ell(cx, 6.6, 3.1, 3.2, self.T[0])
            s.ell(cx, 7.4, 1.7, 1.7, '#d98a8a')
        s.sq(*HEAD, *self.T)
        s.polysym([(6, 16), (3, 19), (8, 20)], self.T[0])
        s.sym([(13, 6), (13, 7), (11, 7), (10, 8), (15, 5), (15, 6)], self.D)
        s.sym([(6, 15), (7, 15), (5, 17), (6, 17), (4, 19), (5, 19)], self.D)
        s.ell(16, 18, 4.4, 3.0, '#f2e0b0')

    def face(self, s, P):
        s.rect(15, 16, 16, 17, '#d98a8a')
        s.px(15, 16, '#b86a6a')
        draw_mouth(s, self, P['mouth'])


# ---------------- BUHO: plumicornios, ojos amarillos, babero blanco
class Buho(Sp):
    OL = '#2e2014'
    B = ('#8b6540', '#a8815a', '#634526')
    arm = '#7a5632'; hand = '#4a3220'
    foot = '#d8c488'; foot_d = '#a08a50'
    armw = 3
    eye_col = '#0e0a08'
    my = 19
    think_dx = -2          # se corre a la izquierda para que se vea la burbuja

    def back(self, s, P):
        pass

    def body(self, s, P):
        s.sell(*BODY, *self.B)
        s.ell(16, 26, 3.4, 3.4, '#e8d4a8', clip=True)
        s.each((16, 26, 3.4, 3.4), lambda x, y, c: '#6a4a2c' if (y % 2 == 0 and (x * 5 + y) % 3 == 0) else None)

    def head(self, s, P):
        # plumicornios (orejas de plumas)
        s.polysym([(9, 9), (6, 0), (14, 6)], self.B[0])
        s.polysym([(9, 8), (7, 2), (12, 6)], self.B[1])
        s.sym([(6, 1), (6, 2), (7, 3), (7, 4), (8, 5), (8, 6)], '#3a2616')
        s.sq(*HEAD, *self.B)
        s.each(HEAD, lambda x, y, c: '#6a4a2c' if (x * 3 + y * 7) % 8 == 0 and c == H('#8b6540') else ('#b89868' if (x * 5 + y * 3) % 11 == 0 and c == H('#8b6540') else None))
        # disco facial con borde oscuro
        s.ellsym(12.2, 14, 6.6, 6.2, '#4a3220')
        s.polysym([(8, 16), (15, 16), (15, 21)], '#4a3220')
        s.ellsym(12.2, 14, 5.8, 5.4, '#d9b98a')
        s.polysym([(9, 16), (15, 16), (15, 20)], '#d9b98a')
        s.rect(15, 8, 16, 13, '#efe0b8')
        # aro de los ojos
        s.ellsym(11.0, 12.5, 4.6, 4.8, '#4a3220')
        s.ellsym(11.0, 12.5, 3.7, 3.9, '#f2b632' if P['eyes'] == 'open' else '#c9a070')

    def face(self, s, P):
        beak, tip, dk = '#d8d0b8', '#8a8068', '#3a1e1e'
        s.ell(16, 19.6, 3.4, 2.2, '#f4f0e4')
        s.rect(15, 15, 16, 15, beak)
        if P['mouth'] in ('open', 'o'):
            s.rect(15, 16, 16, 16, dk); s.rect(15, 17, 16, 17, tip)
        else:
            s.rect(15, 16, 16, 16, beak); s.rect(15, 17, 16, 17, tip)


# ---------------- ERIZO: corona de puas, cara palida con nariz grande
class Erizo(Sp):
    OL = '#2a1a12'
    SP, SPL, SPD, TIP = '#6a4a30', '#8d6a46', '#4a3020', '#b08d62'
    SK = ('#e2b98f', '#f0d0aa', '#bd9168')
    arm = '#e2b98f'; hand = '#f0d0aa'
    foot = '#e2b98f'; foot_d = '#bd9168'
    my = 20

    def back(self, s, P):
        for y in (23, 25, 27):
            s.polysym([(11, y - 1), (8, y), (11, y + 1)], self.SP)
            s.sym([(8, y)], self.TIP)

    def body(self, s, P):
        s.sell(*BODY, *self.SK)
        s.ell(16, 26.4, 3.0, 2.8, '#f6e0c0', clip=True)

    def head(self, s, P):
        cx, cy, rx, ry = HEAD
        for deg in range(8, 173, 14):
            t = math.radians(deg)
            bx, by = cx + rx * .93 * math.cos(t), cy - ry * .93 * math.sin(t)
            ox, oy = math.cos(t), -math.sin(t)
            tx, ty = bx + ox * 4.4, by + oy * 4.4
            px_, py_ = -oy, ox
            s.poly([(bx - px_ * 1.9 - ox, by - py_ * 1.9 - oy), (bx + px_ * 1.9 - ox, by + py_ * 1.9 - oy), (tx, ty)], self.SP)
        s.sq(*HEAD, self.SP, self.SPL, self.SPD)
        s.each(HEAD, lambda x, y, c: self.TIP if (x + y * 2) % 5 == 0 and y < 12 else (self.SPD if (x + y * 2) % 5 == 2 and y < 12 else None))
        s.sell(16, 16.4, 8.8, 6.0, *self.SK)
        s.ellsym(6.4, 13, 2.3, 2.5, '#d99e8a')
        s.ell(16, 18.8, 4.2, 2.6, '#f6e0c0')
        s.sym([(9, 10), (10, 11), (11, 10), (12, 11), (13, 10), (14, 11), (15, 10)], self.SP)

    def face(self, s, P):
        s.ell(16, 16.8, 2.2, 1.6, '#1e1410')
        s.px(15, 16, '#7a6a60')
        draw_mouth(s, self, P['mouth'])


# ---------------- PANDA ROJO: orejas grandes, mejillas blancas, lagrimales, cola con anillos
class PandaRojo(Sp):
    OL = '#2a120c'
    R = ('#c4572a', '#e07b3c', '#9a3e1e')
    cream = '#f4eadb'
    arm = '#3a1f18'; hand = '#52291f'
    foot = '#3a1f18'; foot_d = '#24120d'

    TAILS = [
        [(19, 27), (24, 28), (27, 24), (28, 20), (26, 16)],
        [(19, 27), (24, 28), (27, 25), (28, 21), (28, 17)],
        [(19, 27), (24, 28), (27, 24), (27, 19), (25, 15)],
    ]

    def back(self, s, P):
        s.trail(self.TAILS[P['tail']], lambda t: '#4a2418' if t > .9 else ('#cf6030' if int(t * 9) % 2 == 0 else '#f0c090'), size=3)

    def body(self, s, P):
        s.sell(*BODY, *self.R)
        s.ell(16, 26.2, 3.6, 3.0, '#5a2a1c', clip=True)

    def head(self, s, P):
        s.polysym([(8, 10), (5, 2), (14, 6)], self.R[0])
        s.polysym([(9, 8), (7, 4), (12, 6)], '#d9c8b0')
        s.sym([(5, 2), (6, 3), (5, 3)], self.cream)
        s.sq(*HEAD, *self.R)
        s.ellsym(9.4, 17.6, 5.4, 4.0, self.cream, clip=True)
        s.ell(16, 18.2, 4.6, 3.2, self.cream)
        s.sym([(10, 8), (11, 8), (10, 9)], self.cream)
        s.sym([(9, 16), (9, 17), (8, 18), (8, 19)], '#9a3e1e')

    def face(self, s, P):
        s.rect(15, 16, 16, 17, '#14100c')
        draw_mouth(s, self, P['mouth'])


# ---------------- ARMINO: blanco invernal, orejas redondas, punta de cola negra
class Armino(Sp):
    OL = '#232a3a'
    Wh, SH, DK = '#f7f7fb', '#d3d9e8', '#a9b3cc'
    arm = '#f7f7fb'; hand = '#d3d9e8'
    foot = '#e4e8f2'; foot_d = '#a9b3cc'
    my = 19

    TAILS = [
        [(19, 27), (24, 28), (27, 25), (28, 21), (27, 17)],
        [(19, 27), (24, 28), (28, 26), (29, 22), (29, 18)],
        [(19, 27), (24, 28), (26, 25), (26, 21), (25, 17)],
    ]

    def back(self, s, P):
        s.trail(self.TAILS[P['tail']], lambda t: '#15151c' if t > .78 else self.Wh, size=2)

    def body(self, s, P):
        s.sell(*BODY, self.Wh, self.Wh, self.SH)
        s.ell(16, 26.4, 3.0, 2.8, '#fff1d6', clip=True)

    def head(self, s, P):
        for cx in (8.2, 23.8):
            s.ell(cx, 6.6, 3.2, 3.2, self.Wh)
            s.ell(cx, 7.2, 1.7, 1.8, '#e8b0b8')
        s.sq(16, 13.4, 10.8, 8.6, self.Wh, self.Wh, self.SH)
        s.sym([(7, 17), (8, 17), (7, 18), (8, 18)], '#f4b8c0')

    def face(self, s, P):
        s.rect(15, 16, 16, 16, '#15151c')
        draw_mouth(s, self, P['mouth'])


SPECIES = {
    'kakapo': (Kakapo(), 'Kakapo'),
    'ocelote': (Ocelote(), 'Ocelote'),
    'buho': (Buho(), 'B\u00faho'),
    'erizo': (Erizo(), 'Erizo'),
    'panda_rojo': (PandaRojo(), 'Panda rojo'),
    'armino': (Armino(), 'Armiño'),
}


# ===================================================================
#  Animaciones
# ===================================================================
def base():
    return dict(dx=0, dy=0, hdx=0, hdy=0, eyes='open', look=(0, 0), mouth='smile',
                armL='down', armR='down', lift=(0, 0), tail=0, prop=None, pframe=0,
                dots=0, zspec=[], sparks=[], sweat=None, glitch=None, gseed=0)


def mk(**kw):
    p = base(); p.update(kw); return p


ANIMS = {}

ANIMS['idle'] = dict(label='En reposo', status='Esperando…', fps=2.2, frames=[
    mk(hdy=0, tail=0),
    mk(hdy=0, tail=1, look=(-1, 0)),
    mk(hdy=1, tail=2, eyes='blink'),
    mk(hdy=1, tail=1, look=(1, 0)),
])

ANIMS['think'] = dict(label='Pensando', status='Pensando…', fps=3, frames=[
    mk(armR='chin', look=(1, -1), mouth='flat', prop='think', dots=1, pframe=0),
    mk(armR='chin', hdx=1, look=(1, -1), mouth='flat', prop='think', dots=2, pframe=1),
    mk(armR='chin', hdx=1, look=(-1, -1), mouth='o', prop='think', dots=3, pframe=2),
    mk(armR='chin', look=(-1, -1), eyes='blink', mouth='flat', prop='think', dots=2, pframe=3),
])

ANIMS['type'] = dict(label='Escribiendo código', status='Escribiendo código…', fps=7, frames=[
    mk(armL='type', armR='type', look=(0, 1), mouth='flat', prop='laptop', pframe=0, hdy=0, tail=0),
    mk(armL='type', armR='type', look=(0, 1), mouth='flat', prop='laptop', pframe=1, hdy=1, tail=1),
    mk(armL='type', armR='type', eyes='blink', mouth='flat', prop='laptop', pframe=2, hdy=0, tail=2),
    mk(armL='type', armR='type', look=(0, 1), mouth='smile', prop='laptop', pframe=3, hdy=0, tail=1),
])

ANIMS['read'] = dict(label='Leyendo archivos', status='Leyendo archivos…', fps=2.5, frames=[
    mk(armL='hold', armR='hold', look=(-1, 1), mouth='flat', prop='book', pframe=0),
    mk(armL='hold', armR='hold', look=(0, 1), mouth='flat', prop='book', pframe=1, hdy=1),
    mk(armL='hold', armR='hold', look=(1, 1), mouth='flat', prop='book', pframe=2),
    mk(armL='hold', armR='hold', look=(0, 1), mouth='o', prop='book', pframe=3, hdy=1),
])

ANIMS['sleep'] = dict(label='Durmiendo', status='Zzz…', fps=2, frames=[
    mk(hdy=1, eyes='closed', mouth='flat', prop='zzz', zspec=[(27, 8, 0)], tail=0),
    mk(hdy=2, eyes='closed', mouth='o', prop='zzz', zspec=[(27, 8, 0), (28, 3, 0)], tail=1),
    mk(hdy=3, eyes='closed', mouth='o', prop='zzz', zspec=[(26, 0, 1), (28, 6, 0)], tail=1),
    mk(hdy=2, eyes='closed', mouth='flat', prop='zzz', zspec=[(26, 2, 1)], tail=0),
])

ANIMS['celebrate'] = dict(label='¡Listo!', status='¡Tarea completada!', fps=6, frames=[
    mk(dy=1, eyes='happy', mouth='smile', armL='out', armR='out', lift=(0, 0)),
    mk(dy=-3, eyes='happy', mouth='open', armL='up', armR='up', lift=(3, 3), prop='sparkle', sparks=[(3, 7), (29, 6), (2, 20)], tail=1),
    mk(dy=-4, eyes='happy', mouth='open', armL='up', armR='up', lift=(4, 4), prop='sparkle', sparks=[(2, 4), (30, 11), (28, 2)], tail=2),
    mk(dy=-1, eyes='happy', mouth='open', armL='out', armR='out', lift=(1, 1), prop='sparkle', sparks=[(3, 11), (29, 16), (26, 2)], tail=1),
])

ANIMS['walk'] = dict(label='Caminando', status='Explorando…', fps=5, frames=[
    mk(dx=-1, lift=(1, 0), armR='out', tail=0),
    mk(dx=0, dy=-1, lift=(1, 1), tail=1),
    mk(dx=1, lift=(0, 1), armL='out', tail=2),
    mk(dx=0, dy=-1, lift=(1, 1), tail=1),
])

ANIMS['error'] = dict(label='Error', status='Error: algo salió mal', fps=4, frames=[
    mk(eyes='x', mouth='wavy', hdx=-1, prop='error', pframe=0, sweat=(5, 9), lift=(0, 0), tail=0),
    mk(eyes='x', mouth='wavy', hdx=1, prop='error', pframe=1, sweat=(5, 11), tail=1),
    mk(eyes='x', mouth='o', hdx=-1, hdy=1, prop='error', pframe=2, sweat=(4, 13), armL='out', armR='out', tail=2),
    mk(eyes='x', mouth='wavy', hdx=1, hdy=1, prop='error', pframe=3, sweat=(4, 15), armL='out', armR='out', tail=1),
])

ANIMS['glitch'] = dict(label='Glitch', status='Señal corrupta…', fps=8, frames=[
    mk(eyes='open', mouth='flat', glitch=1, gseed=1),
    mk(eyes='x', mouth='wavy', glitch=3, gseed=2, hdx=1),
    mk(eyes='open', look=(1, 0), mouth='o', glitch=2, gseed=3),
    mk(eyes='blink', mouth='flat', glitch=0, gseed=4),
    mk(eyes='x', mouth='flat', glitch=3, gseed=5, hdx=-1),
    mk(eyes='open', mouth='wavy', glitch=2, gseed=6, hdy=1),
])

ORDER = ['idle', 'think', 'type', 'read', 'sleep', 'celebrate', 'walk', 'error', 'glitch']


def glitch_image(im, level, seed):
    """Corrompe un frame de 32x32: separacion RGB, bandas desplazadas, canales cambiados y bloques de ruido."""
    import random
    rnd = random.Random(seed * 7919 + level)
    W_ = im.width
    src = [[im.getpixel((x, y)) for x in range(W_)] for y in range(W_)]
    out = [[(0, 0, 0, 0)] * W_ for _ in range(W_)]

    def put(x, y, c):
        if 0 <= x < W_ and 0 <= y < W_:
            out[y][x] = c

    if level >= 1:   # fantasmas rojo / cian detras del sprite
        for y in range(W_):
            for x in range(W_):
                if src[y][x][3]:
                    put(x + 1, y, (255, 45, 85, 255))
                    put(x - 1, y, (45, 235, 255, 255)) if level >= 2 else None
    for y in range(W_):
        for x in range(W_):
            if src[y][x][3]:
                out[y][x] = src[y][x]
    nb = {1: 1, 2: 2, 3: 4}.get(level, 0)
    for _ in range(nb):                       # bandas horizontales desplazadas
        y0 = rnd.randrange(2, 30); h = rnd.randint(1, 3 if level < 3 else 4)
        dx = rnd.choice([-1, 1]) * rnd.randint(2, 4 if level < 3 else 6)
        mode = rnd.choice(['shift', 'shift', 'swap'])
        for y in range(y0, min(W_, y0 + h)):
            row = out[y][:]
            new = [(0, 0, 0, 0)] * W_
            for x in range(W_):
                nx = x + dx
                if 0 <= nx < W_:
                    c = row[x]
                    if mode == 'swap' and c[3]:
                        c = (c[2], c[0], c[1], 255)
                    new[nx] = c
            out[y] = new
    for _ in range({0: 0, 1: 3, 2: 5, 3: 8}[level]):   # bloques de ruido sobre el sprite
        bx, by = rnd.randrange(3, 28), rnd.randrange(3, 30)
        bw, bh = rnd.randint(1, 4), rnd.randint(1, 2)
        col = rnd.choice([(255, 45, 85, 255), (45, 235, 255, 255), (255, 255, 255, 255), (20, 12, 40, 255), (200, 60, 255, 255)])
        for yy in range(by, by + bh):
            for xx in range(bx, bx + bw):
                if 0 <= xx < W_ and 0 <= yy < W_ and out[yy][xx][3]:
                    out[yy][xx] = col
    if level >= 2:   # lineas de barrido oscuras
        y0 = rnd.randrange(4, 26)
        for y in range(y0, min(W_, y0 + 6), 2):
            for x in range(W_):
                c = out[y][x]
                if c[3]:
                    out[y][x] = (c[0] // 2, c[1] // 2, c[2] // 2, 255)
    res = Image.new('RGBA', (W_, W_), (0, 0, 0, 0))
    for y in range(W_):
        for x in range(W_):
            res.putpixel((x, y), out[y][x])
    return res


def frame_image(sp, P):
    if P['prop'] == 'think' and getattr(sp, 'think_dx', 0):
        P = dict(P); P['dx'] += sp.think_dx; P['bubble_under'] = True
    if P['prop'] == 'error' and getattr(sp, 'think_dx', 0):
        P = dict(P); P['dx'] += sp.think_dx
    s = render_char(sp, P)
    s.ox = s.oy = 0
    prop_post(s, P)
    im = s.image()
    if P.get('glitch') is not None:
        im = glitch_image(im, P['glitch'], P.get('gseed', 0))
    return im


def all_frames(key):
    sp = SPECIES[key][0]
    return {a: [frame_image(sp, P) for P in ANIMS[a]['frames']] for a in ORDER}


def up(im, k):
    return im.resize((im.width * k, im.height * k), Image.NEAREST)


def preview(outdir):
    cols, k = 6, 6
    sheet = Image.new('RGBA', (cols * 32 * k, len(ORDER) * 32 * k), (60, 64, 80, 255))
    for ci, key in enumerate(SPECIES):
        fr = all_frames(key)
        for ri, a in enumerate(ORDER):
            sheet.alpha_composite(up(fr[a][1], k), (ci * 32 * k, ri * 32 * k))
    sheet.save(os.path.join(outdir, 'preview_v2.png'))


if __name__ == '__main__':
    if sys.argv[1] == 'preview':
        preview(sys.argv[2])
