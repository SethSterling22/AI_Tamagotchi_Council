/* ===== BORRADOR C · CONSOLA / MENU JRPG ===== */
let sel = 0, lastInput = -99;
const SAY = {
  ocelote: 'Estoy armando tu mini-app. ¿Prefieres el tema oscuro o el claro?',
  buho: 'Encontré 5 fuentes nuevas. ¿Te interesa más la IA local o la robótica?',
  erizo: 'ECONNREFUSED 100.64.0.12:11434 · Reintentando en 30 s…',
  panda_rojo: '¡Hola! ¿Jugamos al test de gustos? Son solo 3 preguntas.',
  kakapo: 'Zzz… (archivando recuerdos del día)',
  armino: 'Necesito nivel 5 en el Consejo para despertar. Sigan trabajando juntos.',
};
const MENU = ['JUGAR', 'DATOS', 'CONSEJO', 'AJUSTES'];

function bar(x, y, w, v, col, label) {
  T(label, x, y - 2, P.gray);
  const bx = x + 44; R(bx, y + 1, w, 6, P.void); R(bx + 1, y + 2, Math.round((w - 2) * v / 100), 4, col);
  for (let i = 1; i < 10; i++) PX(bx + Math.round(w * i / 10), y + 4, 'rgba(0,0,0,0.35)');
}

