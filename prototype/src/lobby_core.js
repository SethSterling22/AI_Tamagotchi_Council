/* ===== AI COUNCIL · LOBBY INTEGRADO (prototipo v1) =====
   Pestañas: TABLERO (resumen por nodo) · CONSEJO (preguntas al usuario) · ROADMAP (micro-tareas)
             · MASCOTAS (cuidado, juegos y ramas) · BUSCAR (buscador con filtro de privacidad)       */
const SPEED = parseFloat(new URLSearchParams(location.search).get('speed') || '1');
let MX = -1, MY = -1, HIT = [], NOW = 0, LASTT = 0;
cv.addEventListener('mousemove', e => { const r = cv.getBoundingClientRect(); MX = (e.clientX - r.left) * LW / r.width; MY = (e.clientY - r.top) * LH / r.height; });
cv.addEventListener('mouseleave', () => { MX = MY = -1; });
cv.addEventListener('click', e => {
  const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * LW / r.width, y = (e.clientY - r.top) * LH / r.height;
  for (let i = HIT.length - 1; i >= 0; i--) { const h = HIT[i]; if (x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h) { h.fn(); return; } }
});
window.__click = label => { const h = HIT.find(h => h.label === label); if (h) { h.fn(); return true; } return false; };
window.__labels = () => HIT.map(h => h.label).filter(Boolean);

function btn(label, x, y, w, h, fn, o) {
  o = o || {}; const hov = MX >= x && MX < x + w && MY >= y && MY < y + h;
  const fill = o.disabled ? '#1a1c2c' : (o.on ? P.yellow : (hov ? '#2f3560' : (o.fill || '#1a1c2c')));
  const bd = o.disabled ? P.dark : (o.on ? P.white : (hov ? P.cyan : (o.bd || P.slate)));
  box(x, y, w, h, fill, bd);
  const col = o.disabled ? P.dark : (o.on ? P.void : (o.col || P.white)), ty = y + Math.floor((h - 12) / 2);
  if (o.left) T(label, x + 5, ty, col, o.bold); else TC(label, x + w / 2, ty, col, o.bold !== false);
  if (!o.disabled) HIT.push({x, y, w, h, fn, label: o.id || label});
  return hov;
}
function hot(x, y, w, h, fn, label) { HIT.push({x, y, w, h, fn, label}); return MX >= x && MX < x + w && MY >= y && MY < y + h; }

/* ---------- datos de demo ---------- */
ST.erizo.force = null;
const PTS = {ocelote: 2, buho: 1, erizo: 0, panda_rojo: 3, kakapo: 1, armino: 0};
Object.keys(PET).forEach(k => PET[k].en = {ocelote: 70, buho: 64, erizo: 58, panda_rojo: 82, kakapo: 40, armino: 0}[k]);
const BR = {
  ocelote: [['CÓDIGO', 3, 'tareas de código más largas'], ['DISEÑO', 1, 'pantallas más ordenadas'], ['DEPURAR', 2, 'arregla sus propios fallos']],
  buho: [['INVESTIGAR', 3, 'hasta 3 búsquedas por tarea'], ['RESUMIR', 2, 'resúmenes más fieles'], ['CITAR', 1, 'siempre adjunta la fuente']],
  erizo: [['CRÍTICA', 2, 'detecta más fallos de lógica'], ['SEGURIDAD', 2, 'revisa datos sensibles'], ['CALIDAD', 1, 'listas de control más finas']],
  panda_rojo: [['EMPATÍA', 4, 'entiende mejor tus respuestas'], ['JUEGOS', 3, 'minijuegos más variados'], ['REDACCIÓN', 2, 'textos más cálidos y claros']],
  kakapo: [['MEMORIA', 2, 'guarda más recuerdos'], ['ORDEN', 1, 'etiqueta mejor lo guardado'], ['RECUERDO', 1, 'encuentra datos más rápido']],
  armino: [['—', 0, ''], ['—', 0, ''], ['—', 0, '']],
};
const GAMES = {
  ocelote: [['Tema oscuro', 'Tema claro'], ['Mínimo viable', 'Muy pulido'], ['Una pantalla', 'Varias pantallas']],
  buho: [['Fuentes cortas', 'Fuentes largas'], ['Noticias', 'Guías'], ['IA local', 'Robótica']],
  erizo: [['Revisión estricta', 'Revisión suave'], ['Avisar siempre', 'Solo si es grave'], ['Cautela', 'Velocidad']],
  panda_rojo: [['Mensajes cortos', 'Mensajes largos'], ['Tono formal', 'Tono cercano'], ['Preguntas', 'Sorpresas']],
  kakapo: [['Recordar todo', 'Solo lo clave'], ['Ordenar por fecha', 'Ordenar por tema'], ['Resumen', 'Detalle']],
};
const SAY = {
  ocelote: 'Compilo tus ideas en pantallas pequeñas. ¿Jugamos a elegir tu estilo?',
  buho: 'Busco, leo y resumo. Si no sé algo, lo busco en la web y cito la fuente.',
  erizo: 'Reviso cada entrega antes de que salga. Subirme CALIDAD ayuda.',
  panda_rojo: '¡Hola! Yo te hago las preguntas. ¿Jugamos al test de gustos?',
  kakapo: 'Zzz… guardo lo que aprendimos de ti. Aún estoy en entrenamiento.',
  armino: 'Necesito nivel 5 en el Consejo para despertar. Sigan trabajando juntos.',
};
const BRIEF = {goal: null, topic: null, theme: null, time: null, learned: []};
let TASKS = [], SO = null, LOG = [], HIST = [];
const APP = {tab: 0, phase: 'plan', q: 0, qs: 'ask', lt0: 0, react: null, typing: null, stage: 0, sel: 3, panel: 'ramas', game: null, br: 0, reveal: 0, doneAt: 0, hover: null, fx: []};
const clock = () => new Date().toTimeString().slice(0, 5);
function say(who, msg) { LOG.push({who, msg, t: NOW}); if (LOG.length > 60) LOG.shift(); }
const isBad = k => ['glitch', 'error'].includes(ST[k].force);
const nm = k => k === 'lobby' ? 'LOBBY' : (k === 'user' ? 'TÚ' : PET[k].name);
const colOf = k => k === 'lobby' ? P.cyan : (k === 'user' ? P.white : PET[k].col);
HIST.push({t: '09:12', who: 'buho', q: 'qué es sqlite-vec', ok: true, cache: false}, {t: '09:40', who: 'ocelote', q: 'css grid ejemplo simple', ok: true, cache: true});
say('lobby', 'lobby en línea · nodos listos'); say('panda_rojo', '¡hola! ¿empezamos a planificar?'); say('kakapo', 'zzz… archivando recuerdos');

