/* ===== VISTA VERTICAL (celular) · lienzo logico 216x384 ===== */
const NAV_Y = 357;
const TABS = ['TABLERO', 'CONSEJO', 'ROADMAP', 'MASC.', 'BUSCAR'];
const TI = document.getElementById('ti');
function startTyping() { APP.typing = {buf: ''}; TI.value = ''; TI.focus(); }
function stopTyping() { APP.typing = null; TI.blur(); }
TI.addEventListener('input', () => { if (APP.typing) APP.typing.buf = TI.value.slice(0, 36); });
TI.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sendTyping(); } });
function sendTyping() { if (APP.typing) { const b = APP.typing.buf.trim(); if (b) { answerQ([b, b.slice(0, 12)]); TI.blur(); } } }

function drawHeader(t) {
  R(0, 0, LW, 16, P.void); R(0, 15, LW, 1, P.slate); T('AI COUNCIL', 5, 1, P.yellow, true);
  const ph = {plan: ['PLAN', P.cyan], review: ['REVISAR', P.yellow], work: ['TRABAJO', P.green], done: ['LISTO', P.lime]}[APP.phase];
  box(LW - 52, 2, 48, 12, P.void, ph[1]); TC(ph[0], LW - 28, 1, ph[1], true);
  R(0, NAV_Y - 1, LW, LH - NAV_Y + 1, P.void); R(0, NAV_Y - 1, LW, 1, P.slate);
  TABS.forEach((n, i) => {
    const x = Math.round(i * LW / 5), w = Math.round((i + 1) * LW / 5) - x, on = APP.tab === i;
    if (on) { R(x, NAV_Y, w, 2, P.yellow); R(x, NAV_Y + 2, w, LH - NAV_Y - 2, '#1d2046'); }
    hot(x, NAV_Y, w, LH - NAV_Y, () => { APP.tab = i; }, 'tab:' + i);
    TC(n, x + w / 2, NAV_Y + 8, on ? P.yellow : P.gray, on);
    if (i > 0) R(x, NAV_Y + 3, 1, LH - NAV_Y - 6, P.dark);
    const dot = (i === 1 && APP.phase === 'plan' && APP.qs === 'ask' && APP.tab !== 1) || (i === 2 && APP.phase === 'review' && APP.tab !== 2) || (i === 4 && SO && APP.tab !== 4);
    if (dot && Math.floor(t * 3) % 2) R(x + w - 6, NAV_Y + 3, 4, 4, P.red);
  });
}

/* ---------- 1 · TABLERO ---------- */
function drawTablero(t) {
  R(0, 16, LW, NAV_Y - 17, '#12131f');
  KEYS.forEach((k, i) => {
    const x = 4, y = 19 + i * 48, w = 208, h = 45, act = petAct(k, t), pet = PET[k], bad = act === 'glitch' || act === 'error', tk = taskOf(k);
    const bd = bad ? (act === 'glitch' ? P.red : P.orange) : P.slate;
    box(x, y, w, h, bad ? '#240a14' : '#1a1c2c', bd); R(x + 1, y + 1, 3, h - 2, bad ? bd : pet.col);
    R(x + 6, y + 36, 30, 3, 'rgba(0,0,0,0.35)');
    let px = x + 6, flip = false;
    if (act === 'walk') { px += Math.sin(t * 0.9) * 2; flip = Math.cos(t * 0.9) < 0; }
    if (k === 'armino') spr(k, 'idle', t, px, y + 7, {tint: '#3a4060', frame: 0}); else spr(k, act, t, px, y + 7, {flip});
    if (SO && SO.who === k) magnifier(x + 32, y + 8);
    if (bad) {
      const e = ERRS[act];
      T(pet.name + ' ' + e[0], x + 42, y + 3, bd, true); T(e[1], x + 42, y + 16, P.white); T(e[2] + e[3], x + 42, y + 29, P.yellow);
      if (act === 'glitch') { tear(x + 4, y + 4, 36, h - 8, t, 4); }
      if (Math.floor(t * 2) % 2) R(x + w - 9, y + 5, 5, 5, bd);
    } else {
      T(pet.name, x + 42, y + 3, pet.col, true);
      const host = k === 'armino' ? 'SIN NODO' : pet.host; T(host, x + w - 6 - TW(host), y + 3, P.gray);
      let lab = SO && SO.who === k ? 'BUSCANDO EN LA WEB' : (tk ? tk.id + ' ' + tk.title : ACT_LABEL[act]);
      if (act === 'celebrate' && APP.phase !== 'plan') lab = '¡TAREA LISTA!';
      T(lab.slice(0, 27), x + 42, y + 16, SO && SO.who === k ? P.yellow : (act === 'locked' ? P.gray : P.white));
      R(x + 42, y + 33, 120, 5, P.void);
      if (tk) R(x + 42, y + 33, Math.round(120 * tk.p), 5, pet.col); else R(x + 42, y + 33, Math.round(120 * pet.en / 100), 5, P.dark);
      R(x + w - 14, y + 32, 7, 7, ledColor(act));
    }
    if (k !== 'armino') hot(x, y, w, h, () => cycleForce(k), 'room:' + k);
  });
  box(4, 309, 208, 46, '#16172a', P.slate);
  const last = LOG.slice(-3);
  last.forEach((m, l) => {
    const line = nm(m.who).toLowerCase() + '> ' + m.msg, fresh = l === last.length - 1;
    T((fresh ? line.slice(0, Math.floor((NOW - m.t) * 40) + 1) : line).slice(0, 33), 9, 311 + l * 11, fresh ? colOf(m.who) : 'rgba(180,190,210,0.55)');
  });
  R(9, 347, 198, 4, P.void); R(9, 347, APP.phase === 'plan' || APP.phase === 'review' ? 0 : Math.round(198 * doneCount() / 8), 4, P.green);
}

