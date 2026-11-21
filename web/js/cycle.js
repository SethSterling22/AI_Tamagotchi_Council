/* Ciclo día/noche: reloj de fase, dibujo (sol/luna, tinte, estrellas) y hoja de ajustes del horario. */
import {api} from './api.js';
import {P, R, PX, rnd} from './pixel.js';
import {el} from './panel.js';

export const PHASE = {
  noche:     {col: P.blue,   txt: P.cyan, tint: 'rgba(14,15,40,0.45)',    what: 'turno de trabajo: hacen las encomiendas'},
  amanecer:  {col: P.yellow, tint: 'rgba(255,205,117,0.12)', what: 'entregas de la noche'},
  dia:       {col: P.sky,    tint: null,                     what: 'descansan y planifican contigo'},
  atardecer: {col: P.orange, tint: 'rgba(239,125,87,0.14)',  what: 'despiertan; se cierran las encomiendas'},
};
const ORDER = ['atardecer', 'noche', 'amanecer', 'dia'];
const LABEL = {noche: 'NOCHE', amanecer: 'AMANECER', dia: 'DÍA', atardecer: 'ATARDECER'};

/* Reloj del lobby: guarda la diferencia con el reloj local para avanzar la barra entre instantáneas. */
export function clock(cy, recvMs) {
  if (!cy) return null;
  const off = cy.now - recvMs / 1000, fmt = tzFormat(cy.tz);
  return {
    ...cy,
    serverNow: () => Date.now() / 1000 + off,
    progress() { const n = this.serverNow(); return Math.max(0, Math.min(1, (n - cy.started_at) / (cy.ends_at - cy.started_at))); },
    localTime() { return fmt ? fmt.format(new Date(this.serverNow() * 1000)) : cy.local_time; },
  };
}
function tzFormat(tz) {
  try { return new Intl.DateTimeFormat('en-GB', {timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}); } catch (e) { return null; }
}

/* Icono 9×9: luna creciente de noche, sol el resto del día (naranja al atardecer). */
export function phaseIcon(phase, x, y, t) {
  if (phase === 'noche') {
    const c = P.yellow;
    [[3, 0, 4], [1, 1, 3], [1, 2, 2], [0, 3, 2], [0, 4, 2], [0, 5, 2], [1, 6, 2], [1, 7, 3], [3, 8, 4]].forEach(([dx, dy, w]) => R(x + dx, y + dy, w, 1, c));
    if (Math.floor(t * 1.5) % 2) PX(x + 7, y + 2, P.white);
    return;
  }
  const c = PHASE[phase].col;
  R(x + 3, y + 2, 3, 5, c); R(x + 2, y + 3, 5, 3, c);
  const ray = Math.floor(t * 2) % 2 ? 0 : 1;
  [[4, 0], [4, 8], [0, 4], [8, 4]].forEach(([dx, dy]) => PX(x + dx, y + dy, c));
  if (ray) [[1, 1], [7, 1], [1, 7], [7, 7]].forEach(([dx, dy]) => PX(x + dx, y + dy, c));
}

/* Tinte y estrellas sobre la pared de una habitación (antes de dibujar el sprite). */
export function tintRoom(phase, x, y, w, h, t, seed) {
  const st = PHASE[phase]; if (!st || !st.tint) return;
  R(x + 1, y + 1, w - 2, h - 10, st.tint);
  if (phase !== 'noche') return;
  for (let i = 0; i < 7; i++) {
    const sx = x + 4 + Math.floor(rnd(seed * 13 + i) * (w - 8)), sy = y + 16 + Math.floor(rnd(seed * 29 + i) * Math.max(1, h * 0.35));
    if ((Math.floor(t * 0.8 + rnd(seed + i) * 4) % 4) !== 0) PX(sx, sy, i % 3 ? P.gray : P.white);
  }
}

