/* Panel de alta / edición de mascota (DOM, estilo pixel). */
import {api} from './api.js';
import {gfx, meta, spr, PET_COL} from './pixel.js';

export const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
};
const minis = []; // {ctx, key, act(), scale}
export function tickMinis(t) {
  for (const m of minis) { if (!m.ctx.canvas.isConnected) continue; m.ctx.clearRect(0, 0, m.w, m.w); spr(m.key(), m.act(), t, 0, 0, {ctx: m.ctx, scale: m.scale}); }
  for (let i = minis.length - 1; i >= 0; i--) if (!minis[i].ctx.canvas.isConnected && minis[i].dead) minis.splice(i, 1);
}
function miniCanvas(scale, key, act) {
  const c = el('canvas', {width: 32 * scale, height: 32 * scale, class: 'mini'}); const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
  const m = {ctx, key: typeof key === 'function' ? key : () => key, act: typeof act === 'function' ? act : () => act, scale, w: 32 * scale, dead: true};
  minis.push(m); return c;
}
const ERR_ACT = {glitch: 'glitch', error: 'error'};

export function createPanel(root, catalog, {onSaved, onDeleted}) {
  const SP = Object.fromEntries(catalog.species.map(s => [s.key, s]));
  let S = null; // estado del formulario

  function blank(pet) {
    if (pet) return {mode: 'edit', id: pet.id, species: pet.species, name: pet.name, host: pet.host, port: String(pet.port), model: pet.model,
      traits: {...pet.traits}, voice: pet.voice, mood: pet.stats.mood, branch: pet.branches.map(b => b.level), pet, probe: null, hostTouched: true, anim: null};
    return {mode: 'new', id: null, species: null, name: '', host: '', port: '11434', model: '', traits: {}, voice: '', mood: 70, branch: [0, 0, 0],
      pet: null, probe: null, hostTouched: false, anim: null, nameTouched: false};
  }
  function pickSpecies(key) {
    const sp = SP[key]; if (sp.locked && S.mode === 'new') return;
    S.species = key; S.traits = {...sp.traits}; S.voice = sp.voice; S.mood = sp.stats.mood; S.model = sp.model_suggested; S.branch = [0, 0, 0]; S.probe = null;
    if (!S.nameTouched) S.name = sp.name;
    if (!S.hostTouched) S.host = sp.hostname;
    render();
  }
  const budgetLeft = () => catalog.limits.branch_budget - S.branch.reduce((a, b) => a + b, 0);
  const setAnim = (a, ms = 2600) => { S.anim = a; clearTimeout(S._t); if (ms) S._t = setTimeout(() => { if (S) S.anim = null; }, ms); };

  async function runProbe(btn) {
    S.probe = {busy: true}; setAnim('think', 0); renderConn();
    const r = await api.probe({host: S.host, port: S.port, model: S.model, species: S.species}).catch(e => ({ok: false, state: 'glitch', error: e}));
    S.probe = r;
    if (r.ok) { setAnim('celebrate'); if (!S.model && r.models.length) S.model = r.models[0]; }
    else setAnim(ERR_ACT[r.state] || 'error', 4000);
    renderConn();
  }

  function fieldErr(name) { return el('div', {class: 'ferr', 'data-for': name}); }
  function showErr(e) {
    root.querySelectorAll('.ferr').forEach(n => (n.textContent = ''));
    root.querySelectorAll('.bad').forEach(n => n.classList.remove('bad'));
    const f = (e.field || '').split('.')[0], t = root.querySelector(`.ferr[data-for="${f}"]`);
    if (t) { t.textContent = e.message; const inp = t.previousElementSibling; if (inp) inp.classList && inp.classList.add('bad'); t.scrollIntoView({block: 'center', behavior: 'smooth'}); }
    else root.querySelector('#save-msg').textContent = e.message;
  }

  async function save() {
    const msg = root.querySelector('#save-msg'); msg.textContent = '';
    const body = {name: S.name, host: S.host, port: S.port, model: S.model, traits: S.traits, voice: S.voice};
    try {
      let pet; const mode = S.mode;
      if (mode === 'new') pet = await api.create({...body, species: S.species, stats: {mood: S.mood}, branch_levels: S.branch});
      else pet = await api.patch(S.id, body);
      close(); onSaved(pet, mode);
    } catch (e) { showErr(e); }
  }

  // ------------------------------------------------------------------ render
  const conn = el('div', {class: 'conn-result'});
  function renderConn() {
    const p = S.probe; conn.className = 'conn-result'; conn.replaceChildren();
    if (!p) { conn.append(el('span', {class: 'dim'}, 'Aún no probaste la conexión. Puedes guardar igual: aparecerá sin señal hasta que el nodo conteste.')); return; }
    if (p.busy) { conn.classList.add('wait'); conn.append('Probando…'); return; }
    if (p.ok) {
      conn.classList.add('ok');
      conn.append(el('b', {}, 'EN LÍNEA'), ` · ${p.latency_ms} ms · Ollama ${p.version}`, el('br'));
      conn.append(p.models.length ? 'Modelos: ' : 'El nodo no tiene modelos descargados.',
        ...p.models.map(m => el('button', {type: 'button', class: 'chip' + (m === S.model ? ' on' : ''), onclick: () => { S.model = m; root.querySelector('#f-model').value = m; runProbeSoft(); }}, m)));
    } else {
      conn.classList.add(p.state === 'error' ? 'err' : 'glitch');
      conn.append(el('b', {}, p.state === 'error' ? 'ERROR · ' : 'SIN SEÑAL · '), el('code', {}, p.error.code), el('br'), p.error.message);
      if (p.models && p.models.length) conn.append(el('br'), 'Modelos disponibles: ', ...p.models.map(m => el('button', {type: 'button', class: 'chip', onclick: () => { S.model = m; root.querySelector('#f-model').value = m; runProbeSoft(); }}, m)));
    }
  }
  const runProbeSoft = () => runProbe();

  function field(label, input, hint, errName) {
    return el('label', {class: 'field'}, el('span', {class: 'lbl'}, label), input, hint ? el('span', {class: 'hint'}, hint) : null, errName ? fieldErr(errName) : null);
  }
  function section(n, title, ...kids) { return el('section', {}, el('h3', {}, el('i', {}, n), title), ...kids); }

  function render() {
    const sp = S.species ? SP[S.species] : null, edit = S.mode === 'edit';
    root.replaceChildren();
    const sheet = el('div', {class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': edit ? 'Editar mascota' : 'Añadir mascota'});
    // cabecera
    sheet.append(el('header', {}, el('h2', {}, edit ? `${S.pet.name} · AJUSTES` : 'NUEVA MASCOTA'), el('button', {class: 'x', type: 'button', onclick: close, 'aria-label': 'Cerrar'}, '×')));
    const body = el('div', {class: 'body'}); sheet.append(body);

    // estado actual (edición)
    if (edit) {
      const st = S.pet.status || {state: 'pending'};
      body.append(el('div', {class: 'status ' + st.state},
        el('b', {}, {pending: 'CONECTANDO…', online: 'EN LÍNEA', glitch: 'SIN SEÑAL', error: 'ERROR'}[st.state]),
        st.error ? [' · ', el('code', {}, st.error.code), el('br'), st.error.message] : (st.latency_ms != null ? ` · ${st.latency_ms} ms · Ollama ${st.version}` : '')));
    }

    // 1 · personaje
    const grid = el('div', {class: 'species'});
    catalog.species.forEach(s => {
      const dis = edit ? s.key !== S.species : false;
      grid.append(el('button', {type: 'button', class: 'tile' + (S.species === s.key ? ' sel' : '') + (s.locked && !edit ? ' locked' : '') + (dis ? ' dis' : ''),
        'aria-pressed': S.species === s.key, disabled: dis || (s.locked && !edit), onclick: () => pickSpecies(s.key), 'data-species': s.key},
        miniCanvas(2, s.key, s.locked ? 'sleep' : 'idle'), el('span', {class: 'nm'}, s.name), el('span', {class: 'rl'}, s.locked ? 'NIV 5' : s.role)));
    });
    const info = el('div', {class: 'info'});
    if (sp) info.append(el('div', {class: 'big'}, miniCanvas(3, () => S.species, () => S.anim || 'idle')),
      el('div', {}, el('b', {style: `color:${PET_COL[sp.key]}`}, sp.role), el('p', {}, sp.blurb), el('p', {class: 'dim'}, 'Equipo: ' + sp.host_hint)));
    else info.append(el('p', {class: 'dim'}, 'Elige un personaje para ver su rol y valores iniciales.'));
    body.append(section(1, 'PERSONAJE', grid, el('div', {class: 'ferr', 'data-for': 'species'}), info));

    if (!sp) { sheet.append(footer(false)); root.append(el('div', {class: 'backdrop', onclick: e => { if (e.target === e.currentTarget) close(); }}, sheet)); root.hidden = false; return; }

    // 2 · nombre
    const nameIn = el('input', {id: 'f-name', type: 'text', maxlength: catalog.limits.name_max, value: S.name, autocomplete: 'off', spellcheck: 'false',
      oninput: e => { S.name = e.target.value; S.nameTouched = true; cnt.textContent = S.name.length + '/' + catalog.limits.name_max; updatePrompt(); }});
    const cnt = el('span', {class: 'cnt'}, S.name.length + '/' + catalog.limits.name_max);
    body.append(section(2, 'NOMBRE', field('¿Cómo se llamará?', el('div', {class: 'row'}, nameIn, cnt), null, 'name')));

    // 3 · conexión
    const hostIn = el('input', {id: 'f-host', type: 'text', value: S.host, placeholder: '100.64.0.12 u ocelote', autocomplete: 'off', spellcheck: 'false', inputmode: 'url',
      oninput: e => { S.host = e.target.value; S.hostTouched = true; S.probe = null; renderConn(); }});
    const portIn = el('input', {id: 'f-port', type: 'number', min: 1, max: 65535, value: S.port, inputmode: 'numeric',
      oninput: e => { S.port = e.target.value; S.probe = null; renderConn(); }});
    const dl = el('datalist', {id: 'models'}, ...(S.probe && S.probe.models ? S.probe.models : []).map(m => el('option', {value: m})));
    const modelIn = el('input', {id: 'f-model', type: 'text', list: 'models', value: S.model, autocomplete: 'off', spellcheck: 'false',
      placeholder: sp.model_suggested || 'qwen3:0.6b', oninput: e => { S.model = e.target.value.trim(); }});
    body.append(section(3, 'CONEXIÓN AL MODELO',
      el('div', {class: 'grid2'}, field('HOST / IP', hostIn, 'IP de Tailscale (100.x.y.z) o nombre MagicDNS', 'host'), field('PUERTO', portIn, 'Ollama usa 11434', 'port')),
      field(sp.kind === 'embed' ? 'MODELO DE EMBEDDINGS' : 'MODELO', modelIn, sp.model_alt ? 'Sugerido: ' + sp.model_suggested + ' · ' + sp.model_alt : 'Sugerido: ' + sp.model_suggested, 'model'), dl,
      el('div', {class: 'row'}, el('button', {type: 'button', class: 'btn', id: 'btn-probe', onclick: () => runProbe()}, 'PROBAR CONEXIÓN'),
        edit ? el('button', {type: 'button', class: 'btn', id: 'btn-hello', onclick: hello}, 'SALUDAR') : null), conn, el('div', {id: 'hello-out', class: 'hello', hidden: true})));
    renderConn();

    // 4 · personalidad
    const tr = el('div', {class: 'traits'});
    catalog.traits.forEach(t => {
      const out = el('output', {}, String(S.traits[t.key]));
      tr.append(el('label', {class: 'trait'}, el('span', {class: 'lbl'}, t.label), el('span', {class: 'ends'}, t.low), 
        el('input', {type: 'range', min: 0, max: 100, step: 5, value: S.traits[t.key], 'data-trait': t.key, oninput: e => { S.traits[t.key] = +e.target.value; out.textContent = e.target.value; updatePrompt(); }}),
        el('span', {class: 'ends r'}, t.high), out));
    });
    const voice = el('textarea', {id: 'f-voice', rows: 3, maxlength: catalog.limits.voice_max, oninput: e => { S.voice = e.target.value; vcnt.textContent = S.voice.length + '/' + catalog.limits.voice_max; updatePrompt(); }}, S.voice);
    const vcnt = el('span', {class: 'cnt'}, S.voice.length + '/' + catalog.limits.voice_max);
    const promptBox = el('pre', {id: 'prompt-box', class: 'prompt'}, '…');
    body.append(section(4, 'PERSONALIDAD', tr, field('VOZ (instrucción extra, opcional)', voice, null, 'voice'), vcnt,
      el('details', {}, el('summary', {}, 'Ver el prompt de sistema que recibirá el modelo'), promptBox)));

    // 5 · estadísticas iniciales
    const stat = (l, v, ro) => el('div', {class: 'stat'}, el('span', {class: 'lbl'}, l), el('div', {class: 'bar'}, el('i', {style: `width:${v}%`})), el('output', {}, ro || String(v)));
    const moodIn = el('input', {type: 'range', min: 0, max: 100, step: 5, value: S.mood, id: 'f-mood', disabled: edit, oninput: e => { S.mood = +e.target.value; mo.textContent = S.mood; }});
    const mo = el('output', {}, String(S.mood));
    const br = el('div', {class: 'branches'});
    const pts = el('div', {class: 'pts'});
    const drawBr = () => {
      br.replaceChildren(); const left = budgetLeft();
      pts.textContent = edit ? `NIVEL ${S.pet.level} · XP ${S.pet.xp} · PUNTOS LIBRES ${S.pet.points}` : `PUNTOS INICIALES: ${left} de ${catalog.limits.branch_budget}`;
      sp.branches.forEach(([name, desc], i) => {
        const lv = S.branch[i];
        br.append(el('div', {class: 'branch'},
          el('button', {type: 'button', class: 'pm', disabled: edit || lv <= 0, onclick: () => { S.branch[i]--; drawBr(); }, 'aria-label': 'Quitar punto a ' + name}, '−'),
          el('div', {class: 'bn'}, el('b', {}, name), el('span', {class: 'dim'}, desc)),
          el('div', {class: 'pips'}, ...[1, 2, 3, 4, 5].map(n => el('i', {class: n <= lv ? 'on' : ''}))),
          el('button', {type: 'button', class: 'pm', disabled: edit || left <= 0 || lv >= catalog.limits.branch_max_at_start, onclick: () => { S.branch[i]++; drawBr(); }, 'aria-label': 'Sumar punto a ' + name}, '+')));
      });
    };
    drawBr();
    body.append(section(5, 'ESTADÍSTICAS INICIALES', 
      el('div', {class: 'stats'}, el('label', {class: 'stat'}, el('span', {class: 'lbl'}, 'ÁNIMO'), moodIn, mo), stat('ENERGÍA', 100, '100'), stat('CONOC.', 0, '0')), pts, br,
      el('p', {class: 'dim'}, edit ? 'Las ramas se entrenan jugando (pestaña MASCOTAS, próximamente).' : 'Reparte tus puntos: cada rama sube un parámetro medible cuando el lobby esté completo.')));

    sheet.append(footer(true));
    root.replaceChildren(el('div', {class: 'backdrop', onclick: e => { if (e.target === e.currentTarget) close(); }}, sheet)); root.hidden = false;
    updatePrompt();
  }

  let pt = 0;
  function updatePrompt() {
    clearTimeout(pt); pt = setTimeout(async () => {
      const box = root.querySelector('#prompt-box'); if (!box || !S.species) return;
      try { box.textContent = (await api.persona({species: S.species, name: S.name, traits: S.traits, voice: S.voice})).system_prompt; } catch (e) { box.textContent = '(sin conexión con el lobby)'; }
    }, 200);
  }

  async function hello() {
    const out = root.querySelector('#hello-out'); out.hidden = false; out.className = 'hello wait'; out.textContent = 'Saludando… (la primera vez carga el modelo, puede tardar)';
    setAnim('think', 0);
    const r = await api.hello(S.id).catch(e => ({ok: false, error: e}));
    if (r.ok) { out.className = 'hello ok'; out.textContent = '«' + r.text + '»  · ' + r.ms + ' ms' + (r.tps ? ' · ' + r.tps + ' tok/s' : ''); setAnim('celebrate'); }
    else { out.className = 'hello err'; out.textContent = (r.error.code || 'ERROR') + ': ' + (r.error.message || ''); setAnim('error', 4000); }
  }

  function footer(canSave) {
    const edit = S && S.mode === 'edit';
    const msg = el('span', {id: 'save-msg', class: 'msg'});
    const f = el('footer', {}, msg);
    if (edit) {
      let armed = false;
      const del = el('button', {type: 'button', class: 'btn danger', id: 'btn-delete', onclick: async () => {
        if (!armed) { armed = true; del.textContent = '¿SEGURO? CLIC DE NUEVO'; setTimeout(() => { armed = false; del.textContent = 'ELIMINAR'; }, 3000); return; }
        const pet = S.pet; await api.remove(pet.id); close(); onDeleted(pet);  // close() deja S = null
      }}, 'ELIMINAR');
      f.append(del);
    }
    f.append(el('button', {type: 'button', class: 'btn', onclick: close, id: 'btn-cancel'}, 'CANCELAR'),
      el('button', {type: 'button', class: 'btn primary', id: 'btn-save', disabled: !canSave, onclick: save}, edit ? 'GUARDAR CAMBIOS' : 'GUARDAR MASCOTA'));
    return f;
  }

  function close() { if (S) clearTimeout(S._t); root.hidden = true; root.replaceChildren(); S = null; document.removeEventListener('keydown', onKey); }
  function onKey(e) { if (e.key === 'Escape') close(); }
  function open(pet) { S = blank(pet); document.addEventListener('keydown', onKey); render(); const f = root.querySelector('#f-name') || root.querySelector('.tile'); if (f && !pet) root.querySelector('.tile:not(.locked)').focus(); }
  return {open, close, isOpen: () => !root.hidden};
}
