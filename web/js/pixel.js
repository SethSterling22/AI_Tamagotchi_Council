/* Primitivas pixel (adaptadas de prototype/src/lobby_lib.js). Carga fuente y sprites desde archivos, no base64. */
export const P = {ink:'#1a1c2c', plum:'#5d275d', red:'#b13e53', orange:'#ef7d57', yellow:'#ffcd75', lime:'#a7f070',
  green:'#38b764', teal:'#257179', navy:'#29366f', blue:'#3b5dc9', sky:'#41a6f6', cyan:'#73eff7',
  white:'#f4f4f4', gray:'#94b0c2', slate:'#566c86', dark:'#333c57', void:'#0e0f1a'};
export const WALL = {ocelote:'#2d3a5e', buho:'#3b2f4a', erizo:'#2f4a46', panda_rojo:'#4a3340', kakapo:'#33423a', armino:'#262838'};
export const PET_COL = {ocelote:P.orange, buho:P.yellow, erizo:P.lime, panda_rojo:'#f0707f', kakapo:P.green, armino:P.slate};

export const gfx = {cv: null, g: null, W: 384, H: 216};
const fontImgs = {}, tintCache = {}, sheets = {};
let MAP = '', META = null;

export function setup(canvas, W, H) {
  gfx.cv = canvas; gfx.W = canvas.width = W; gfx.H = canvas.height = H;
  gfx.g = canvas.getContext('2d'); gfx.g.imageSmoothingEnabled = false;
}
const load = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('no se pudo cargar ' + src)); i.src = src; });
export async function loadAssets(keys) {
  const fm = await (await fetch('assets/font/font_map.json')).json(); MAP = fm.map;
  META = await (await fetch('assets/sprites/animations.json')).json();
  fontImgs.r = await load('assets/font/font_regular.png'); fontImgs.b = await load('assets/font/font_bold.png');
  await Promise.all(keys.map(async k => { sheets[k] = await load(`assets/sprites/${k}_spritesheet.png`); }));
  return META;
}
export const meta = () => META;

export function R(x, y, w, h, c) { gfx.g.fillStyle = c; gfx.g.fillRect(Math.round(x), Math.round(y), w, h); }
export function PX(x, y, c) { R(x, y, 1, 1, c); }
export function box(x, y, w, h, fill, bd, sh) {
  if (sh) { R(x + 1, y + h, w, 1, sh); R(x + w, y + 1, 1, h, sh); }
  R(x + 1, y, w - 2, h, bd); R(x, y + 1, w, h - 2, bd); R(x + 1, y + 1, w - 2, h - 2, fill);
}
export function rnd(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

function tinted(bold, col) {
  const k = (bold ? 'b' : 'r') + col; if (tintCache[k]) return tintCache[k];
  const im = fontImgs[bold ? 'b' : 'r'], c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const x = c.getContext('2d'); x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
  return (tintCache[k] = c);
}
export function T(s, x, y, col, bold) {
  s = String(s); const atlas = tinted(bold, col);
  for (let i = 0; i < s.length; i++) {
    let idx = MAP.indexOf(s[i]); if (idx < 0) idx = MAP.indexOf('?');
    gfx.g.drawImage(atlas, idx * 6, 0, 6, 13, Math.round(x) + i * 6, Math.round(y), 6, 13);
  }
}
export const TW = s => String(s).length * 6;
export const TC = (s, cx, y, col, bold) => T(s, cx - TW(s) / 2, y, col, bold);
export const clip = (s, n) => (String(s).length > n ? String(s).slice(0, Math.max(0, n - 1)) + '…' : String(s));

export function frameOf(act, t) { const A = META.actions[act]; return Math.floor(t * A.fps) % A.frames; }
/* Dibuja un sprite en el canvas del lobby o en cualquier contexto (ctx) */
export function spr(key, act, t, x, y, o) {
  o = o || {}; const A = META.actions[act], f = frameOf(act, t), sc = o.scale || 1, ctx = o.ctx || gfx.g, im = sheets[key];
  if (!im) return;
  ctx.drawImage(im, f * 32, A.row * 32, 32, 32, Math.round(x), Math.round(y), 32 * sc, 32 * sc);
}
export function tear(x, y, w, h, t, amt) {
  const g = gfx.g, slot = Math.floor(t * 8);
  for (let i = 0; i < 4; i++) {
    const by = y + Math.floor(rnd(slot * 3 + i) * (h - 4)), bh = 1 + Math.floor(rnd(slot * 5 + i) * 3);
    const dx = Math.round((rnd(slot * 7 + i) - .5) * 2 * amt);
    if (dx) { g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.drawImage(gfx.cv, x, by, w, bh, x + dx, by, w, bh); g.restore(); }
  }
}
export function scan(x, y, w, h, a) { gfx.g.fillStyle = 'rgba(0,0,0,' + a + ')'; for (let j = 0; j < h; j += 2) gfx.g.fillRect(x, y + j, w, 1); }
