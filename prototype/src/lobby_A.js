/* ===== BORRADOR A · EL HOTEL: una habitacion por nodo ===== */
const WALL = {ocelote: '#2d3a5e', buho: '#3b2f4a', erizo: '#2f4a46', panda_rojo: '#4a3340', kakapo: '#33423a', armino: '#262838'};
const MSGS = [
  ['panda_rojo', 'hoy toca el test de gustos'],
  ['ocelote', 'compilando mini-app #3...'],
  ['buho', '5 fuentes nuevas de IA local'],
  ['lobby', 'erizo sin latido hace 94 s'],
  ['ocelote', 'mini-app #3 lista'],
  ['kakapo', 'zzz... archivando recuerdos'],
  ['lobby', 'consejo aprobo newsletter'],
  ['panda_rojo', 'el usuario respondio 2 de 3'],
];
const MCOL = {lobby: P.cyan};
Object.keys(PET).forEach(k => MCOL[k] = PET[k].col);

function furniture(k, rx, ry, t) {
  const fl = ry + 63;
  if (k === 'ocelote') {
    box(rx + 6, ry + 30, 24, 33, P.dark, P.void);
    for (let u = 0; u < 4; u++) {
      R(rx + 9, ry + 33 + u * 7, 18, 5, '#1a1c2c');
      PX(rx + 11, ry + 35 + u * 7, ((Math.floor(t * 3) + u) % 2) ? P.green : P.dark);
      PX(rx + 14, ry + 35 + u * 7, ((Math.floor(t * 5) + u * 2) % 3 === 0) ? P.orange : P.dark);
      R(rx + 19, ry + 35 + u * 7, 6, 1, P.slate);
    }
    R(rx + 84, ry + 50, 32, 13, '#7a4a2a'); R(rx + 84, ry + 50, 32, 2, '#a06a3a');
    box(rx + 90, ry + 33, 22, 15, P.void, P.slate);
    for (let l = 0; l < 4; l++) R(rx + 92, ry + 35 + l * 3, 4 + ((Math.floor(t * 2) + l * 3) % 9), 1, [P.green, P.cyan, P.yellow, P.lime][l]);
    R(rx + 99, ry + 48, 4, 2, P.slate);
  } else if (k === 'buho') {
    R(rx + 5, ry + 31, 28, 32, '#4a2e1a'); R(rx + 6, ry + 32, 26, 30, '#6a4a2a');
    for (let s = 0; s < 3; s++) {
      R(rx + 6, ry + 41 + s * 10, 26, 2, '#3a2412');
      for (let b = 0; b < 6; b++) R(rx + 8 + b * 4, ry + 33 + s * 10 + (b % 3), 3, 8 - (b % 3), [P.red, P.blue, P.yellow, P.green, P.plum, P.sky][(b + s * 2) % 6]);
    }
    box(rx + 88, ry + 24, 26, 24, P.navy, P.void);
    R(rx + 100, ry + 25, 2, 22, P.void); R(rx + 89, ry + 35, 24, 2, P.void);
    R(rx + 93, ry + 28, 4, 4, P.yellow); R(rx + 94, ry + 28, 3, 3, P.navy);
    PX(rx + 105, ry + 30, P.white); PX(rx + 108, ry + 41, P.white); PX(rx + 91, ry + 44, P.white);
    R(rx + 96, ry + 56, 12, 7, P.dark); R(rx + 100, ry + 48, 3, 9, P.slate); R(rx + 95, ry + 45, 14, 4, P.yellow);
  } else if (k === 'erizo') {
    for (let i = 0; i < 16; i++) R(rx + 8 + (i < 8 ? 0 : 0), ry + 30 + i, 18, 1, i < 11 ? P.red : '#8a2a40');
    R(rx + 10, ry + 46, 14, 3, '#8a2a40'); R(rx + 13, ry + 49, 8, 3, '#8a2a40'); R(rx + 16, ry + 52, 2, 2, '#8a2a40');
    R(rx + 15, ry + 35, 4, 9, P.yellow); R(rx + 12, ry + 38, 10, 3, P.yellow);
    R(rx + 88, ry + 48, 26, 15, '#7a4a2a'); R(rx + 88, ry + 48, 26, 2, '#a06a3a');
    R(rx + 88, ry + 55, 26, 1, '#3a2412'); R(rx + 100, ry + 48, 2, 15, '#3a2412');
  } else if (k === 'panda_rojo') {
    R(rx + 4, ry + 40, 36, 8, '#8a2a40'); R(rx + 4, ry + 46, 36, 17, P.red);
    R(rx + 6, ry + 48, 14, 10, '#d0586a'); R(rx + 22, ry + 48, 14, 10, '#d0586a');
    R(rx + 2, ry + 44, 4, 19, '#8a2a40'); R(rx + 38, ry + 44, 4, 19, '#8a2a40');
    R(rx + 94, ry + 52, 14, 11, '#7a4a2a'); R(rx + 98, ry + 40, 6, 12, P.green);
    R(rx + 92, ry + 42, 6, 6, P.lime); R(rx + 104, ry + 44, 6, 6, P.lime); R(rx + 98, ry + 34, 6, 6, P.lime);
    box(rx + 92, ry + 22, 20, 12, P.void, P.slate); T('♥', rx + 98, ry + 21, P.red);
  } else if (k === 'kakapo') {
    box(rx + 6, ry + 30, 22, 33, P.slate, P.void);
    for (let d = 0; d < 3; d++) { R(rx + 8, ry + 33 + d * 10, 18, 8, '#7a90a8'); R(rx + 14, ry + 36 + d * 10, 6, 2, P.void); }
    R(rx + 82, ry + 52, 36, 11, P.blue); R(rx + 82, ry + 48, 12, 6, P.white); R(rx + 82, ry + 62, 36, 1, '#2a3f90');
    R(rx + 98, ry + 52, 20, 3, '#2a3f90');
    const a = (Math.floor(t * 1.5) % 2) ? P.yellow : '#b09050'; R(rx + 100, ry + 28, 6, 6, a); R(rx + 101, ry + 28, 4, 3, P.void);
  } else if (k === 'armino') {
    R(rx + 92, ry + 48, 14, 11, P.yellow); R(rx + 95, ry + 40, 8, 10, P.yellow); R(rx + 97, ry + 42, 4, 8, WALL.armino);
    R(rx + 98, ry + 51, 2, 4, P.void);
  }
  R(rx + 1, fl, 1, 1, P.void);
}