/* ---------- 2 · CONSEJO ---------- */
function drawConsejo(t) {
  R(0, 16, LW, NAV_Y - 17, '#2b2540');
  for (let x = 0; x < LW; x += 24) { R(x, 17, 1, 340, '#241f36'); R(x + 1, 17, 1, 340, '#322b4a'); }
  const S = consejoState(), who = S.who, stage = S.stage;
  box(4, 18, 208, 14, P.void, P.cyan); T(('PLAN: ' + (BRIEF.goal ? BRIEF.goal + ' · ' : '') + 'proyecto semanal').slice(0, 33), 9, 18, P.white);
  T('ETAPA ' + (stage + 1) + '/4 ' + STAGES[stage], 6, 36, P.yellow, true);
  for (let i = 0; i < 4; i++) R(178 + i * 9, 39, 7, 6, i < stage ? P.green : (i === stage ? P.yellow : P.dark));
  // foco: quien habla
  const si = KEYS.indexOf(who);
  box(4, 50, 66, 84, '#3a3360', P.void);
  if (si >= 0) {
    let act = petAct(who, t); if (!['glitch', 'error'].includes(act)) act = 'walk'; spr(who, act, t, 6, 56, {scale: 2});
  } else { box(14, 72, 46, 32, P.ink, P.cyan); R(20, 78, 34, 18, P.void); R(26, 86, 22, 2, P.cyan); R(28, 106, 18, 3, P.slate); }
  TC(nm(who), 37, 120, colOf(who), true);
  const n = Math.floor((NOW - APP.lt0) * 42), full = wrap(S.text, 21), lines = wrap(S.text.slice(0, Math.max(0, n)), 21);
  const bh = 16 + 11 * Math.max(full.length, 1);
  box(76, 50, 136, bh, '#f4f4f4', P.void, '#000'); R(72, 80, 5, 1, '#f4f4f4'); R(73, 79, 3, 3, '#f4f4f4');
  T(nm(who) + ':', 80, 51, who === 'lobby' ? '#1a6a80' : '#1a1c2c', true);
  lines.forEach((ln, j) => T(ln, 80, 63 + j * 11, P.ink));
  // caras de todos
  KEYS.forEach((k, i) => {
    const x = 4 + i * 35, a = petAct(k, t), bad = a === 'glitch' || a === 'error';
    box(x, 138, 33, 30, k === who ? '#3a3360' : '#1a1c2c', k === who ? P.yellow : (bad ? P.red : P.slate));
    face(k, x + 5, 140, t, a); R(x + 2, 166, 29, 2, bad ? P.red : (k === who ? P.yellow : (k === 'kakapo' ? P.sky : P.dark)));
  });
  // opciones
  const y0 = 174;
  if (APP.phase === 'plan' && APP.qs === 'ask') {
    const q = QS[APP.q];
    if (APP.typing) {
      T('Escribe tu respuesta:', 6, y0, P.gray); box(4, y0 + 14, 208, 18, P.void, P.yellow);
      const b = APP.typing.buf; T((b.length > 31 ? b.slice(-31) : b) + (Math.floor(t * 2) % 2 ? '_' : ' '), 9, y0 + 15, P.white);
      btn('ENVIAR', 4, y0 + 38, 100, 22, sendTyping, {bold: true, on: true, id: 'ENVIAR'});
      btn('CANCELAR', 112, y0 + 38, 100, 22, stopTyping, {bold: false, id: 'CANCELAR'});
    } else {
      q.opts.forEach((o, i) => btn((i + 1) + '  ' + o[0], 4, y0 + i * 27, 208, 24, () => answerQ(o), {left: true, bold: false, id: 'opt:' + i}));
      btn('4  Escribir otra respuesta…', 4, y0 + 3 * 27, 208, 24, startTyping, {left: true, bold: false, col: P.cyan, id: 'opt:4'});
    }
  } else if (APP.phase === 'plan') {
    T(APP.qs === 'search' ? 'el Búho está buscando…' : 'el Consejo está pensando…', 6, y0 + 4, P.slate);
    R(6, y0 + 22, 204, 6, P.void); R(6, y0 + 22, Math.round(204 * ((NOW * 0.5) % 1)), 6, P.cyan);
  } else {
    T('Planificación cerrada.', 6, y0 + 2, P.lime, true);
    btn('VER ROADMAP ▶', 4, y0 + 20, 208, 24, () => { APP.tab = 2; }, {bold: true, on: APP.phase === 'review'});
    btn('NUEVO PROYECTO', 4, y0 + 48, 208, 24, resetDemo, {bold: false});
  }
  box(4, 282, 208, 70, '#16172a', P.slate); T('LO QUE SÉ DE TI', 9, 284, P.yellow, true);
  [['meta', BRIEF.goal], ['tema', BRIEF.topic], ['estilo', BRIEF.theme], ['tiempo', BRIEF.time]].forEach((r, i) => T((r[0] + ': ' + (r[1] || '?')).slice(0, 33), 9, 297 + i * 11, r[1] ? P.white : P.slate));
  if (BRIEF.learned.length) T('+' + BRIEF.learned.length + ' de juegos', 130, 340, P.green);
}

