/* ===== BORRADOR B · LA MESA DEL CONSEJO ===== */
const TOPIC = '¿ARMAMOS LA NEWSLETTER DE LOS LUNES?';
const STAGES = ['PROPONER', 'CRITICAR', 'VOTAR', 'SINTETIZAR'];
const LINES = [
  {who: 'ocelote', st: 0, text: 'Propongo una newsletter semanal: 3 enlaces y una mini-app de regalo.'},
  {who: 'buho', st: 0, text: 'Tengo 5 fuentes sobre IA local. Me faltan los gustos del usuario.'},
  {who: 'panda_rojo', st: 0, text: 'Yo se los pregunto con un minijuego de 3 preguntas. ¡Será divertido!'},
  {who: 'lobby', st: 1, text: 'ERIZO no responde (ECONNREFUSED). Su turno de crítica queda en blanco.'},
  {who: 'lobby', st: 2, text: 'Votación abierta. Los nodos activos emiten su voto…'},
  {who: 'lobby', st: 3, text: 'APROBADO 3-0 · quórum 4/6 · tarea asignada a OCELOTE.'},
];
let li = 0, lt0 = 0;
const VOTES = {ocelote: 'SI', buho: 'SI', panda_rojo: 'SI', erizo: 'X', kakapo: 'Z', armino: 'L'};
const cx = i => 32 + i * 64;

function draw(t) {
  const L = LINES[li], full = L.text.length / 42 + 2.4;
  if (t - lt0 > full) { li = (li + 1) % LINES.length; lt0 = t; }
  // ----- fondo: sala con paneles y alfombra
  R(0, 0, LW, LH, '#2b2540');
  for (let x = 0; x < LW; x += 24) { R(x, 18, 1, 132, '#241f36'); R(x + 1, 18, 1, 132, '#322b4a'); }
  R(0, 146, LW, 70, '#1c1830'); dither(0, 146, LW, 4, '#2b2540');
  R(0, 18, 8, 130, '#181428'); R(LW - 8, 18, 8, 130, '#181428');
  // ----- cabecera y etapas
  R(0, 0, LW, 16, P.void);
  T('AI COUNCIL', 6, 2, P.yellow, true); T('SESIÓN #042', 76, 2, P.gray);
  let sx = LW - 6;
  for (let s = STAGES.length - 1; s >= 0; s--) {
    const w = TW(STAGES[s]) + 8; sx -= w + 4; const on = s === L.st, done = s < L.st;
    box(sx, 2, w, 13, on ? P.yellow : (done ? '#2a5a3a' : '#1a1c2c'), on ? P.white : (done ? P.green : P.slate));
    T(STAGES[s], sx + 4, 2, on ? P.void : (done ? P.lime : P.slate), on);
  }
  // ----- tema
  box(8, 20, 368, 15, P.void, P.cyan);
  box(12, 22, 12, 11, P.ink, P.slate); R(15, 24, 6, 4, P.cyan); R(17, 29, 2, 1, P.slate);
  T('TEMA:', 30, 21, P.cyan, true); T(TOPIC, 66, 21, P.white);
  // ----- foco sobre quien habla
  const si = KEYS.indexOf(L.who);
  if (si >= 0) {
    const c = cx(si);
    R(c - 26, 78, 52, 32, '#3a3360'); dither(c - 28, 78, 2, 32, '#3a3360'); dither(c + 26, 78, 2, 32, '#3a3360', 1);
  }
  // ----- mascotas detras de sus escritorios
  KEYS.forEach((k, i) => {
    const c = cx(i); let act, o = {};
    if (k === 'erizo') act = 'glitch';
    else if (k === 'kakapo') act = 'sleep';
    else if (k === 'armino') { act = 'idle'; o = {tint: '#3a4060', frame: 0}; }
    else if (k === L.who) act = 'walk';
    else if (L.st === 3 && k === 'ocelote') act = 'celebrate';
    else act = 'idle';
    if (L.st === 3 && k === 'ocelote') act = 'celebrate';
    spr(k, act, t, c - 16, 88, o);
    if (k === 'erizo') { tear(c - 24, 88, 48, 32, t, 4); }
    // escritorio
    const dc = (k === 'armino') ? '#2a2438' : '#7a4a2a';
    R(c - 30, 110, 60, 22, dc); R(c - 30, 110, 60, 3, k === 'armino' ? '#3a3350' : '#a06a3a'); R(c - 30, 129, 60, 3, '#3a2412');
    const p = PET[k];
    TC(p.name, c, 115, k === 'armino' ? P.slate : p.col, true);
    // voto
    const v = VOTES[k]; const rev = L.st >= 3 || (L.st === 2 && t - lt0 > 0.5 + i * 0.5);
    let txt, col;
    if (!rev) { txt = k === 'erizo' ? 'SIN SEÑAL' : (k === 'kakapo' ? 'Zzz' : (k === 'armino' ? 'NVL 5' : '...')); col = k === 'erizo' ? P.red : P.slate; }
    else { txt = {SI: '✓ SÍ', X: '— BLANCO', Z: 'Zzz', L: 'NVL 5'}[v]; col = {SI: P.lime, X: P.red, Z: P.sky, L: P.slate}[v]; }
    if (k === 'erizo' && Math.floor(t * 3) % 2 && !rev) col = '#7a2030';
    box(c - 28, 134, 56, 13, '#16172a', P.slate); TC(txt, c, 134, col, true);
  });
  // ----- globo de dialogo
  const who = L.who, name = who === 'lobby' ? 'LOBBY' : PET[who].name, col = who === 'lobby' ? P.cyan : PET[who].col;
  const n = Math.floor((t - lt0) * 42); const lines = wrap(L.text.slice(0, n), 60);
  const full2 = wrap(L.text, 60).length;
  box(8, 38, 368, 17 + 11 * full2, '#f4f4f4', P.void, '#000');
  T(name + ':', 12, 39, who === 'lobby' ? '#1a6a80' : '#1a1c2c', true);
  lines.forEach((ln, j) => T(ln, 12, 51 + j * 11, P.ink));
  // puntero hacia quien habla
  if (si >= 0) { const c = cx(si); const by = 38 + 17 + 11 * full2; for (let r = 0; r < 5; r++) R(c - 5 + r, by + r, 10 - r * 2, 1, '#f4f4f4'); }
  // ----- registro inferior
  box(8, 150, 368, 62, '#12131f', P.slate);
  const log = ['', '', '', ''];
  for (let j = 0; j <= li; j++) {
    const m = LINES[j]; const nm = m.who === 'lobby' ? 'LOBBY' : PET[m.who].name;
    log.push([nm, m.text, m.who === 'lobby' ? P.cyan : PET[m.who].col]);
  }
  const shown = log.filter(Boolean).slice(-4);
  shown.forEach((m, j) => {
    const last = j === shown.length - 1;
    T('> ' + m[0].toLowerCase() + ': ' + m[1].slice(0, 40) + (m[1].length > 40 ? '…' : ''), 14, 154 + j * 12, last ? m[2] : 'rgba(180,190,210,0.5)');
  });
  if (L.st === 3) { box(286, 194, 86, 15, P.green, P.lime); TC('APROBADO', 329, 194, P.void, true); }
  else { T('esperando' + '.'.repeat(1 + Math.floor(t * 2) % 3), 300, 198, P.slate); }
}
function onClick(x, y, t) { li = (li + 1) % LINES.length; lt0 = t; }
boot(draw, onClick);
