/* Tablero: una habitación por mascota, con su estado de conexión real. */
import {P, WALL, PET_COL, gfx, R, PX, box, T, TW, TC, clip, spr, tear, scan} from './pixel.js';
import {PHASE, phaseIcon, tintRoom} from './cycle.js';
import {parcelIcon} from './tasks.js';

const STATE_LABEL = {pending: 'CONECTANDO…', online: 'EN ESPERA', glitch: 'SIN SEÑAL', error: 'ERROR'};
// Son nocturnas: de día duermen (se las puede despertar para planificar); de noche están de guardia para sus encomiendas.
const PHASE_LABEL = {dia: 'DESCANSA', atardecer: 'DESPIERTA', noche: 'DE GUARDIA', amanecer: 'AMANECE'};
const WORK_ACT = {buho: 'read', erizo: 'read'};  // investigar y revisar = leer; construir y conversar = teclear
const mmss = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
export function actionFor(pet, phase) {
  const s = pet.status || {state: 'pending'};
  if (s.state === 'pending') return 'sleep';
  if (s.state === 'glitch') return 'glitch';
  if (s.state === 'error') return 'error';
  if (s.activity === 'think') return 'think';
  const tk = pet.tasks || {};
  if (tk.running) return WORK_ACT[pet.species] || 'type';
  if (phase === 'amanecer' && tk.unseen) return 'celebrate';
  return phase === 'dia' ? 'sleep' : 'idle';
}
export function eventText(e, pets) {
  const p = pets.find(x => x.id === e.pet_id), who = p ? p.name.toLowerCase() : 'lobby';
  const msg = {created: 'se unió al consejo', state: e.detail, edited: 'ajustes cambiados: ' + e.detail,
    hello: '«' + e.detail + '»', hello_failed: 'saludo falló · ' + e.detail, cycle_edited: 'horario: ' + e.detail}[e.kind] || e.detail;
  return who + '> ' + msg;
}