/* ---------- 3 · ROADMAP ---------- */
function drawRoadmap(t) {
  R(0, 16, LW, NAV_Y - 17, '#14152a'); dither(0, 16, LW, NAV_Y - 17, '#181a30');
  T('ROADMAP', 5, 18, P.yellow, true);
  if (APP.phase === 'done') T('✓ ENTREGADO', 126, 18, P.lime, true);
  else T((APP.phase === 'plan' ? 'esperando…' : (BRIEF.topic || 'IA local')).slice(0, 14), 66, 18, P.white);
  if (APP.phase === 'plan') {
    box(14, 120, 188, 62, P.void, P.cyan); TC('Aún no hay roadmap.', 108, 128, P.white, true); TC('Responde al Consejo.', 108, 142, P.gray);
    btn('IR A CONSEJO', 54, 158, 108, 18, () => { APP.tab = 1; }, {bold: true}); return;
  }
  let y = 34;
  COLN.forEach((c, ci) => {
    R(4, y, 208, 12, '#232850'); TC(c, 108, y - 1, P.sky, true); y += 13;
    TASKS.filter(tk => tk.col === ci).sort((a, b) => LANES.indexOf(a.who) - LANES.indexOf(b.who)).forEach(tk => {
      const idx = TASKS.indexOf(tk), pet = PET[tk.who], st = tk.status, h = 29;
      if (APP.phase === 'review' && (NOW - APP.reveal) <= idx * 0.18) { y += h + 1; return; }
      const pulse = st === 'active' && Math.floor(t * 3) % 2;
      box(4, y, 208, h, st === 'done' ? '#1c3a2a' : (st === 'active' ? '#2a2e5a' : '#1a1c2c'), st === 'done' ? P.green : (st === 'active' ? (pulse ? P.white : pet.col) : P.slate));
      face(tk.who, 8, y + 3, t, petAct(tk.who, t));
      T(tk.title.slice(0, 24), 34, y + 2, st === 'pending' ? P.gray : P.white, st === 'active');
      T((tk.id + ' ' + pet.name + ' ~' + tk.tok + 't' + (tk.deps.length ? ' ←' + tk.deps.join(',') : '')).slice(0, 29), 34, y + 13, P.slate);
      R(34, y + h - 4, 170, 2, P.void); R(34, y + h - 4, Math.round(170 * tk.p), 2, pet.col);
      R(206, y + 3, 4, 4, tk.tok <= 250 ? P.lime : P.yellow);
      if (st === 'done') T('✓', 193, y + 2, P.lime, true);
      if (st === 'active' && SO && SO.who === tk.who) magnifier(180, y + 4);
      y += h + 1;
    });
  });
  if (APP.phase === 'review') {
    btn('REGENERAR', 4, 332, 90, 20, () => { APP.reveal = NOW; say('lobby', 'roadmap regenerado'); }, {bold: false});
    btn('APROBAR ▶', 98, 332, 114, 20, () => { APP.phase = 'work'; APP.tab = 0; say('lobby', 'roadmap aprobado · a trabajar'); }, {bold: true, on: true, id: 'APROBAR'});
  } else if (APP.phase === 'work') { T(doneCount() + '/8 listas · ■ ≤250 ■ ≤400', 6, 336, P.green, true); }
  else btn('NUEVO PROYECTO', 4, 332, 208, 20, resetDemo, {bold: true, on: true});
}

