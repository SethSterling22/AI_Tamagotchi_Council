/* ===== AI Council · mini-libreria pixel (canvas logico 384x216) ===== */
const LW = window.LW_ || 384, LH = window.LH_ || 216;
const cv = document.getElementById('c'); cv.width = LW; cv.height = LH;
const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
const P = {ink:'#1a1c2c', plum:'#5d275d', red:'#b13e53', orange:'#ef7d57', yellow:'#ffcd75', lime:'#a7f070',
  green:'#38b764', teal:'#257179', navy:'#29366f', blue:'#3b5dc9', sky:'#41a6f6', cyan:'#73eff7',
  white:'#f4f4f4', gray:'#94b0c2', slate:'#566c86', dark:'#333c57', void:'#0e0f1a'};
const KEYS = ['ocelote', 'buho', 'erizo', 'panda_rojo', 'kakapo', 'armino'];
const PET = {
  ocelote:    {name:'OCELOTE', role:'CONSTRUCTOR', host:'PI 4 B',     ini:'OC', col:P.orange, lv:7, model:'qwen3:4b',     ram:62, temp:58, tps:'4.1', ip:'ocelote',  xp:70, mood:80, know:31},
  buho:       {name:'BÚHO',    role:'INVESTIGADOR', host:'GALAXY A21S', ini:'BU', col:P.yellow, lv:5, model:'qwen3:1.7b',   ram:71, temp:41, tps:'2.8', ip:'buho',     xp:45, mood:65, know:22},
  erizo:      {name:'ERIZO',   role:'CRÍTICO',      host:'PI 3 B',      ini:'ER', col:P.lime,   lv:3, model:'qwen3:0.6b',   ram:55, temp:49, tps:'5.6', ip:'erizo',    xp:20, mood:40, know:9},
  panda_rojo: {name:'PANDA',   role:'ANFITRIÓN',    host:'PI 3 B',      ini:'PA', col:'#f0707f', lv:6, model:'qwen3:0.6b',   ram:48, temp:47, tps:'5.9', ip:'panda',    xp:88, mood:95, know:35},
  kakapo:     {name:'KAKAPO',  role:'ARCHIVISTA',   host:'GALAXY A12',  ini:'KA', col:P.green,  lv:2, model:'qwen3-embed',  ram:40, temp:38, tps:'-',   ip:'kakapo',   xp:12, mood:70, know:14},
  armino:     {name:'???',     role:'BLOQUEADO',    host:'-',           ini:'AR', col:P.slate,  lv:0, model:'-',            ram:0,  temp:0,  tps:'-',   ip:'-',        xp:0,  mood:0,  know:0},
};
const ACT_LABEL = {idle:'EN ESPERA', think:'PENSANDO', type:'ESCRIBIENDO CÓDIGO', read:'LEYENDO ARCHIVOS', sleep:'DURMIENDO',
  celebrate:'¡TAREA LISTA!', walk:'EXPLORANDO', error:'ERROR', glitch:'SEÑAL CORRUPTA', locked:'NIVEL 5 REQUERIDO'};