/* Fronteras de las cuatro fases a partir de las horas (vista previa del formulario). */
function boundaries(wake, sleep) {
  const m = s => { const [h, mi] = s.split(':').map(Number); return h * 60 + mi; };
  const f = n => { n = ((n % 1440) + 1440) % 1440; return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0'); };
  const w = m(wake), s = m(sleep);
  return {atardecer: [f(s - 30), f(s)], noche: [f(s), f(w)], amanecer: [f(w), f(w + 30)], dia: [f(w + 30), f(s - 30)]};
}

export function createCycleSheet(root, {onSaved}) {
  let cy = null;
  const localTz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return ''; } })();

  function open(current) {
    cy = current;
    const wake = el('input', {id: 'cy-wake', type: 'time', value: cy.wake, required: true, oninput: preview});
    const sleep = el('input', {id: 'cy-sleep', type: 'time', value: cy.sleep, required: true, oninput: preview});
    const tz = el('input', {id: 'cy-tz', type: 'text', value: cy.configured ? cy.tz : (localTz || cy.tz), list: 'tz-list', autocomplete: 'off', spellcheck: 'false'});
    const zones = (Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : []).map(z => el('option', {value: z}));
    const table = el('div', {class: 'phases'});
    const ferr = n => el('div', {class: 'ferr', 'data-for': n});
    const msg = el('span', {id: 'cy-msg', class: 'msg'});

    function preview() {
      table.replaceChildren();
      if (!wake.value || !sleep.value) return;
      const b = boundaries(wake.value, sleep.value);
      ORDER.forEach(p => table.append(el('div', {class: 'ph' + (p === cy.phase ? ' now' : '')},
        el('b', {style: `color:${PHASE[p].txt || PHASE[p].col}`}, LABEL[p]), el('span', {}, b[p][0] + ' → ' + b[p][1]), el('span', {class: 'dim'}, PHASE[p].what))));
    }
    async function save() {
      root.querySelectorAll('.ferr').forEach(n => (n.textContent = '')); msg.textContent = '';
      try {
        const st = await api.setCycle({wake: wake.value, sleep: sleep.value, tz: tz.value.trim()});
        close(); onSaved(st);
      } catch (e) {
        const t = root.querySelector(`.ferr[data-for="${e.field}"]`);
        (t || msg).textContent = e.message;
      }
    }

    const sheet = el('div', {class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Ciclo día y noche'},
      el('header', {}, el('h2', {}, 'CICLO DÍA / NOCHE'), el('button', {class: 'x', type: 'button', onclick: close, 'aria-label': 'Cerrar'}, '×')),
      el('div', {class: 'body'},
        el('section', {},
          el('p', {}, 'Tus mascotas son nocturnas: trabajan sus encomiendas mientras duermes y, de día, descansan y planifican contigo. El ciclo sigue tu horario, no el sol.'),
          el('p', {class: 'dim', id: 'cy-now'}, `Ahora: ${cy.label} · ${cy.local_time} en ${cy.tz} · cambia a ${cy.next_label}.`),
          cy.configured ? null : el('p', {class: 'warn'}, 'Aún no has guardado tu horario: el lobby usa uno por defecto en su propia zona horaria.')),
        el('section', {},
          el('h3', {}, el('i', {}, '1'), 'TU HORARIO'),
          el('div', {class: 'grid-even'},
            el('label', {class: 'field'}, el('span', {class: 'lbl'}, 'ME DESPIERTO'), wake, ferr('wake')),
            el('label', {class: 'field'}, el('span', {class: 'lbl'}, 'ME DUERMO'), sleep, ferr('sleep'))),
          el('label', {class: 'field'}, el('span', {class: 'lbl'}, 'ZONA HORARIA'), tz, ferr('tz')),
          el('datalist', {id: 'tz-list'}, zones),
          localTz ? el('button', {type: 'button', class: 'btn', id: 'cy-local', onclick: () => { tz.value = localTz; }}, 'USAR LA DE ESTE EQUIPO (' + localTz + ')') : null),
        el('section', {}, el('h3', {}, el('i', {}, '2'), 'FASES DEL DÍA'), table)),
      el('footer', {}, msg,
        el('button', {type: 'button', class: 'btn', onclick: close, id: 'cy-cancel'}, 'CANCELAR'),
        el('button', {type: 'button', class: 'btn primary', id: 'cy-save', onclick: save}, 'GUARDAR HORARIO')));
    preview();
    root.replaceChildren(el('div', {class: 'backdrop', onclick: e => { if (e.target === e.currentTarget) close(); }}, sheet));
    root.hidden = false;
    document.addEventListener('keydown', onKey);
    wake.focus();
  }
  function close() { root.hidden = true; root.replaceChildren(); document.removeEventListener('keydown', onKey); }
  function onKey(e) { if (e.key === 'Escape') close(); }
  return {open, close, isOpen: () => !root.hidden};
}