function room(k, i, t) {
  const rx = 8 + (i % 3) * 124, ry = 16 + Math.floor(i / 3) * 76, rw = 120, rh = 72;
  const act = curAct(k, t), pet = PET[k], bad = act === 'glitch' || act === 'error';
  box(rx, ry, rw, rh, WALL[k], P.void, '#000');
  for (let yy = ry + 5; yy < ry + rh - 12; yy += 8) for (let xx = rx + 4 + (((yy - ry) / 8 | 0) % 2) * 4; xx < rx + rw - 4; xx += 8) PX(xx, yy, 'rgba(255,255,255,0.07)');
  R(rx + 1, ry + rh - 9, rw - 2, 8, '#1f2233'); R(rx + 1, ry + rh - 9, rw - 2, 1, P.slate);
  furniture(k, rx, ry, t);
  let px = rx + 44, flip = false;
  if (act === 'walk') { const w = Math.sin(t * 0.9); px += w * 18; flip = Math.cos(t * 0.9) < 0; }
  const py = ry + 36;
  if (k === 'armino') spr(k, 'idle', t, px, py, {tint: '#3a4060', frame: 0});
  else spr(k, act, t, px, py, {flip});
  // placa
  const nm = pet.name;
  if (!bad) {
    box(rx + 3, ry + 3, TW(nm) + 7, 12, P.void, pet.col);
    T(nm, rx + 6, ry + 3, pet.col, true);
    T(act === 'locked' ? 'SIN NODO' : pet.host, rx + rw - 6 - TW(act === 'locked' ? 'SIN NODO' : pet.host), ry + 3, P.gray);
    T(ACT_LABEL[act], rx + 5, ry + 16, ACT_LABEL[act].length > 0 && act !== 'locked' ? P.white : P.gray);
  } else {
    const e = ERRS[act], c = act === 'glitch' ? P.red : P.orange;
    box(rx + 3, ry + 2, rw - 6, 36, '#240a14', c);
    T(nm + ' ' + e[0], rx + 7, ry + 3, c, true);
    T(e[1], rx + 7, ry + 14, P.white); T(e[2] + e[3], rx + 7, ry + 24, P.yellow);
    if (Math.floor(t * 2) % 2) R(rx + rw - 12, ry + 6, 5, 5, c);
    if (act === 'glitch') { tear(rx + 1, ry + 40, rw - 2, rh - 41, t, 6); tear(rx + 3, ry + 2, rw - 6, 36, t, 2); scan(rx + 1, ry + 40, rw - 2, rh - 41, 0.18); }
  }
  // barra de energia
  R(rx + 6, ry + rh - 7, 30, 3, '#0e0f1a'); R(rx + 6, ry + rh - 7, Math.round(30 * pet.mood / 100), 3, bad ? P.red : pet.col);
  return {rx, ry, rw, rh};
}

