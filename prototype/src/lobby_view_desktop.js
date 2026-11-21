/* ---------- cabecera con pestañas ---------- */
const TABS = ['TABLERO', 'CONSEJO', 'ROADMAP', 'MASCOTAS', 'BUSCAR'];
function drawHeader(t) {
  R(0, 0, LW, 16, P.void); R(0, 15, LW, 1, P.slate);
  T('AI COUNCIL', 5, 1, P.yellow, true);
  let x = 70;
  TABS.forEach((n, i) => {
    const w = TW(n) + 8; btn(n, x, 1, w, 14, () => { APP.tab = i; }, {on: APP.tab === i, bold: true, id: 'tab:' + i});
    const dot = (i === 1 && APP.phase === 'plan' && APP.qs === 'ask' && APP.tab !== 1) || (i === 2 && APP.phase === 'review' && APP.tab !== 2) || (i === 4 && SO && APP.tab !== 4);
    if (dot && Math.floor(t * 3) % 2) R(x + w - 4, 0, 4, 4, P.red);
    x += w + 2;
  });
  const ph = {plan: ['PLAN', P.cyan], review: ['REVISAR', P.yellow], work: ['TRABAJO', P.green], done: ['LISTO', P.lime]}[APP.phase];
  box(334, 2, 46, 12, P.void, ph[1]); TC(ph[0], 357, 1, ph[1], true);
}

/* ---------- 1 · TABLERO ---------- */
function room(k, i, t) {
  const rx = 8 + (i % 3) * 124, ry = 18 + Math.floor(i / 3) * 74, rw = 120, rh = 70;
  const act = petAct(k, t), pet = PET[k], bad = act === 'glitch' || act === 'error', tk = taskOf(k);
  box(rx, ry, rw, rh, WALL[k], P.void, '#000');
  for (let yy = ry + 5; yy < ry + rh - 12; yy += 8) for (let xx = rx + 4 + (((yy - ry) / 8 | 0) % 2) * 4; xx < rx + rw - 4; xx += 8) PX(xx, yy, 'rgba(255,255,255,0.07)');
  R(rx + 1, ry + rh - 9, rw - 2, 8, '#1f2233'); R(rx + 1, ry + rh - 9, rw - 2, 1, P.slate);
  furniture(k, rx, ry, t);
  let px = rx + 44, flip = false;
  if (act === 'walk') { const w = Math.sin(t * 0.9); px += w * 18; flip = Math.cos(t * 0.9) < 0; }
  const py = ry + 34;
  if (k === 'armino') spr(k, 'idle', t, px, py, {tint: '#3a4060', frame: 0}); else spr(k, act, t, px, py, {flip});
  const searching = SO && SO.who === k; if (searching) magnifier(px + 26, py + 2);
  if (!bad) {
    box(rx + 3, ry + 3, TW(pet.name) + 7, 12, P.void, pet.col); T(pet.name, rx + 6, ry + 3, pet.col, true);
    const host = k === 'armino' ? 'SIN NODO' : pet.host; T(host, rx + rw - 6 - TW(host), ry + 3, P.gray);
    let lab = searching ? 'BUSCANDO EN LA WEB' : (tk ? tk.id + ' ' + tk.title : ACT_LABEL[act]);
    if (act === 'celebrate' && APP.phase !== 'plan') lab = '¡TAREA LISTA!';
    T(lab.slice(0, 19), rx + 5, ry + 16, searching ? P.yellow : (act === 'locked' ? P.gray : P.white));
  } else {
    const e = ERRS[act], c = act === 'glitch' ? P.red : P.orange;
    box(rx + 3, ry + 2, rw - 6, 34, '#240a14', c); T(pet.name + ' ' + e[0], rx + 7, ry + 3, c, true);
    T(e[1], rx + 7, ry + 14, P.white); T(e[2] + e[3], rx + 7, ry + 24, P.yellow);
    if (Math.floor(t * 2) % 2) R(rx + rw - 12, ry + 6, 5, 5, c);
    if (act === 'glitch') { tear(rx + 1, ry + 38, rw - 2, rh - 39, t, 6); tear(rx + 3, ry + 2, rw - 6, 34, t, 2); scan(rx + 1, ry + 38, rw - 2, rh - 39, 0.18); }
  }
  R(rx + 6, ry + rh - 6, 40, 3, '#0e0f1a');
  if (tk) R(rx + 6, ry + rh - 6, Math.round(40 * tk.p), 3, pet.col);
  else R(rx + 6, ry + rh - 6, Math.round(40 * pet.en / 100), 3, bad ? P.red : P.slate);
  if (k !== 'armino') hot(rx, ry, rw, rh, () => cycleForce(k), 'room:' + k);
}
function drawTablero(t) {
  R(0, 16, LW, LH - 16, '#12131f');
  KEYS.forEach((k, i) => room(k, i, t));
  const y0 = 168; R(0, y0, LW, 48, P.void); R(0, y0, LW, 1, P.slate);
  R(8, 197, 58, 17, '#7a4a2a'); R(8, 197, 58, 2, '#a06a3a'); box(14, 171, 46, 26, P.ink, P.slate);
  KEYS.forEach((k, i) => R(18 + (i % 3) * 13, 175 + Math.floor(i / 3) * 10, 9, 7, ledColor(petAct(k, t))));
  TC('LOBBY', 37, 199, P.white, true);
  box(72, 171, 228, 41, '#16172a', P.slate);
  const last = LOG.slice(-3);
  last.forEach((m, l) => {
    const line = nm(m.who).toLowerCase() + '> ' + m.msg, fresh = l === last.length - 1;
    const shown = fresh ? line.slice(0, Math.floor((NOW - m.t) * 40) + 1) : line;
    T(shown.slice(0, 36), 78, 174 + l * 12, fresh ? colOf(m.who) : 'rgba(180,190,210,0.55)');
  });
  box(306, 171, 74, 41, '#16172a', P.slate);
  const dc = doneCount(); T('ROADMAP', 311, 172, P.gray);
  R(311, 186, 64, 6, P.void); R(311, 186, APP.phase === 'plan' || APP.phase === 'review' ? 0 : Math.round(64 * dc / 8), 6, P.green);
  T(APP.phase === 'plan' ? 'planificando' : (APP.phase === 'review' ? 'por aprobar' : dc + '/8 listas'), 311, 192, P.white);
  KEYS.forEach((k, i) => { const a = petAct(k, t); R(311 + i * 10, 205, 6, 5, ledColor(a)); });
}