/* ---------- 4 · MASCOTAS ---------- */
function bar(x, y, w, v, col, label) { T(label, x, y - 3, P.gray); const bx = x + 46; R(bx, y, w, 6, P.void); R(bx + 1, y + 1, Math.round((w - 2) * Math.min(100, v) / 100), 4, col); }
function drawMascotas(t) {
  R(0, 16, LW, NAV_Y - 17, '#14152a'); dither(0, 16, LW, NAV_Y - 17, '#181a30');
  const k = KEYS[APP.sel], pet = PET[k], act = petAct(k, t), bad = act === 'glitch' || act === 'error', locked = k === 'armino';
  KEYS.forEach((kk, i) => {
    const x = 4 + i * 35, a = petAct(kk, t), on = i === APP.sel;
    box(x, 18, 33, 30, on ? '#2a2e5a' : P.void, on ? P.yellow : P.slate); face(kk, x + 5, 20, t, a);
    R(x + 2, 46, 29, 2, ledColor(a)); hot(x, 18, 33, 30, () => { APP.sel = i; APP.br = 0; }, 'pet:' + kk);
  });
  box(4, 52, 208, 98, P.void, P.slate); g.save(); g.beginPath(); g.rect(6, 54, 204, 94); g.clip();
  R(6, 54, 204, 94, bad ? '#2a0e1a' : '#2a2e5a'); for (let yy = 0; yy < 94; yy += 6) dither(6, 54 + yy, 204, 3, bad ? '#33121f' : '#33386a', (yy / 6) | 0);
  R(6, 128, 204, 20, bad ? '#1a0a12' : '#1d2046'); R(6, 128, 204, 2, bad ? P.red : P.slate); R(86, 130, 44, 3, 'rgba(0,0,0,0.35)');
  if (locked) spr(k, 'idle', t, 76, 68, {tint: '#3a4060', frame: 0, scale: 2}); else spr(k, act, t, 76, 68, {scale: 2});
  APP.fx.filter(f => f.pet === k).forEach(f => { const age = NOW - f.t; if (age < 1.6) T('♥', 150, 110 - age * 24, P.red, true); });
  g.restore(); if (bad) { tear(6, 54, 204, 94, t, 8); scan(6, 54, 204, 94, 0.2); }
  box(8, 56, TW(pet.name) + 10, 13, P.void, pet.col); T(pet.name, 13, 56, pet.col, true);
  const tk = taskOf(k), lab = SO && SO.who === k ? 'BUSCANDO EN LA WEB' : (tk ? tk.id + ' ' + tk.title : ACT_LABEL[act]);
  T(lab.slice(0, 33), 10, 134, bad ? P.red : P.white);
  box(4, 154, 208, 50, P.void, P.slate);
  if (locked) T('— sin datos —', 10, 172, P.slate);
  else { bar(10, 162, 130, pet.en, P.sky, 'ENERGÍA'); T(pet.en + '', 190, 157, P.gray); bar(10, 172, 130, bad ? 12 : pet.mood, bad ? P.red : P.green, 'ÁNIMO'); bar(10, 182, 130, pet.xp, P.yellow, 'XP'); bar(10, 192, 130, pet.know * 2.5, P.cyan, 'CONOCE'); }
  box(4, 208, 208, 98, P.void, bad ? P.red : P.slate);
  if (bad) {
    const e = ERRS[act]; T('!! ERROR', 10, 210, P.red, true); T(e[0], 10, 224, P.white); T(e[1], 10, 235, P.yellow); T(e[2] + e[3], 10, 246, P.yellow);
    T('latido: hace 94 s', 10, 262, P.gray); T('reintento en ' + Math.max(0, 30 - Math.floor(t % 31)) + ' s', 10, 273, P.cyan); T('Un nodo caído no se entrena.', 10, 290, P.slate);
  } else if (locked) {
    T('BLOQUEADO', 10, 210, P.slate, true); T('Sube el Consejo a nivel 5', 10, 226, P.gray); T('para invitarlo.', 10, 238, P.gray); R(96, 256, 22, 16, P.yellow); R(99, 246, 16, 12, P.yellow); R(102, 249, 10, 10, '#14152a');
  } else {
    btn('RAMAS', 8, 211, 50, 14, () => { APP.panel = 'ramas'; }, {on: APP.panel === 'ramas', bold: true}); btn('DATOS', 62, 211, 50, 14, () => { APP.panel = 'datos'; }, {on: APP.panel === 'datos', bold: true});
    if (APP.panel === 'datos') {
      [['ROL', pet.role], ['HOST', pet.host], ['MODELO', pet.model], ['RED', pet.ip + '.ts'], ['VEL', pet.tps + ' tok/s'], ['TEMP · RAM', pet.temp + '°C · ' + pet.ram + '%']].forEach((r, i) => { const x = 10 + (i % 2) * 100, y = 230 + Math.floor(i / 2) * 25; T(r[0], x, y, P.gray); T(r[1].slice(0, 15), x, y + 10, i === 0 ? pet.col : P.white, i === 0); });
    } else {
      T('PTS ' + PTS[k], 206 - TW('PTS ' + PTS[k]), 213, PTS[k] ? P.cyan : P.slate, true);
      BR[k].forEach((b, i) => {
        const y = 229 + i * 25, sel = APP.br === i;
        if (sel) R(6, y - 2, 204, 24, '#1d2046'); hot(6, y - 2, 170, 24, () => { APP.br = i; }, 'branch:' + i);
        T(b[0], 10, y - 1, sel ? P.white : P.gray, sel);
        for (let s = 0; s < 5; s++) { R(10 + s * 30, y + 11, 27, 7, s < b[1] ? pet.col : P.dark); if (s < b[1]) R(10 + s * 30, y + 11, 27, 2, 'rgba(255,255,255,0.25)'); }
        btn('+', 184, y, 22, 20, () => { if (PTS[k] > 0 && b[1] < 5) { PTS[k]--; b[1]++; APP.br = i; APP.fx.push({pet: k, t: NOW}); say(k, 'subió ' + b[0].toLowerCase() + ' a nivel ' + b[1]); } }, {disabled: !(PTS[k] > 0 && b[1] < 5), id: 'plus:' + i});
      });
    }
  }
  box(4, 310, 208, 28, P.void, P.white);
  const off = bad || locked, ramas = !off && APP.panel === 'ramas';
  const talk = bad ? corrupt('ECONNREFUSED · no puedo hablar ahora…', t, 0.12) : (ramas ? 'Efecto: ' + BR[k][APP.br][2] : SAY[k]);
  const nn = Math.min(talk.length, Math.floor((t * 30) % (talk.length + 50)));
  wrap(talk.slice(0, nn), 33).slice(0, 2).forEach((ln, i) => T(ln, 9, 312 + i * 11, bad ? P.red : P.white));
  btn('JUGAR', 4, 340, 102, 15, () => { APP.game = {k, r: 0, picks: [], done: false, t0: NOW}; }, {disabled: off, bold: true, id: 'JUGAR'});
  btn('CUIDAR', 110, 340, 102, 15, () => { if (!off) { pet.mood = Math.min(100, pet.mood + 15); pet.en = Math.min(100, pet.en + 10); APP.fx.push({pet: k, t: NOW}); APP.fx.push({k, t: NOW}); say(k, 'te lo agradece ♥'); } }, {disabled: off, bold: true, id: 'CUIDAR'});
}
function drawGame(t) {
  const G = APP.game, k = G.k, pet = PET[k], pairs = GAMES[k];
  HIT.push({x: 0, y: 0, w: LW, h: LH, fn: () => {}, label: 'game-block'});
  R(0, 16, LW, NAV_Y - 17, 'rgba(8,8,20,0.8)'); box(8, 40, 200, 290, P.void, pet.col);
  T('JUEGO · ' + pet.name, 14, 43, pet.col, true); btn('X', 186, 41, 18, 14, () => { APP.game = null; }, {id: 'game-close'});
  if (!G.done) {
    T('quiere conocerte · ' + (G.r + 1) + '/3', 14, 58, P.gray);
    pairs[G.r].forEach((opt, i) => {
      const y = 78 + i * 82;
      const hv = btn('', 16, y, 184, 72, () => {
        G.picks.push(opt); if (/^Tema/.test(opt)) BRIEF.theme = /oscuro/.test(opt) ? 'oscuro' : 'claro';
        if (opt === 'IA local' || opt === 'Robótica') BRIEF.topic = opt;
        G.r++; G.t1 = NOW; if (G.r >= 3) { G.done = true; pet.xp = Math.min(100, pet.xp + 15); pet.know = Math.min(40, pet.know + 3); PTS[k]++; BRIEF.learned.push(...G.picks.map(p => pet.name + ': ' + p)); APP.fx.push({k, t: NOW}); say(k, 'aprendió: ' + G.picks.join(', ').toLowerCase()); }
      }, {id: 'game-opt:' + i});
      wrap(opt, 24).slice(0, 2).forEach((ln, j) => TC(ln, 108, y + 26 + j * 13, hv ? P.yellow : P.white, true));
    });
    spr(k, (NOW - (G.t1 || 0)) < 0.9 ? 'celebrate' : 'idle', t, 92, 246, {});
    for (let d = 0; d < 3; d++) R(96 + d * 10, 284, 6, 6, d === G.r ? pet.col : P.dark);
  } else {
    T('¡Gracias! ' + pet.name + ' aprendió:', 14, 62, P.white, true);
    G.picks.forEach((p, i) => T('· ' + p.slice(0, 28), 18, 80 + i * 13, P.lime));
    T('+15 XP · +1 PUNTO', 14, 130, P.cyan, true); wrap('Lo aprendido ayuda al Consejo a planificar.', 31).forEach((l, i) => T(l, 14, 146 + i * 11, P.gray));
    spr(k, 'celebrate', t, 92, 190, {}); btn('LISTO', 58, 270, 100, 22, () => { APP.game = null; }, {on: true, bold: true, id: 'game-done'});
  }
}