function draw(t) {
  R(0, 0, LW, LH, '#12131f');
  for (let s = 0; s < 40; s++) PX(rnd(s) * LW, rnd(s + 99) * 14, (Math.floor(t * 2 + s) % 5) ? P.slate : P.white);
  R(0, 0, LW, 14, P.void);
  T('AI COUNCIL', 6, 1, P.yellow, true); T('· LOBBY', 70, 1, P.gray);
  const bad = KEYS.filter(k => ['glitch', 'error'].includes(curAct(k, t))).length;
  const off = KEYS.filter(k => curAct(k, t) === 'locked').length;
  const txt = 'NODOS ' + (6 - bad - off) + '/' + (6 - off);
  T(txt, LW - 6 - TW(txt) - 66, 1, P.green, true);
  T(bad ? bad + ' GLITCH' : 'TODO OK', LW - 6 - 56, 1, bad ? ((Math.floor(t * 2) % 2) ? P.red : '#7a2030') : P.green, true);
  KEYS.forEach((k, i) => room(k, i, t));
  // ----- franja del lobby (Pi 2 B)
  R(0, 168, LW, 48, P.void); R(0, 168, LW, 1, P.slate);
  R(8, 196, 58, 18, '#7a4a2a'); R(8, 196, 58, 2, '#a06a3a');
  box(14, 171, 46, 26, P.ink, P.slate);
  KEYS.forEach((k, i) => { R(18 + (i % 3) * 13, 175 + Math.floor(i / 3) * 10, 9, 7, ledColor(curAct(k, t))); });
  R(34, 197, 6, 2, P.slate);
  TC('LOBBY', 37, 199, P.white, true);
  box(72, 171, 228, 41, '#16172a', P.slate);
  const n = Math.floor(t / 2.6);
  for (let l = 0; l < 3; l++) {
    const m = MSGS[(n - 2 + l + MSGS.length * 4) % MSGS.length];
    const line = (m[0] === 'lobby' ? 'LOBBY' : PET[m[0]].name.toLowerCase()) + '> ' + m[1];
    const c = MCOL[m[0]]; const fresh = l === 2;
    const shown = fresh ? line.slice(0, Math.floor(((t % 2.6)) * 28) + 1) : line;
    T(shown, 78, 174 + l * 12, fresh ? c : 'rgba(180,190,210,0.55)');
  }
  box(306, 171, 74, 41, '#16172a', P.slate);
  KEYS.forEach((k, i) => {
    const x = 311 + (i % 2) * 34, y = 173 + Math.floor(i / 2) * 12; const a = curAct(k, t);
    R(x, y + 3, 6, 6, ledColor(a)); if (a === 'glitch' && Math.floor(t * 4) % 2) R(x, y + 3, 6, 6, P.void);
    T(PET[k].ini, x + 9, y, a === 'locked' ? P.slate : P.gray);
  });
}
function onClick(x, y, t) {
  KEYS.forEach((k, i) => {
    const rx = 8 + (i % 3) * 124, ry = 16 + Math.floor(i / 3) * 76;
    if (k !== 'armino' && x >= rx && x < rx + 120 && y >= ry && y < ry + 72) cycleForce(k);
  });
}
boot(draw, onClick);