/* ---------- primitivas ---------- */
function R(x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); }
function PX(x, y, c) { R(x, y, 1, 1, c); }
function box(x, y, w, h, fill, bd, sh) {
  if (sh) { R(x + 1, y + h, w, 1, sh); R(x + w, y + 1, 1, h, sh); }
  R(x + 1, y, w - 2, h, bd); R(x, y + 1, w, h - 2, bd);
  R(x + 1, y + 1, w - 2, h - 2, fill);
}
function dither(x, y, w, h, c, ph) {
  g.fillStyle = c; ph = ph || 0;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (((i + j + ph) & 1) === 0) g.fillRect(x + i, y + j, 1, 1);
}
function rnd(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function corrupt(s, t, p) {
  const slot = Math.floor(t * 10);
  return [...s].map((c, i) => (c !== ' ' && rnd(slot * 131 + i * 17) < p) ? '#%&@$!?*'.charAt(Math.floor(rnd(i + slot) * 8)) : c).join('');
}

/* ---------- texto con fuente bitmap ---------- */
const fontImgs = {}, tintCache = {}, sheets = {};
function tinted(bold, col) {
  const k = (bold ? 'b' : 'r') + col; if (tintCache[k]) return tintCache[k];
  const im = fontImgs[bold ? 'b' : 'r']; const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const x = c.getContext('2d'); x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
  return (tintCache[k] = c);
}
function T(s, x, y, col, bold, shadow) {
  s = String(s);
  if (shadow) T(s, x + 1, y + 1, shadow, bold);
  const atlas = tinted(bold, col);
  for (let i = 0; i < s.length; i++) {
    let idx = MAP.indexOf(s[i]); if (idx < 0) idx = MAP.indexOf('?');
    g.drawImage(atlas, idx * 6, 0, 6, 13, Math.round(x) + i * 6, Math.round(y), 6, 13);
  }
}
function TW(s) { return String(s).length * 6; }
function TC(s, cx, y, col, bold, shadow) { T(s, cx - TW(s) / 2, y, col, bold, shadow); }
function wrap(s, n) {
  const words = s.split(' '), lines = []; let cur = '';
  for (const w of words) { if ((cur + ' ' + w).trim().length > n) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) lines.push(cur); return lines;
}

/* ---------- sprites ---------- */
function frameOf(act, t) { const A = META.actions[act]; return Math.floor(t * A.fps) % A.frames; }
function spr(key, act, t, x, y, o) {
  o = o || {}; const A = META.actions[act === 'locked' ? 'idle' : act]; const f = o.frame !== undefined ? o.frame : frameOf(act === 'locked' ? 'idle' : act, t);
  const sx = f * 32, sy = A.row * 32, sc = o.scale || 1, im = sheets[key];
  if (o.tint) {
    const c = document.createElement('canvas'); c.width = 32; c.height = 32; const x2 = c.getContext('2d');
    x2.drawImage(im, sx, sy, 32, 32, 0, 0, 32, 32); x2.globalCompositeOperation = 'source-in'; x2.fillStyle = o.tint; x2.fillRect(0, 0, 32, 32);
    g.drawImage(c, Math.round(x), Math.round(y), 32 * sc, 32 * sc);
  } else if (o.flip) {
    g.save(); g.translate(Math.round(x) + 32 * sc, Math.round(y)); g.scale(-1, 1); g.drawImage(im, sx, sy, 32, 32, 0, 0, 32 * sc, 32 * sc); g.restore();
  } else g.drawImage(im, sx, sy, 32, 32, Math.round(x), Math.round(y), 32 * sc, 32 * sc);
}
function tear(x, y, w, h, t, amt) {
  const slot = Math.floor(t * 8);
  for (let i = 0; i < 4; i++) {
    const by = y + Math.floor(rnd(slot * 3 + i) * (h - 4)), bh = 1 + Math.floor(rnd(slot * 5 + i) * 3);
    const dx = Math.round((rnd(slot * 7 + i) - .5) * 2 * amt);
    if (dx) { g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.drawImage(cv, x, by, w, bh, x + dx, by, w, bh); g.restore(); }
  }
}
function scan(x, y, w, h, a) { g.fillStyle = 'rgba(0,0,0,' + a + ')'; for (let j = 0; j < h; j += 2) g.fillRect(x, y + j, w, 1); }

/* ---------- estado de las mascotas (demo) ---------- */
const SCRIPT = {
  ocelote: [['type', 6], ['think', 3], ['type', 5], ['celebrate', 2.5]],
  buho: [['read', 5], ['think', 3], ['read', 6], ['idle', 2]],
  erizo: [['idle', 999]],
  panda_rojo: [['idle', 3], ['walk', 4], ['celebrate', 2], ['idle', 3]],
  kakapo: [['sleep', 999]],
  armino: [['locked', 999]],
};
const ST = {};
KEYS.forEach(k => { ST[k] = {i: 0, until: SCRIPT[k][0][1], force: null}; });
ST.erizo.force = 'glitch';
function curAct(k, t) {
  const s = ST[k]; if (s.force) return s.force;
  if (t >= s.until) { s.i = (s.i + 1) % SCRIPT[k].length; s.until = t + SCRIPT[k][s.i][1]; }
  return SCRIPT[k][s.i][0];
}
function ledColor(act) {
  return {glitch: P.red, error: P.orange, sleep: P.sky, locked: P.slate}[act] || P.green;
}
function cycleForce(k) { const o = [null, 'glitch', 'error']; const s = ST[k]; s.force = o[(o.indexOf(s.force) + 1) % 3]; }
const ERRS = {
  glitch: ['SIN SEÑAL', 'ECONNREFUSED', '100.64.0.12', ':11434'],
  error: ['ERROR', 'OOM qwen3:0.6b', 'RAM 98% ', 'reinicio'],
};

/* ---------- arranque ---------- */
function loadImg(src) { return new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; }); }
async function boot(draw, onClick, onKey) {
  fontImgs.r = await loadImg('data:image/png;base64,' + FONT_R_B64);
  fontImgs.b = await loadImg('data:image/png;base64,' + FONT_B_B64);
  for (const k of Object.keys(SHEETS)) sheets[k] = await loadImg('data:image/png;base64,' + SHEETS[k]);
  const t0 = performance.now();
  window.__t = () => (performance.now() - t0) / 1000;
  if (onClick) cv.addEventListener('click', e => {
    const r = cv.getBoundingClientRect(); onClick((e.clientX - r.left) * LW / r.width, (e.clientY - r.top) * LH / r.height, window.__t());
  });
  if (onKey) window.addEventListener('keydown', e => onKey(e, window.__t()));
  (function frame() { g.clearRect(0, 0, LW, LH); draw(window.__t()); requestAnimationFrame(frame); })();
}