/* ---------- 2 · CONSEJO ---------- */
function drawConsejo(t) {
  R(0, 16, LW, LH - 16, '#2b2540');
  for (let x = 0; x < LW; x += 24) { R(x, 17, 1, 130, '#241f36'); R(x + 1, 17, 1, 130, '#322b4a'); }
  R(0, 152, LW, 64, '#1c1830'); R(0, 17, 8, 135, '#181428'); R(LW - 8, 17, 8, 135, '#181428');
  // tema y etapas
  box(8, 18, 368, 14, P.void, P.cyan); box(12, 20, 12, 10, P.ink, P.slate); R(15, 22, 6, 4, P.cyan);
  T('PLAN:', 30, 18, P.cyan, true);
  T((BRIEF.goal ? BRIEF.goal + ' · ' : '') + 'proyecto semanal', 66, 18, P.white);
  let stage = 0, who = 'lobby', text = '', sub = null;
  const q = QS[APP.q];
  if (APP.phase !== 'plan') { stage = 3; who = 'lobby'; text = 'Plan aprobado. Revisa el ROADMAP y dime si empezamos.'; }
  else if (APP.qs === 'ask') { who = q.who; text = q.text; if (isBad(who)) { sub = who; who = isBad('panda_rojo') ? 'lobby' : 'panda_rojo'; text = '(por ' + PET[sub].name + ') ' + q.text; } }
  else if (APP.qs === 'react') { who = APP.react[0]; text = APP.react[1]; }
  else if (APP.qs === 'search') { who = SO ? SO.who : 'buho'; text = 'Buscando en la web…'; }
  else { stage = 1 + APP.stage; const L = STG()[Math.min(APP.stage, 2)]; who = L[0]; text = L[1]; }
  let sx = 8;
  STAGES.forEach((s, i) => {
    const w = TW(s) + 8, on = i === stage, done = i < stage;
    box(sx, 34, w, 13, on ? P.yellow : (done ? '#2a5a3a' : '#1a1c2c'), on ? P.white : (done ? P.green : P.slate));
    T(s, sx + 4, 34, on ? P.void : (done ? P.lime : P.slate), on); sx += w + 4;
  });
  if (APP.phase === 'plan' && stage === 0) T('pregunta ' + Math.min(APP.q + 1, 4) + '/4', 262, 34, P.gray);
  // globo
  const n = Math.floor((NOW - APP.lt0) * 42), full = wrap(text, 60), lines = wrap(text.slice(0, Math.max(0, n)), 60);
  box(8, 50, 368, 17 + 11 * full.length, '#f4f4f4', P.void, '#000');
  T(nm(who) + ':', 12, 51, who === 'lobby' ? '#1a6a80' : '#1a1c2c', true);
  lines.forEach((ln, j) => T(ln, 12, 63 + j * 11, P.ink));
  const si = KEYS.indexOf(who), cx = i => 32 + i * 64;
  if (si >= 0) { const c = cx(si), by = 50 + 17 + 11 * full.length; for (let r = 0; r < 5; r++) R(c - 5 + r, by + r, 10 - r * 2, 1, '#f4f4f4'); R(c - 26, 92, 52, 26, '#3a3360'); dither(c - 28, 92, 2, 26, '#3a3360'); dither(c + 26, 92, 2, 26, '#3a3360', 1); }
  KEYS.forEach((k, i) => {
    const c = cx(i); let act = petAct(k, t), o = {};
    if (k === who) act = 'walk'; else if (!['glitch', 'error', 'sleep', 'locked'].includes(act)) act = 'idle';
    if (k === 'armino') { act = 'idle'; o = {tint: '#3a4060', frame: 0}; }
    spr(k, act, t, c - 16, 96, o);
    if (act === 'glitch') tear(c - 24, 96, 48, 24, t, 4);
    R(c - 30, 118, 60, 20, k === 'armino' ? '#2a2438' : '#7a4a2a'); R(c - 30, 118, 60, 3, k === 'armino' ? '#3a3350' : '#a06a3a'); R(c - 30, 135, 60, 3, '#3a2412');
    TC(PET[k].name, c, 121, k === 'armino' ? P.slate : PET[k].col, true);
    let tag = 'ESCUCHA', tc = P.slate;
    if (k === who && APP.phase === 'plan') { tag = APP.qs === 'ask' ? 'PREGUNTA' : 'HABLA'; tc = P.yellow; }
    if (isBad(k)) { tag = 'SIN SEÑAL'; tc = (Math.floor(t * 3) % 2) ? P.red : '#7a2030'; }
    else if (k === 'kakapo') { tag = 'Zzz'; tc = P.sky; } else if (k === 'armino') { tag = 'NVL 5'; }
    box(c - 28, 140, 56, 12, '#16172a', P.slate); TC(tag, c, 139, tc, true);
  });
  // caja inferior: opciones o estado
  box(8, 154, 368, 60, '#12131f', P.slate);
  if (APP.phase === 'plan' && APP.qs === 'ask') {
    if (APP.typing) {
      T('Escribe tu respuesta:', 16, 158, P.gray); box(14, 172, 232, 16, P.void, P.yellow);
      T(APP.typing.buf + (Math.floor(t * 2) % 2 ? '_' : ' '), 19, 173, P.white);
      T('Enter envía · Esc cancela', 16, 192, P.slate);
    } else {
      q.opts.forEach((o, i) => btn((i + 1) + '  ' + o[0], 14, 158 + i * 14, 232, 13, () => answerQ(o), {left: true, bold: false, id: 'opt:' + i}));
      btn('4  Escribir otra respuesta…', 14, 158 + 3 * 14, 232, 13, () => { APP.typing = {buf: ''}; }, {left: true, bold: false, col: P.cyan, id: 'opt:4'});
    }
  } else if (APP.phase === 'plan') {
    T(APP.qs === 'search' ? 'el Búho está buscando…' : 'el Consejo está pensando…', 16, 160, P.slate);
    R(16, 178, 232, 6, P.void); R(16, 178, Math.round(232 * (((NOW * 0.5) % 1))), 6, P.cyan);
  } else {
    T('Planificación cerrada.', 16, 160, P.lime, true);
    btn('VER ROADMAP ▶', 14, 178, 120, 14, () => { APP.tab = 2; }, {bold: true, on: APP.phase === 'review'});
    btn('NUEVO PROYECTO', 140, 178, 108, 14, resetDemo, {bold: false});
  }
  box(254, 158, 118, 52, '#16172a', P.slate);
  const rows = [['meta', BRIEF.goal], ['tema', BRIEF.topic], ['estilo', BRIEF.theme], ['tiempo', BRIEF.time]];
  rows.forEach((r, i) => { const v = r[1] ? (r[0] + ': ' + r[1]) : (r[0] + ': ?'); T(v.slice(0, 18), 259, 159 + i * 12, r[1] ? P.white : P.slate); });
  if (BRIEF.learned.length) T('+' + BRIEF.learned.length + ' de juegos', 316, 197, P.green);
}