function draw(t) {
  if (t - lastInput > 8) { sel = (Math.floor(t / 8)) % 6; }
  const k = KEYS[sel], pet = PET[k], act = curAct(k, t), bad = act === 'glitch' || act === 'error', locked = act === 'locked';
  R(0, 0, LW, LH, '#14152a'); dither(0, 0, LW, LH, '#181a30');
  // ---- lista de nodos
  box(4, 4, 98, 166, P.void, P.slate);
  T('NODOS', 10, 6, P.yellow, true); R(8, 19, 90, 1, P.slate);
  KEYS.forEach((kk, i) => {
    const p = PET[kk], a = curAct(kk, t), y = 23 + i * 24, on = i === sel;
    if (on) { R(7, y - 1, 92, 24, '#2a2e5a'); R(7, y - 1, 2, 24, P.yellow); if (Math.floor(t * 2) % 2) T('▶', 9, y + 5, P.yellow, true); }
    const bd = (a === 'glitch' || a === 'error');
    const o = {frame: 0}; if (kk === 'armino') o.tint = '#3a4060';
    // cara 24x24 recortada del sprite
    const A = META.actions[a === 'locked' ? 'idle' : a];
    const f = frameOf(a === 'locked' ? 'idle' : a, t);
    if (kk === 'armino') { g.save(); g.beginPath(); g.rect(20, y, 24, 22); g.clip(); spr(kk, 'idle', t, 16, y - 4, {tint: '#3a4060', frame: 0}); g.restore(); }
    else { g.drawImage(sheets[kk], f * 32 + 5, A.row * 32 + 4, 22, 22, 21, y, 22, 22); }
    T(p.name, 46, y, on ? P.white : p.col, true);
    T(kk === 'armino' ? 'LV --' : 'LV ' + p.lv, 46, y + 11, P.gray);
    R(91, y + 4, 6, 6, ledColor(a)); if (bd && Math.floor(t * 4) % 2) R(91, y + 4, 6, 6, P.void);
  });
  // ---- visor central
  box(106, 4, 172, 118, P.void, P.slate);
  const vx = 108, vy = 6, vw = 168, vh = 114;
  g.save(); g.beginPath(); g.rect(vx, vy, vw, vh); g.clip();
  R(vx, vy, vw, vh, bad ? '#2a0e1a' : '#2a2e5a');
  for (let yy = 0; yy < vh; yy += 6) dither(vx, vy + yy, vw, 3, bad ? '#33121f' : '#33386a', (yy / 6) | 0);
  R(vx, vy + 82, vw, 32, bad ? '#1a0a12' : '#1d2046'); R(vx, vy + 82, vw, 2, bad ? P.red : P.slate);
  for (let s = 0; s < 14; s++) PX(vx + rnd(s) * vw, vy + rnd(s + 40) * 70, (Math.floor(t * 2 + s) % 4) ? P.slate : P.white);
  const scale = 3, pw = 32 * scale;
  const px = vx + (vw - pw) / 2, py = vy + 90 - 30 * scale + 0;
  R(vx + vw / 2 - 40, vy + 92, 80, 5, 'rgba(0,0,0,0.35)');
  if (locked) spr(k, 'idle', t, px, py - 2, {tint: '#3a4060', frame: 0, scale});
  else spr(k, act, t, px, py - 2, {scale});
  g.restore();
  if (bad) { tear(vx, vy, vw, vh, t, 8); scan(vx, vy, vw, vh, 0.2); }
  box(110, 8, TW(pet.name) + 10, 13, P.void, pet.col); T(pet.name, 115, 8, pet.col, true);
  T(locked ? 'NIVEL 5 REQUERIDO' : ACT_LABEL[act], 112, 108, bad ? P.red : P.white);
  // ---- barras
  box(106, 126, 172, 44, P.void, P.slate);
  if (locked) { T('— sin datos —', 112, 142, P.slate); }
  else {
    bar(112, 131, 80, pet.xp, P.yellow, 'XP');
    bar(112, 142, 80, bad ? 12 : pet.mood, bad ? P.red : P.green, 'ÁNIMO');
    bar(112, 153, 80, pet.know * 2.5, P.sky, 'CONOCE');
    T(pet.know + '/40', 244, 150, P.gray);
  }
  // ---- panel de datos (o de error)
  box(282, 4, 98, 166, P.void, bad ? P.red : P.slate);
  if (bad) {
    const e = ERRS[act];
    T('!! ERROR', 288, 6, P.red, true); R(286, 19, 90, 1, P.red);
    T(e[0], 288, 23, P.white); T(e[1], 288, 35, P.yellow); T(e[2], 288, 47, P.yellow); T(e[3], 288, 58, P.yellow);
    T('último latido:', 288, 76, P.gray); T('hace 94 s', 288, 87, P.red, true);
    T('reintento en', 288, 104, P.gray); T(Math.max(0, 30 - Math.floor(t % 31)) + ' s', 288, 115, P.cyan, true);
    T('host:', 288, 132, P.gray); T(pet.host, 288, 143, P.white);
    T('(4a pared rota)', 288, 156, P.slate);
  } else if (locked) {
    T('BLOQUEADO', 288, 6, P.slate, true); R(286, 19, 90, 1, P.slate);
    T('Sube el Consejo', 288, 26, P.gray); T('a nivel 5 para', 288, 38, P.gray); T('invitarlo.', 288, 50, P.gray);
    R(318, 78, 20, 15, P.yellow); R(321, 68, 14, 12, P.yellow); R(324, 71, 8, 10, '#14152a');
  } else {
    T('DATOS', 288, 6, P.yellow, true); R(286, 19, 90, 1, P.slate);
    const rows = [['ROL', pet.role], ['HOST', pet.host], ['MODELO', pet.model], ['RED', pet.ip + '.ts'], ['VEL', pet.tps + ' tok/s'], ['TEMP', pet.temp + ' °C'], ['RAM', pet.ram + ' %']];
    rows.forEach((r, i) => { T(r[0], 288, 22 + i * 20, P.gray); T(r[1], 288, 32 + i * 20, i === 0 ? pet.col : P.white, i === 0); });
  }
  // ---- caja de dialogo
  box(4, 174, 376, 38, P.void, P.white);
  const talk = SAY[k], shown = bad ? corrupt(talk, t, 0.12) : talk;
  const n = Math.min(shown.length, Math.floor((t * 30) % (shown.length + 40)));
  const lines = wrap(shown.slice(0, Math.max(n, 0)), 44);
  T(pet.name + ':', 10, 177, pet.col, true);
  lines.forEach((ln, i) => T(ln, 10, 188 + i * 11 - 0, bad ? P.red : P.white));
  MENU.forEach((m, i) => {
    const mx = 282, my = 179 + (i % 2) * 15, mxx = mx + Math.floor(i / 2) * 48;
    const on = i === Math.floor(t / 2) % 4 && !locked;
    box(mxx, my - 2, 46, 14, on ? P.yellow : '#1a1c2c', on ? P.white : P.slate);
    TC(m, mxx + 23, my - 2, on ? P.void : P.gray, true);
  });
}
function onClick(x, y, t) {
  if (x >= 4 && x < 102 && y >= 22 && y < 168) { sel = Math.floor((y - 22) / 24); lastInput = t; }
  if (x >= 282 && x < 380 && y < 170) { if (KEYS[sel] !== 'armino') cycleForce(KEYS[sel]); lastInput = t; }
}
function onKey(e, t) {
  if (e.key === 'ArrowDown') { sel = (sel + 1) % 6; lastInput = t; }
  if (e.key === 'ArrowUp') { sel = (sel + 5) % 6; lastInput = t; }
}
boot(draw, onClick, onKey);