/* ---------- 5 · BUSCAR ---------- */
function drawBuscar(t) {
  R(0, 16, LW, NAV_Y - 17, '#14152a'); dither(0, 16, LW, NAV_Y - 17, '#181a30');
  T('BUSCADOR', 5, 18, P.yellow, true); T('si el contexto no alcanza', 60, 18, P.gray);
  const nodes = [['1 MASCOTA', 'dice «no sé»', P.orange], ['2 FILTRO', 'limpia datos', P.red], ['3 BUSCADOR', 'consulta la web', P.sky], ['4 RESUMEN', 'lo acorta', P.lime], ['5 MASCOTA', 'responde y cita', P.orange]];
  const step = SO ? Math.min(4, Math.floor(((NOW - SO.t0) * SPEED / SO.te) * 5)) : -1;
  nodes.forEach((n, i) => {
    const y = 34 + i * 20; box(4, y, 208, 15, P.void, i === step ? P.yellow : n[2]); T(n[0], 9, y + 1, i === step ? P.yellow : n[2], true); T(n[1], 100, y + 1, P.gray);
    if (i < 4) T('↓', 104, y + 12, P.slate);
  });
  box(4, 136, 208, 114, P.void, P.slate); T('HISTORIAL', 9, 138, P.yellow, true); R(8, 152, 200, 1, P.slate);
  HIST.slice(0, 8).forEach((h, i) => { const y = 156 + i * 11; T((h.t + ' ' + PET[h.who].ini + ' ' + h.q).slice(0, 28), 9, y, h.ok ? P.white : P.yellow); T(h.ok ? (h.cache ? 'cach' : '✓') : '…', 184, y, h.ok ? (h.cache ? P.sky : P.lime) : P.yellow); });
  box(4, 254, 208, 98, P.void, P.slate); T('REGLAS', 9, 256, P.yellow, true);
  T('cuota de hoy: ' + HIST.length + '/30', 9, 270, P.gray); R(9, 283, 198, 5, P.dark); R(9, 283, Math.round(198 * HIST.length / 30), 5, P.sky);
  T('FILTRO PHI', 9, 294, P.red, true); T('bloquea pacientes y correos', 9, 306, P.gray);
  T('SIN TU NOMBRE', 9, 320, P.cyan, true); T('quita tu nombre de la consulta', 9, 332, P.gray);
}