/* ---------- 3 · ROADMAP ---------- */
const CX0 = 68, CWD = 74, LY0 = 48, LHT = 37;
function cardRect(tk) { return {x: CX0 + tk.col * 78, y: LY0 + LANES.indexOf(tk.who) * LHT, w: CWD, h: 33}; }
function drawRoadmap(t) {
  R(0, 16, LW, LH - 16, '#14152a'); dither(0, 16, LW, LH - 16, '#181a30');
  T('ROADMAP', 8, 18, P.yellow, true);
  const title = APP.phase === 'plan' ? 'esperando al Consejo…' : 'Newsletter #1 · ' + (BRIEF.topic || 'IA local');
  T(title, 62, 18, P.white);
  if (APP.phase === 'done') T('✓ ENTREGADO', 300, 18, P.lime, true);
  COLN.forEach((c, i) => { R(CX0 + i * 78, 33, CWD, 12, '#232850'); TC(c, CX0 + i * 78 + CWD / 2, 32, P.sky, true); });
  LANES.forEach((k, i) => {
    const y = LY0 + i * LHT; R(6, y, LW - 12, 33, i % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)');
    face(k, 26, y, t, petAct(k, t)); TC(PET[k].name, 36, y + 20, PET[k].col, true);
  });
  if (APP.phase === 'plan') {
    box(80, 90, 224, 50, P.void, P.cyan);
    TC('Aún no hay roadmap.', 192, 96, P.white, true); TC('Responde las preguntas del Consejo.', 192, 110, P.gray);
    btn('IR A CONSEJO', 142, 124, 100, 13, () => { APP.tab = 1; }, {bold: true});
  } else {
    TASKS.forEach(tk => tk.deps.forEach(d => {
      const a = cardRect(byId(d)), b = cardRect(tk), x1 = a.x + a.w, y1 = a.y + 17, x2 = b.x, y2 = b.y + 17, xm = x1 + 2;
      const c = byId(d).status === 'done' ? P.green : P.slate;
      R(x1, y1, xm - x1 + 1, 1, c); R(xm, Math.min(y1, y2), 1, Math.abs(y2 - y1) + 1, c); R(xm, y2, x2 - xm, 1, c);
    }));
    let hover = null;
    TASKS.forEach((tk, idx) => {
      const show = APP.phase !== 'review' || (NOW - APP.reveal) > idx * 0.18; if (!show) return;
      const r = cardRect(tk), pet = PET[tk.who];
      const hv = hot(r.x, r.y, r.w, r.h, () => {}, 'card:' + tk.id); if (hv) hover = tk;
      const st = tk.status, pulse = st === 'active' && Math.floor(t * 3) % 2;
      box(r.x, r.y, r.w, r.h, st === 'done' ? '#1c3a2a' : (st === 'active' ? '#2a2e5a' : '#1a1c2c'), st === 'done' ? P.green : (st === 'active' ? (pulse ? P.white : pet.col) : (hv ? P.cyan : P.slate)));
      wrap(tk.title, 11).slice(0, 2).forEach((ln, j) => T(ln, r.x + 4, r.y + 2 + j * 11, st === 'pending' ? P.gray : P.white));
      R(r.x + r.w - 7, r.y + 3, 4, 4, tk.tok <= 250 ? P.lime : P.yellow);
      R(r.x + 4, r.y + r.h - 5, r.w - 8, 2, P.void); R(r.x + 4, r.y + r.h - 5, Math.round((r.w - 8) * tk.p), 2, pet.col);
      if (st === 'done') T('✓', r.x + r.w - 13, r.y + 17, P.lime, true);
      if (st === 'active' && SO && SO.who === tk.who) magnifier(r.x + r.w - 14, r.y + 14);
    }); APP.hover = hover;
  }
  R(6, 198, LW - 12, 16, P.void);
  const hv = APP.hover;
  if (hv) T((hv.id + ' · ' + PET[hv.who].name + ' · ~' + hv.tok + ' tok · ' + (hv.deps.length ? 'espera ' + hv.deps.join(',') : 'sin dependencias')).slice(0, 44), 10, 199, P.cyan);
  else { T('■', 10, 199, P.lime); T('≤250', 18, 199, P.gray); T('■', 48, 199, P.yellow); T('≤400 tok · entra en 2k', 56, 199, P.gray); }
  if (APP.phase === 'review') {
    btn('REGENERAR', 234, 199, 66, 14, () => { APP.reveal = NOW; say('lobby', 'roadmap regenerado'); }, {bold: false});
    btn('APROBAR ▶', 304, 199, 72, 14, () => { APP.phase = 'work'; APP.tab = 0; say('lobby', 'roadmap aprobado · a trabajar'); }, {bold: true, on: true, id: 'APROBAR'});
  } else if (APP.phase === 'work') T(doneCount() + '/8 listas', 304, 199, P.green, true);
  else if (APP.phase === 'done') btn('NUEVO PROYECTO', 280, 199, 98, 14, resetDemo, {bold: true, on: true});
}

