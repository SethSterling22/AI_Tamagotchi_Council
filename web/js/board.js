/* Tablero: una habitación por mascota, con su estado de conexión real. */
import {P, WALL, PET_COL, gfx, R, PX, box, T, TW, TC, clip, spr, tear, scan} from './pixel.js';

const STATE_LABEL = {pending: 'CONECTANDO…', online: 'EN ESPERA', glitch: 'SIN SEÑAL', error: 'ERROR'};
export function actionFor(pet) {
  const s = pet.status || {state: 'pending'};
  if (s.state === 'pending') return 'sleep';
  if (s.state === 'glitch') return 'glitch';
  if (s.state === 'error') return 'error';
  return s.activity === 'think' ? 'think' : 'idle';
}
export function eventText(e, pets) {
  const p = pets.find(x => x.id === e.pet_id), who = p ? p.name.toLowerCase() : 'lobby';
  const msg = {created: 'se unió al consejo', state: e.detail, edited: 'ajustes cambiados: ' + e.detail,
    hello: '«' + e.detail + '»', hello_failed: 'saludo falló · ' + e.detail}[e.kind] || e.detail;
  return who + '> ' + msg;
}

export function createBoard({onAdd, onOpen}) {
  let mx = -1, my = -1, HIT = [], page = 0;
  const cv = gfx.cv;
  const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * gfx.W / r.width, (e.clientY - r.top) * gfx.H / r.height]; };
  cv.addEventListener('mousemove', e => { [mx, my] = pos(e); });
  cv.addEventListener('mouseleave', () => { mx = my = -1; });
  cv.addEventListener('click', e => {
    const [x, y] = pos(e);
    for (let i = HIT.length - 1; i >= 0; i--) { const h = HIT[i]; if (x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h) { h.fn(); return; } }
  });
  window.__labels = () => HIT.map(h => h.label);
  window.__click = l => { const h = HIT.find(h => h.label === l); if (h) { h.fn(); return true; } return false; };
  const over = (x, y, w, h) => mx >= x && mx < x + w && my >= y && my < y + h;
  function btn(label, x, y, w, h, fn, id, on) {
    const hov = over(x, y, w, h);
    box(x, y, w, h, on ? P.yellow : (hov ? '#2f3560' : '#1a1c2c'), on ? P.white : (hov ? P.cyan : P.slate));
    TC(label, x + w / 2, y + Math.floor((h - 12) / 2), on ? P.void : P.white, true);
    HIT.push({x, y, w, h, fn, label: id || label});
  }

  function room(pet, x, y, w, h, t) {
    const key = pet.species, col = PET_COL[key], s = pet.status || {state: 'pending'}, act = actionFor(pet);
    const bad = s.state === 'glitch' || s.state === 'error', big = h >= 100, sc = big ? 2 : 1;
    box(x, y, w, h, WALL[key], P.void, '#000');
    for (let yy = y + 5; yy < y + h - 12; yy += 8) for (let xx = x + 4 + (((yy - y) / 8 | 0) % 2) * 4; xx < x + w - 4; xx += 8) PX(xx, yy, 'rgba(255,255,255,0.07)');
    R(x + 1, y + h - 9, w - 2, 8, '#1f2233'); R(x + 1, y + h - 9, w - 2, 1, P.slate);
    const sx = x + (w - 32 * sc) / 2, sy = y + h - 9 - 32 * sc + (big ? 6 : 6) + (act === 'sleep' ? 2 : 0);
    spr(key, act, t, sx, sy, {scale: sc});
    if (bad) {
      const c = s.state === 'glitch' ? P.red : P.orange, bh = 37, e = s.error || {code: '?', message: ''};
      box(x + 3, y + 2, w - 6, bh, '#240a14', c);
      T(clip(pet.name + ' ' + STATE_LABEL[s.state], Math.floor((w - 14) / 6)), x + 7, y + 3, c, true);
      T(clip(e.code, Math.floor((w - 10) / 6)), x + 7, y + 14, P.white);
      T(clip(pet.host + ':' + pet.port, Math.floor((w - 10) / 6)), x + 7, y + 25, P.yellow);
      if (Math.floor(t * 2) % 2) R(x + w - 10, y + 5, 5, 5, c);
      if (s.state === 'glitch') { tear(x + 1, y + bh + 4, w - 2, h - bh - 5, t, 6); tear(x + 3, y + 2, w - 6, bh, t, 2); scan(x + 1, y + bh + 4, w - 2, h - bh - 5, 0.18); }
    } else {
      box(x + 3, y + 3, TW(clip(pet.name, 10)) + 7, 12, P.void, col); T(clip(pet.name, 10), x + 6, y + 3, col, true);
      const rl = clip(pet.species === 'kakapo' ? 'EMBED' : pet.model, Math.floor((w - TW(clip(pet.name, 10)) - 20) / 6));
      T(rl, x + w - 6 - TW(rl), y + 3, P.gray);
      const lab = s.state === 'pending' ? 'CONECTANDO…' : (act === 'think' ? 'PENSANDO' : 'EN ESPERA');
      T(lab, x + 5, y + 17, s.state === 'pending' ? P.sky : P.white);
      if (s.latency_ms != null && s.state === 'online') T(s.latency_ms + 'ms', x + w - 6 - TW(s.latency_ms + 'ms'), y + 17, P.green);
    }
    // barra de energía + nivel
    R(x + 6, y + h - 6, 40, 3, '#0e0f1a'); R(x + 6, y + h - 6, Math.round(40 * ((pet.stats || {}).energy || 0) / 100), 3, bad ? P.red : col);
    const lv = 'NV' + pet.level; T(lv, x + w - 6 - TW(lv), y + h - 14, P.gray);
    HIT.push({x, y, w, h, fn: () => onOpen(pet), label: 'room:' + pet.slug});
  }

  function emptySlot(x, y, w, h, t, first) {
    const hov = over(x, y, w, h);
    box(x, y, w, h, hov ? '#1d2040' : '#12131f', hov ? P.cyan : P.dark);
    for (let i = 0; i < w - 8; i += 6) { PX(x + 4 + i, y + 3, P.dark); PX(x + 4 + i, y + h - 4, P.dark); }
    const cx = x + w / 2, cy = y + h / 2 - 12;
    R(cx - 8, cy, 16, 4, hov ? P.yellow : P.slate); R(cx - 2, cy - 6, 4, 16, hov ? P.yellow : P.slate);
    TC('AÑADIR', cx, cy + 16, hov ? P.yellow : P.gray, true);
    if (first) TC('MASCOTA', cx, cy + 28, P.gray);
    HIT.push({x, y, w, h, fn: onAdd, label: 'slot:add'});
  }

  function draw(t, st) {
    HIT = []; const W = gfx.W, H = gfx.H, portrait = H > W;
    R(0, 0, W, H, '#12131f');
    R(0, 0, W, 16, P.void); R(0, 15, W, 1, P.slate); T('AI COUNCIL', 5, 1, P.yellow, true);
    const pets = st.pets || [], cols = portrait ? 2 : 3, rows = portrait ? 3 : 2, per = cols * rows;
    const logH = portrait ? 46 : 40, top = 18, gap = 4;
    const rw = Math.floor((W - 8 - gap * (cols - 1)) / cols), rh = Math.floor((H - top - logH - 6 - gap * (rows - 1)) / rows);
    const slots = pets.length + 1, pages = Math.max(1, Math.ceil(slots / per)); if (page >= pages) page = pages - 1;
    // cabecera: pager y botón añadir
    btn('+ MASCOTA', W - 70, 1, 66, 14, onAdd, 'btn:add');
    if (pages > 1) {
      btn('‹', W - 108, 1, 14, 14, () => { page = (page + pages - 1) % pages; }, 'pg:prev');
      TC((page + 1) + '/' + pages, W - 80 - 14, 1, P.gray); btn('›', W - 90 + 0, 1, 14, 14, () => { page = (page + 1) % pages; }, 'pg:next');
    }
    const ok = pets.filter(p => (p.status || {}).state === 'online').length;
    const avail = Math.floor((W - 70 - (pages > 1 ? 40 : 0) - 79) / 6);
    let tag = st.offline ? 'LOBBY SIN SEÑAL' : ok + '/' + pets.length + ' EN LÍNEA';
    if (tag.length > avail) tag = st.offline ? 'SIN SEÑAL' : ok + '/' + pets.length;
    T(tag, 5 + 11 * 6 + 8, 1, st.offline ? P.red : (pets.length && ok === pets.length ? P.green : P.gray));
    for (let i = 0; i < per; i++) {
      const idx = page * per + i, x = 4 + (i % cols) * (rw + gap), y = top + Math.floor(i / cols) * (rh + gap);
      if (idx < pets.length) room(pets[idx], x, y, rw, rh, t);
      else if (idx === pets.length) emptySlot(x, y, rw, rh, t, pets.length === 0);
    }
    // registro
    const ly = H - logH - 2; R(0, ly, W, logH + 2, P.void); R(0, ly, W, 1, P.slate);
    const ev = (st.events || []).slice(0, 3).reverse(), n = Math.floor((W - 12) / 6);
    ev.forEach((e, i) => {
      const line = eventText(e, pets), c = /glitch|error|falló/.test(line) ? P.orange : (i === ev.length - 1 ? P.cyan : P.slate);
      T(clip(line, n), 6, ly + 4 + i * 13, c);
    });
    if (!ev.length) T('lobby> esperando mascotas…', 6, ly + 4, P.slate);
  }
  return {draw};
}