export function createBoard({onAdd, onOpen, onCycle, onTasks}) {
  let mx = -1, my = -1, HIT = [], page = 0, ACTS = [];
  const cv = gfx.cv;
  const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * gfx.W / r.width, (e.clientY - r.top) * gfx.H / r.height]; };
  cv.addEventListener('mousemove', e => { [mx, my] = pos(e); });
  cv.addEventListener('mouseleave', () => { mx = my = -1; });
  cv.addEventListener('click', e => {
    const [x, y] = pos(e);
    for (let i = HIT.length - 1; i >= 0; i--) { const h = HIT[i]; if (x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h) { h.fn(); return; } }
  });
  window.__labels = () => HIT.map(h => h.label);
  window.__acts = () => ACTS;
  window.__click = l => { const h = HIT.find(h => h.label === l); if (h) { h.fn(); return true; } return false; };
  const over = (x, y, w, h) => mx >= x && mx < x + w && my >= y && my < y + h;
  function btn(label, x, y, w, h, fn, id, on) {
    const hov = over(x, y, w, h);
    box(x, y, w, h, on ? P.yellow : (hov ? '#2f3560' : '#1a1c2c'), on ? P.white : (hov ? P.cyan : P.slate));
    TC(label, x + w / 2, y + Math.floor((h - 12) / 2), on ? P.void : P.white, true);
    HIT.push({x, y, w, h, fn, label: id || label});
  }

  function room(pet, x, y, w, h, t, cy) {
    const key = pet.species, col = PET_COL[key], s = pet.status || {state: 'pending'}, act = actionFor(pet, cy && cy.phase);
    ACTS.push([pet.name, act]);
    const bad = s.state === 'glitch' || s.state === 'error', big = h >= 100, sc = big ? 2 : 1;
    box(x, y, w, h, WALL[key], P.void, '#000');
    for (let yy = y + 5; yy < y + h - 12; yy += 8) for (let xx = x + 4 + (((yy - y) / 8 | 0) % 2) * 4; xx < x + w - 4; xx += 8) PX(xx, yy, 'rgba(255,255,255,0.07)');
    if (cy) tintRoom(cy.phase, x, y, w, h, t, pet.id);
    R(x + 1, y + h - 9, w - 2, 8, '#1f2233'); R(x + 1, y + h - 9, w - 2, 1, P.slate);
    const sx = x + (w - 32 * sc) / 2, sy = y + h - 9 - 32 * sc + (big ? 6 : 6) + (act === 'sleep' ? 2 : 0);
    spr(key, act, t, sx, sy, {scale: sc});
    if (act === 'sleep' && s.state === 'online') { const k = Math.floor(t * 1.5) % 3; T('z', sx + 32 * sc - 6 + k * 2, sy + 2 - k * 4, k === 2 ? P.slate : P.gray); }
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
      const tk = pet.tasks || {};
      // derecha: entregas sin ver > encomiendas en cola > latencia
      const right = tk.unseen ? '★' + tk.unseen : (tk.queued ? 'COLA ' + tk.queued : (s.latency_ms != null && s.state === 'online' ? s.latency_ms + 'ms' : ''));
      const fit = Math.floor((w - 11 - (right ? TW(right) + 6 : 0)) / 6);
      let lab = s.state === 'pending' ? 'CONECTANDO…' : (act === 'think' ? 'PENSANDO' : (cy ? PHASE_LABEL[cy.phase] : 'EN ESPERA'));
      if (tk.running && act !== 'think') {
        lab = 'TRABAJANDO ' + (cy ? mmss(Math.max(0, cy.serverNow() - tk.running.started_at)) : '');
        if (lab.length > fit) lab = 'TRABAJANDO';
      } else if (act === 'celebrate') lab = 'ENTREGA LISTA';
      T(clip(lab, fit), x + 5, y + 17, s.state === 'pending' ? P.sky : (tk.running ? P.cyan : (act === 'celebrate' ? P.yellow : P.white)));
      if (right) T(right, x + w - 6 - TW(right), y + 17, tk.unseen ? P.yellow : (tk.queued ? P.cyan : P.green));
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

  // fase del ciclo en la cabecera: icono + «NOCHE 23:14»; abre los ajustes del horario
  function cycleChip(cy, x, right, t) {
    const lt = cy.localTime(), space = right - x - 13;
    const txt = TW(cy.label + ' ' + lt) <= space ? cy.label + ' ' + lt : (TW(lt) <= space ? lt : '');
    const w = 12 + (txt ? TW(txt) + 2 : 0), hov = over(x, 0, w, 15);
    if (hov) R(x, 1, w, 13, '#2f3560');
    phaseIcon(cy.phase, x + 2, 3, t);
    const c = cy.configured ? (PHASE[cy.phase].txt || PHASE[cy.phase].col) : (Math.floor(t * 2) % 2 ? P.yellow : P.white);
    if (txt) T(txt, x + 13, 1, c);
    HIT.push({x, y: 0, w, h: 15, fn: onCycle, label: 'btn:cycle'});
  }

  // botón de encomiendas (termina en «right»): paquete + texto (horizontal) + aviso de entregas o cola; devuelve su x
  function tasksBtn(pets, right, portrait, t) {
    const unseen = pets.reduce((a, p) => a + ((p.tasks || {}).unseen || 0), 0);
    const queue = pets.reduce((a, p) => a + ((p.tasks || {}).queued || 0) + ((p.tasks || {}).running ? 1 : 0), 0);
    const badge = unseen ? '★' + unseen : (queue ? String(queue) : ''), label = portrait ? '' : 'ENCOMIENDAS';
    const txt = label + (label && badge ? ' ' : ''), w = 16 + TW(txt + badge), x = right - w, hov = over(x, 1, w, 14);
    box(x, 1, w, 14, hov ? '#2f3560' : '#1a1c2c', unseen && Math.floor(t * 2) % 2 ? P.yellow : (hov ? P.cyan : P.slate));
    parcelIcon(x + 4, 4, P.orange);
    if (txt) T(txt, x + 14, 1, P.white, true);
    if (badge) T(badge, x + 14 + TW(txt), 1, unseen ? P.yellow : P.cyan, true);
    HIT.push({x, y: 1, w, h: 14, fn: onTasks, label: 'btn:tasks'});
    return x;
  }

  function draw(t, st) {
    HIT = []; ACTS = []; const W = gfx.W, H = gfx.H, portrait = H > W, cy = st.cycle;
    R(0, 0, W, H, '#12131f');
    R(0, 0, W, 16, P.void); T('AI COUNCIL', 5, 1, P.yellow, true);
    // barra de avance de la fase actual del ciclo día/noche
    R(0, 15, W, 1, cy ? P.dark : P.slate);
    if (cy) R(0, 15, Math.round(W * cy.progress()), 1, PHASE[cy.phase].col);
    const pets = st.pets || [], cols = portrait ? 2 : 3, rows = portrait ? 3 : 2, per = cols * rows;
    const logH = portrait ? 46 : 40, top = 18, gap = 4;
    const rw = Math.floor((W - 8 - gap * (cols - 1)) / cols), rh = Math.floor((H - top - logH - 6 - gap * (rows - 1)) / rows);
    const slots = pets.length + 1, pages = Math.max(1, Math.ceil(slots / per)); if (page >= pages) page = pages - 1;
    // cabecera: añadir mascota, encomiendas, paginador; luego estado y fase del ciclo con lo que quepa
    const addW = portrait ? 14 : 66;
    btn(portrait ? '+' : '+ MASCOTA', W - 4 - addW, 1, addW, 14, onAdd, 'btn:add');
    const tx = tasksBtn(pets, W - 8 - addW, portrait, t);
    let btnLeft = tx - 2;
    if (pages > 1) {
      const px = tx - 52;
      btn('‹', px, 1, 14, 14, () => { page = (page + pages - 1) % pages; }, 'pg:prev');
      TC((page + 1) + '/' + pages, px + 24, 1, P.gray); btn('›', px + 34, 1, 14, 14, () => { page = (page + 1) % pages; }, 'pg:next');
      btnLeft = px - 2;
    }
    const ok = pets.filter(p => (p.status || {}).state === 'online').length;
    const full = st.offline ? 'LOBBY SIN SEÑAL' : ok + '/' + pets.length + ' EN LÍNEA', short = st.offline ? 'SIN SEÑAL' : ok + '/' + pets.length;
    const chipFull = cy ? 15 + TW(cy.label + ' ' + cy.localTime()) : 0;
    const tag = 79 + TW(full) + 5 + chipFull <= btnLeft ? full : short;
    T(tag, 5 + 11 * 6 + 8, 1, st.offline ? P.red : (pets.length && ok === pets.length ? P.green : P.gray));
    if (cy) cycleChip(cy, 79 + TW(tag) + 5, btnLeft, t);
    for (let i = 0; i < per; i++) {
      const idx = page * per + i, x = 4 + (i % cols) * (rw + gap), y = top + Math.floor(i / cols) * (rh + gap);
      if (idx < pets.length) room(pets[idx], x, y, rw, rh, t, cy);
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