/* ---------- 4 · MASCOTAS ---------- */
function bar(x, y, w, v, col, label) {
  T(label, x, y - 3, P.gray); const bx = x + 46; R(bx, y, w, 6, P.void); R(bx + 1, y + 1, Math.round((w - 2) * Math.min(100, v) / 100), 4, col);
  for (let i = 1; i < 10; i++) PX(bx + Math.round(w * i / 10), y + 3, 'rgba(0,0,0,0.35)');
}
function drawMascotas(t) {
  R(0, 16, LW, LH - 16, '#14152a'); dither(0, 16, LW, LH - 16, '#181a30');
  const k = KEYS[APP.sel], pet = PET[k], act = petAct(k, t), bad = act === 'glitch' || act === 'error', locked = k === 'armino';
  box(4, 18, 98, 152, P.void, P.slate); T('NODOS', 10, 19, P.yellow, true); R(8, 33, 90, 1, P.slate);
  KEYS.forEach((kk, i) => {
    const p = PET[kk], a = petAct(kk, t), y = 36 + i * 22, on = i === APP.sel;
    if (on) { R(7, y - 1, 92, 22, '#2a2e5a'); R(7, y - 1, 2, 22, P.yellow); }
    hot(7, y - 1, 92, 22, () => { APP.sel = i; APP.br = 0; }, 'pet:' + kk);
    face(kk, 21, y, t, a); T(p.name, 46, y - 1, on ? P.white : p.col, true); T(kk === 'armino' ? 'LV --' : 'LV ' + p.lv, 46, y + 9, P.gray);
    R(91, y + 4, 6, 6, ledColor(a)); if ((a === 'glitch' || a === 'error') && Math.floor(t * 4) % 2) R(91, y + 4, 6, 6, P.void);
  });
  // visor
  box(104, 18, 152, 94, P.void, P.slate); g.save(); g.beginPath(); g.rect(106, 20, 148, 90); g.clip();
  R(106, 20, 148, 90, bad ? '#2a0e1a' : '#2a2e5a'); for (let yy = 0; yy < 90; yy += 6) dither(106, 20 + yy, 148, 3, bad ? '#33121f' : '#33386a', (yy / 6) | 0);
  R(106, 82, 148, 28, bad ? '#1a0a12' : '#1d2046'); R(106, 82, 148, 2, bad ? P.red : P.slate);
  const px = 180 - 32, py = 20 + 62 - 2 * 30 + 0;
  R(158, 84, 44, 3, 'rgba(0,0,0,0.35)');
  if (locked) spr(k, 'idle', t, px, py + 0, {tint: '#3a4060', frame: 0, scale: 2}); else spr(k, act, t, px, py, {scale: 2});
  APP.fx.filter(f => f.pet === k).forEach(f => { const age = NOW - f.t; if (age < 1.6) T('♥', f.x, 70 - age * 24, P.red, true); });
  g.restore(); if (bad) { tear(106, 20, 148, 90, t, 8); scan(106, 20, 148, 90, 0.2); }
  box(108, 22, TW(pet.name) + 10, 13, P.void, pet.col); T(pet.name, 113, 22, pet.col, true);
  const tk = taskOf(k), lab = SO && SO.who === k ? 'BUSCANDO EN LA WEB' : (tk ? tk.id + ' ' + tk.title : ACT_LABEL[act]);
  T(lab.slice(0, 24), 110, 98, bad ? P.red : P.white);
  // cuidado
  box(104, 114, 152, 56, P.void, P.slate);
  if (locked) T('— sin datos —', 110, 134, P.slate);
  else { bar(110, 123, 84, pet.en, P.sky, 'ENERGÍA'); bar(110, 135, 84, bad ? 12 : pet.mood, bad ? P.red : P.green, 'ÁNIMO'); bar(110, 147, 84, pet.xp, P.yellow, 'XP'); bar(110, 159, 84, pet.know * 2.5, P.cyan, 'CONOCE'); T('' + pet.know, 236, 156, P.gray); }
  // panel derecho
  box(260, 18, 120, 152, P.void, bad ? P.red : P.slate);
  if (bad) {
    const e = ERRS[act]; T('!! ERROR', 266, 19, P.red, true); R(264, 33, 112, 1, P.red);
    T(e[0], 266, 36, P.white); T(e[1], 266, 48, P.yellow); T(e[2] + e[3], 266, 60, P.yellow);
    T('latido: hace 94 s', 266, 80, P.gray); T('reintento en ' + Math.max(0, 30 - Math.floor(t % 31)) + ' s', 266, 92, P.cyan);
    T('host: ' + pet.host, 266, 112, P.white); T('Un nodo caído no', 266, 130, P.slate); T('se puede entrenar.', 266, 141, P.slate);
  } else if (locked) {
    T('BLOQUEADO', 266, 19, P.slate, true); R(264, 33, 112, 1, P.slate); T('Sube el Consejo a', 266, 40, P.gray); T('nivel 5 para', 266, 52, P.gray); T('invitarlo.', 266, 64, P.gray);
    R(308, 92, 20, 15, P.yellow); R(311, 82, 14, 12, P.yellow); R(314, 85, 8, 10, '#14152a');
  } else if (APP.panel === 'datos') {
    T('DATOS', 266, 19, P.yellow, true); R(264, 33, 112, 1, P.slate);
    [['ROL', pet.role], ['HOST', pet.host], ['MODELO', pet.model], ['RED', pet.ip + '.ts'], ['VEL', pet.tps + ' tok/s'], ['TEMP/RAM', pet.temp + '°C · ' + pet.ram + '%']].forEach((r, i) => { T(r[0], 266, 34 + i * 22, P.gray); T(r[1], 266, 44 + i * 22, i === 0 ? pet.col : P.white, i === 0); });
  } else {
    T('RAMAS', 266, 19, P.yellow, true); T('PTS ' + PTS[k], 376 - TW('PTS ' + PTS[k]) - 2, 19, PTS[k] ? P.cyan : P.slate, true); R(264, 33, 112, 1, P.slate);
    BR[k].forEach((b, i) => {
      const y = 37 + i * 29; const sel = APP.br === i;
      if (sel) R(263, y - 2, 114, 27, '#1d2046');
      hot(263, y - 2, 94, 27, () => { APP.br = i; }, 'branch:' + i);
      T(b[0], 266, y - 1, sel ? P.white : P.gray, sel);
      for (let s = 0; s < 5; s++) { R(266 + s * 15, y + 12, 13, 7, s < b[1] ? pet.col : P.dark); if (s < b[1]) R(266 + s * 15, y + 12, 13, 2, 'rgba(255,255,255,0.25)'); }
      btn('+', 358, y + 8, 15, 15, () => { if (PTS[k] > 0 && b[1] < 5) { PTS[k]--; b[1]++; APP.fx.push({pet: k, t: NOW, x: 176}); say(k, 'subió ' + b[0].toLowerCase() + ' a nivel ' + b[1]); } }, {disabled: !(PTS[k] > 0 && b[1] < 5), id: 'plus:' + i});
    });
    const eff = BR[k][APP.br]; T('Efecto:', 266, 126, P.sky); wrap(eff[2], 18).slice(0, 2).forEach((ln, j) => T(ln, 266, 138 + j * 11, P.white));
  }
  // dialogo y menu
  box(4, 174, 376, 40, P.void, P.white);
  const talk = SAY[k], shown = bad ? corrupt('ECONNREFUSED · no puedo hablar ahora… reintentando', t, 0.12) : talk;
  const n = Math.min(shown.length, Math.floor((t * 30) % (shown.length + 50)));
  T(pet.name + ':', 10, 176, pet.col, true); wrap(shown.slice(0, n), 42).forEach((ln, i) => T(ln, 10, 188 + i * 11 - 0, bad ? P.red : P.white));
  const off = bad || locked;
  btn('JUGAR', 276, 177, 48, 14, () => { APP.game = {k, r: 0, picks: [], done: false, t0: NOW}; }, {disabled: off, bold: true, id: 'JUGAR'});
  btn('CUIDAR', 328, 177, 48, 14, () => { if (!off) { pet.mood = Math.min(100, pet.mood + 15); pet.en = Math.min(100, pet.en + 10); APP.fx.push({pet: k, t: NOW, x: 176}); APP.fx.push({k, t: NOW}); say(k, 'te lo agradece ♥'); } }, {disabled: off, bold: true, id: 'CUIDAR'});
  btn('RAMAS', 276, 195, 48, 14, () => { APP.panel = 'ramas'; }, {on: APP.panel === 'ramas' && !off, bold: true, disabled: off, id: 'RAMAS'});
  btn('DATOS', 328, 195, 48, 14, () => { APP.panel = 'datos'; }, {on: APP.panel === 'datos' && !off, bold: true, disabled: locked, id: 'DATOS'});
}
function drawGame(t) {
  const G = APP.game, k = G.k, pet = PET[k], pairs = GAMES[k];
  HIT.push({x: 0, y: 0, w: LW, h: LH, fn: () => {}, label: 'game-block'});
  R(0, 16, LW, LH - 16, 'rgba(8,8,20,0.78)'); box(52, 30, 280, 150, P.void, pet.col);
  T('JUEGO · ' + pet.name + ' quiere conocerte', 60, 33, pet.col, true);
  btn('X', 316, 32, 14, 13, () => { APP.game = null; }, {id: 'game-close'});
  if (!G.done) {
    T('Elige uno · ronda ' + (G.r + 1) + '/3', 60, 47, P.gray);
    pairs[G.r].forEach((opt, i) => {
      const x = 64 + i * 130, y = 64, w = 126, h = 62;
      const hv = btn('', x, y, w, h, () => {
        G.picks.push(opt); if (/^Tema/.test(opt)) BRIEF.theme = /oscuro/.test(opt) ? 'oscuro' : 'claro';
        if (opt === 'IA local' || opt === 'Robótica') BRIEF.topic = opt;
        G.r++; G.t1 = NOW; if (G.r >= 3) { G.done = true; pet.xp = Math.min(100, pet.xp + 15); pet.know = Math.min(40, pet.know + 3); PTS[k]++; BRIEF.learned.push(...G.picks.map(p => pet.name + ': ' + p)); APP.fx.push({k, t: NOW}); say(k, 'aprendió: ' + G.picks.join(', ').toLowerCase()); }
      }, {id: 'game-opt:' + i});
      wrap(opt, 16).slice(0, 2).forEach((ln, j) => TC(ln, x + w / 2, y + 18 + j * 12, hv ? P.yellow : P.white, true));
      for (let d = 0; d < 3; d++) R(x + w / 2 - 12 + d * 10, y + h - 12, 6, 6, d === G.r ? pet.col : P.dark);
    });
    spr(k, (NOW - (G.t1 || 0)) < 0.9 ? 'celebrate' : 'idle', t, 150, 138, {});
  } else {
    T('¡Gracias! ' + pet.name + ' aprendió:', 60, 50, P.white, true);
    G.picks.forEach((p, i) => T('· ' + p, 66, 66 + i * 12, P.lime));
    T('+15 XP · +1 PUNTO para ramas', 60, 108, P.cyan, true); T('Lo que aprendió ayuda al Consejo a planificar.', 60, 122, P.gray);
    spr(k, 'celebrate', t, 150, 138, {});
    btn('LISTO', 270, 154, 54, 14, () => { APP.game = null; }, {on: true, bold: true, id: 'game-done'});
  }
}