/* ---------- overlay de busqueda ---------- */
function drawSearch(t) {
  const S = SO, u = (NOW - S.t0) * SPEED, pet = PET[S.who];
  HIT.push({x: 0, y: 0, w: LW, h: LH, fn: () => { if (u < S.ta) S.t0 = NOW - (S.ta + 0.01) / SPEED; else S.t0 = NOW - (S.te + 0.01) / SPEED; }, label: 'search-skip'});
  R(0, 16, LW, NAV_Y - 17, 'rgba(8,8,20,0.74)'); box(6, 40, 204, 290, P.void, P.yellow);
  spr(S.who, 'think', t, 12, 48, {}); magnifier(40, 48);
  T(pet.name + ': no sé esto', 52, 52, pet.col, true); T('Busco en la web.', 52, 64, P.white);
  box(12, 86, 192, 30, P.ink, P.slate); T('›', 16, 88, P.yellow, true);
  wrap(S.q.slice(0, Math.max(0, Math.min(S.q.length, Math.floor(u * 28)))), 30).slice(0, 2).forEach((ln, i) => T(ln, 26, 88 + i * 12, P.white));
  if (u >= S.tq && u < S.tc) T('consultando' + '.'.repeat(1 + Math.floor(u * 3) % 3), 14, 124, P.yellow);
  if (u >= S.tc) S.results.forEach((r, i) => { if (u >= S.tc + i * 0.5) { T(r[0].slice(0, 32), 14, 124 + i * 25, P.cyan); T(r[1].slice(0, 32), 14, 135 + i * 25, P.gray); } });
  if (u >= S.tr) {
    R(12, 202, 192, 1, P.slate); T('Respuesta:', 14, 206, P.lime, true);
    const n = Math.floor((u - S.ta) * 32); wrap(S.answer.slice(0, Math.max(0, n)), 31).slice(0, 4).forEach((ln, i) => T(ln, 14, 219 + i * 11, P.white));
    if (n >= S.answer.length) { box(14, 270, 188, 13, '#1c3a2a', P.green); T(('fuente: ' + S.src).slice(0, 30), 19, 270, P.lime, true); }
  }
  T('filtrado por el lobby', 14, 292, P.slate); T('toca para saltar', 14, 304, P.slate);
}

/* ---------- bucle ---------- */
function draw(t) {
  NOW = t; const dt = Math.min(0.1, t - LASTT); LASTT = t; HIT = [];
  update(dt);
  [drawTablero, drawConsejo, drawRoadmap, drawMascotas, drawBuscar][APP.tab](t);
  drawHeader(t);
  if (APP.game) drawGame(t);
  if (SO) drawSearch(t);
}
window.addEventListener('keydown', e => { if (e.key === 'Escape') { APP.game = null; if (APP.typing) stopTyping(); } });
boot(draw);