/* ---------- preguntas del Consejo ---------- */
const QS = [
  {who: 'panda_rojo', key: 'goal', text: '¡Hola! ¿Qué te gustaría lograr esta semana?',
   opts: [['Un newsletter personal', 'Newsletter'], ['Automatizar una tarea', 'Automatizar'], ['Aprender algo nuevo', 'Aprender']],
   react: a => ['panda_rojo', '¡Anotado! Armamos algo corto y a tu medida.']},
  {who: 'buho', key: 'topic', text: '¿Qué temas te interesan más?', search: true,
   opts: [['IA local', 'IA local'], ['Robótica', 'Robótica'], ['Productividad', 'Productiv.']],
   react: a => ['buho', 'No sé qué fuentes siguen al día sobre «' + a[1] + '». Voy a buscar…']},
  {who: 'ocelote', key: 'theme', text: 'Para la mini-app: ¿tema oscuro o claro?', skipIf: () => BRIEF.theme,
   opts: [['Oscuro', 'oscuro'], ['Claro', 'claro'], ['Me da igual', 'oscuro']],
   react: a => ['ocelote', 'Tema ' + a[1] + '. Lo hago en una sola pantalla.']},
  {who: 'erizo', key: 'time', text: 'Última duda: ¿cuánto tiempo tienes cada día?',
   opts: [['5 minutos', '5 min'], ['15 minutos', '15 min'], ['Más de 30 minutos', '30+ min']],
   react: a => ['erizo', a[1] === '5 min' ? 'Con 5 min: nada de extras. Lo mínimo y bien hecho.' : 'Bien. Vigilaré que no nos pasemos de alcance.']},
];
const STAGES = ['PREGUNTAR', 'PROPONER', 'CRITICAR', 'ACORDAR'];
const STG = () => [
  ['lobby', 'Propuesta: 8 tareas pequeñas, 2 por mascota, según su especialidad.'],
  [isBad('erizo') ? 'lobby' : 'erizo', 'Ninguna pasa de ~400 tokens. Si una crece, la partimos en dos.'],
  ['lobby', 'ACUERDO 4-0 · generando el ROADMAP…'],
];
const SEARCHES = {
  fuentes: () => ({q: 'fuentes recientes sobre ' + (BRIEF.topic || 'IA local'), src: 'ejemplo.dev',
    results: [['ejemplo.dev', 'Guía para empezar con ' + (BRIEF.topic || 'IA local')], ['wiki.ejemplo.org', 'Lista curada de blogs y foros'], ['foro.ejemplo.net', 'Qué leer esta semana (hilo)']],
    answer: 'Tomaré 5 fuentes de ejemplo.dev y wiki.ejemplo.org y las resumiré.'}),
  css: () => ({q: 'guardar tema oscuro/claro en CSS', src: 'docs.ejemplo.dev',
    results: [['docs.ejemplo.dev', 'prefers-color-scheme: guía'], ['blog.ejemplo.io', 'Variables CSS para temas'], ['wiki.ejemplo.org', 'Modo oscuro: buenas prácticas']],
    answer: 'Usaré la media query prefers-color-scheme y variables CSS.'}),
};