/* ---------- 5 · BUSCAR ---------- */
function drawBuscar(t) {
  R(0, 16, LW, LH - 16, '#14152a'); dither(0, 16, LW, LH - 16, '#181a30');
  T('BUSCADOR', 8, 18, P.yellow, true); T('· para cuando el contexto no alcanza', 62, 18, P.gray);
  const nodes = [['MASCOTA', 'no sabe', P.orange], ['FILTRO', 'limpia', P.red], ['BUSCADOR', 'busca', P.sky], ['RESUMEN', 'resume', P.lime], ['MASCOTA', 'responde', P.orange]];
  nodes.forEach((n, i) => {
    const x = 8 + i * 75, y = 36; box(x, y, 62, 26, P.void, n[2]); TC(n[0], x + 31, y + 1, n[2], true); TC(n[1], x + 31, y + 13, P.gray);
    if (i < 4) { R(x + 62, y + 12, 13, 1, P.slate); R(x + 69, y + 10, 1, 5, P.slate); R(x + 70, y + 11, 1, 3, P.slate); R(x + 71, y + 12, 1, 1, P.slate); }
  });
  if (SO) { const u = ((NOW - SO.t0) * SPEED) / SO.te, pos = 8 + u * 5 * 75 * 0.92; R(Math.min(370, pos), 63, 5, 5, P.yellow); T('buscando…', 8, 70, P.yellow, true); }
  box(8, 84, 244, 128, P.void, P.slate); T('HISTORIAL', 14, 85, P.yellow, true); R(12, 99, 236, 1, P.slate);
  HIST.slice(0, 8).forEach((h, i) => {
    const y = 102 + i * 13, line = h.t + ' ' + PET[h.who].ini + ' ' + h.q;
    T(line.slice(0, 31), 14, y, h.ok ? P.white : P.yellow); T(h.ok ? (h.cache ? 'cache' : '✓') : '…', 210, y, h.ok ? (h.cache ? P.sky : P.lime) : P.yellow);
  });
  box(258, 84, 118, 128, P.void, P.slate); T('REGLAS', 264, 85, P.yellow, true); R(262, 99, 110, 1, P.slate);
  T('cuota de hoy', 264, 102, P.gray); R(264, 114, 104, 6, P.dark); R(264, 114, Math.round(104 * HIST.length / 30), 6, P.sky); T(HIST.length + '/30', 264, 121, P.white);
  T('FILTRO PHI', 264, 138, P.red, true); T('bloquea datos de', 264, 149, P.gray); T('pacientes/correos', 264, 160, P.gray);
  T('SIN TU NOMBRE', 264, 172, P.cyan, true); T('en la consulta', 264, 183, P.gray);
  T('máx 2 por tarea', 264, 196, P.slate);
}