function startSearch(who, S, onDone) {
  const tq = S.q.length / 28, tc = tq + 1.0, tr = tc + 1.5, ta = tr + 0.2, te = ta + S.answer.length / 32 + 2.6;
  SO = {who, q: S.q, results: S.results, answer: S.answer, src: S.src, t0: NOW, tq, tc, tr, ta, te, onDone};
  HIST.unshift({t: clock(), who, q: S.q, ok: false, cache: false});
  say(who, 'no sé esto → buscando: ' + S.q);
}
function endSearch() { const d = SO.onDone; HIST[0].ok = true; say(SO.who, 'encontré respuesta · fuente ' + SO.src); SO = null; if (d) d(); }

/* ---------- tareas del roadmap ---------- */
const LANES = ['panda_rojo', 'buho', 'ocelote', 'erizo'];
const COLN = ['REUNIR', 'CONSTRUIR', 'REVISAR', 'ENTREGAR'];
const KIND_ACT = {host: 'walk', research: 'read', build: 'type', review: 'think'};
function buildTasks() {
  const topic = BRIEF.topic || 'IA local', theme = BRIEF.theme || 'oscuro', mini = BRIEF.time === '5 min';
  TASKS = [
    {id: 'T1', who: 'panda_rojo', col: 0, title: 'Test de gustos', kind: 'host', tok: 200, dur: 7, deps: []},
    {id: 'T2', who: 'buho', col: 0, title: 'Fuentes ' + topic, kind: 'research', tok: 300, dur: 10, deps: [], search: {at: 0.99, skip: true}},
    {id: 'T3', who: 'buho', col: 1, title: 'Resumir fuentes', kind: 'research', tok: 350, dur: 8, deps: ['T2']},
    {id: 'T4', who: 'ocelote', col: 1, title: 'Plantilla HTML', kind: 'build', tok: 400, dur: 9, deps: ['T1']},
    {id: 'T5', who: 'ocelote', col: 2, title: mini ? 'Mini-app mínima' : 'Mini-app ' + theme.split(' ')[0].toLowerCase().slice(0, 8), kind: 'build', tok: mini ? 250 : 400, dur: mini ? 6 : 10, deps: ['T3', 'T4'], search: {at: 0.5, key: 'css'}},
    {id: 'T6', who: 'erizo', col: 2, title: 'Revisar enlaces', kind: 'review', tok: 200, dur: 6, deps: ['T3']},
    {id: 'T7', who: 'panda_rojo', col: 3, title: 'Armar saludo', kind: 'host', tok: 150, dur: 5, deps: ['T5']},
    {id: 'T8', who: 'erizo', col: 3, title: 'Control final', kind: 'review', tok: 200, dur: 6, deps: ['T5', 'T6']},
  ].map(t => Object.assign({p: 0, status: 'pending'}, t));
}
buildTasks();
const byId = id => TASKS.find(t => t.id === id);
const doneCount = () => TASKS.filter(t => t.status === 'done').length;
function resetDemo() {
  APP.phase = 'plan'; APP.q = 0; APP.qs = 'ask'; APP.lt0 = NOW; APP.stage = 0; APP.typing = null; APP.tab = 1;
  Object.assign(BRIEF, {goal: null, topic: null, theme: null, time: null}); buildTasks(); SO = null;
  say('lobby', 'nuevo proyecto: planificación abierta');
}
function advanceQ() {
  APP.q++;
  while (APP.q < QS.length && QS[APP.q].skipIf && QS[APP.q].skipIf()) { say('lobby', QS[APP.q].who + ' ya conoce tu tema (de los juegos)'); APP.q++; }
  if (APP.q >= QS.length) { APP.qs = 'stages'; APP.stage = 0; } else APP.qs = 'ask';
  APP.lt0 = NOW;
}
function answerQ(opt) {
  const q = QS[APP.q]; BRIEF[q.key] = opt[1]; say('user', q.key + ' → ' + opt[1]);
  APP.react = q.react(opt); if (isBad(q.who)) APP.react = ['lobby', 'ERIZO sigue sin señal; anoto tu respuesta por él.'];
  APP.qs = 'react'; APP.lt0 = NOW; APP.typing = null;
}
function update(dt) {
  const sdt = dt * SPEED;
  APP.fx = APP.fx.filter(f => NOW - f.t < 6);
  if (APP.phase === 'plan' && !SO) {
    if (APP.qs === 'react' && (NOW - APP.lt0) * SPEED > 2.8) {
      const q = QS[APP.q];
      if (q.search) { APP.qs = 'search'; startSearch(q.who, SEARCHES.fuentes(), () => advanceQ()); } else advanceQ();
    }
    if (APP.qs === 'stages') {
      const L = STG()[APP.stage], need = L[1].length / 42 + 2.2;
      if ((NOW - APP.lt0) * SPEED > need) {
        APP.stage++; APP.lt0 = NOW;
        if (APP.stage >= 3) { APP.phase = 'review'; buildTasks(); APP.tab = 2; APP.reveal = NOW; say('lobby', 'roadmap generado: 8 tareas pequeñas'); }
      }
    }
  }
  if (APP.phase === 'work') {
    const busy = {}; TASKS.forEach(t => { if (t.status === 'active') busy[t.who] = t; });
    TASKS.forEach(t => {
      if (t.status === 'pending' && !busy[t.who] && !isBad(t.who) && t.deps.every(d => byId(d).status === 'done')) {
        t.status = 'active'; t.p = 0; busy[t.who] = t; say(t.who, t.id + ' empiezo: ' + t.title.toLowerCase());
      }
    });
    TASKS.forEach(t => {
      if (t.status !== 'active') return;
      if (t.search && !t.search.skip && !t.searched && t.p >= t.search.at && !SO) { t.searched = true; startSearch(t.who, SEARCHES[t.search.key](), null); }
      if (SO && SO.who === t.who) return;
      if (isBad(t.who)) return;
      t.p += sdt / t.dur;
      if (t.p >= 1) { t.p = 1; t.status = 'done'; say(t.who, t.id + ' lista ✓'); APP.fx.push({k: t.who, t: NOW}); }
    });
    if (TASKS.every(t => t.status === 'done')) { APP.phase = 'done'; APP.doneAt = NOW; say('lobby', '¡entrega lista! newsletter #1 + mini-app'); }
  }
  if (SO && (NOW - SO.t0) * SPEED > SO.te) endSearch();
}
function petAct(k, t) {
  const s = ST[k];
  if (s.force) return s.force;
  if (k === 'armino') return 'locked';
  if (APP.fx.some(f => f.k === k && NOW - f.t < 1.6)) return 'celebrate';
  if (SO && SO.who === k) return 'think';
  if (APP.phase === 'done') return NOW - APP.doneAt < 6 ? 'celebrate' : 'idle';
  if (APP.phase === 'work') { const a = TASKS.find(x => x.who === k && x.status === 'active'); return a ? KIND_ACT[a.kind] : 'idle'; }
  if (APP.phase === 'plan' && APP.tab === 1 && APP.qs === 'ask' && QS[APP.q] && QS[APP.q].who === k) return 'think';
  return curAct(k, t);
}
function magnifier(x, y) {
  R(x + 1, y, 5, 1, P.yellow); R(x, y + 1, 1, 5, P.yellow); R(x + 6, y + 1, 1, 5, P.yellow); R(x + 1, y + 6, 5, 1, P.yellow);
  R(x + 2, y + 2, 3, 3, 'rgba(115,239,247,0.5)'); R(x + 7, y + 7, 2, 2, P.yellow); PX(x + 6, y + 6, P.yellow);
}
function face(k, x, y, t, act) {
  const a = act === 'locked' ? 'idle' : act, A = META.actions[a];
  if (k === 'armino') { g.save(); g.beginPath(); g.rect(x, y, 22, 22); g.clip(); spr(k, 'idle', t, x - 5, y - 4, {tint: '#3a4060', frame: 0}); g.restore(); }
  else g.drawImage(sheets[k], frameOf(a, t) * 32 + 5, A.row * 32 + 4, 22, 22, x, y, 22, 22);
}
function taskOf(k) { return TASKS.find(x => x.who === k && x.status === 'active') || null; }


/* estado derivado del Consejo (compartido por las vistas) */
function consejoState() {
  let stage = 0, who = 'lobby', text = '', sub = null; const q = QS[APP.q];
  if (APP.phase !== 'plan') { stage = 3; text = 'Plan aprobado. Revisa el ROADMAP y dime si empezamos.'; }
  else if (APP.qs === 'ask') { who = q.who; text = q.text; if (isBad(who)) { sub = who; who = isBad('panda_rojo') ? 'lobby' : 'panda_rojo'; text = '(por ' + PET[sub].name + ') ' + q.text; } }
  else if (APP.qs === 'react') { who = APP.react[0]; text = APP.react[1]; }
  else if (APP.qs === 'search') { who = SO ? SO.who : 'buho'; text = 'Buscando en la web…'; }
  else { stage = 1 + APP.stage; const L = STG()[Math.min(APP.stage, 2)]; who = L[0]; text = L[1]; }
  return {stage, who, text, sub};
}