/* ---------- overlay de busqueda ---------- */
function drawSearch(t) {
  const S = SO, u = (NOW - S.t0) * SPEED, pet = PET[S.who];
  HIT.push({x: 0, y: 0, w: LW, h: LH, fn: () => { if (u < S.ta) S.t0 = NOW - (S.ta + 0.01) / SPEED; else S.t0 = NOW - (S.te + 0.01) / SPEED; }, label: 'search-skip'});
  R(0, 16, LW, LH - 16, 'rgba(8,8,20,0.72)'); box(28, 28, 328, 158, P.void, P.yellow);
  spr(S.who, 'think', t, 36, 44, {}); magnifier(66, 44);
  T(pet.name + ': no tengo contexto', 78, 31, pet.col, true); T('para esto. Busco en la web.', 78, 42, P.white);
  box(78, 56, 270, 16, P.ink, P.slate); T('›', 82, 57, P.yellow, true);
  T(S.q.slice(0, Math.max(0, Math.min(S.q.length, Math.floor(u * 28)))).slice(0, 38), 92, 57, P.white);
  if (u >= S.tq && u < S.tc) T('consultando' + '.'.repeat(1 + Math.floor(u * 3) % 3), 36, 84, P.yellow);
  if (u >= S.tc) S.results.forEach((r, i) => { if (u >= S.tc + i * 0.5) { T(r[0].slice(0, 16), 36, 78 + i * 12, P.cyan); T(r[1].slice(0, 34), 36 + 100, 78 + i * 12, P.gray); } });
  if (u >= S.tr) {
    R(34, 118, 316, 1, P.slate); T('Respuesta:', 36, 121, P.lime, true);
    const n = Math.floor((u - S.ta) * 32); wrap(S.answer.slice(0, Math.max(0, n)), 50).forEach((ln, i) => T(ln, 36, 133 + i * 11, P.white));
    if (n >= S.answer.length) { box(36, 158, 150, 13, '#1c3a2a', P.green); T('fuente: ' + S.src, 41, 158, P.lime, true); }
  }
  T('filtrado por el lobby · clic para saltar', 36, 171, P.slate);
}

/* ---------- bucle principal ---------- */
function draw(t) {
  NOW = t; const dt = Math.min(0.1, t - LASTT); LASTT = t; HIT = [];
  update(dt);
  [drawTablero, drawConsejo, drawRoadmap, drawMascotas, drawBuscar][APP.tab](t);
  drawHeader(t);
  if (APP.game) drawGame(t);
  if (SO) drawSearch(t);
}
window.addEventListener('keydown', e => {
  if (APP.typing) {
    if (e.key === 'Enter') { const b = APP.typing.buf.trim(); if (b) answerQ([b, b.slice(0, 12)]); }
    else if (e.key === 'Escape') APP.typing = null;
    else if (e.key === 'Backspace') APP.typing.buf = APP.typing.buf.slice(0, -1);
    else if (e.key.length === 1 && APP.typing.buf.length < 36) APP.typing.buf += e.key;
    e.preventDefault(); return;
  }
  if (e.key >= '1' && e.key <= '5') APP.tab = +e.key - 1;
  if (e.key === 'Escape') { APP.game = null; }
});
boot(draw);
