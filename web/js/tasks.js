/* Encomiendas: se encargan de día, las mascotas las trabajan de noche y se recogen al amanecer. */
import {api} from './api.js';
import {P, R, PX} from './pixel.js';
import {el} from './panel.js';

/* Paquete 9×8 para el botón de la cabecera y las entregas. */
export function parcelIcon(x, y, col) {
  R(x, y + 2, 9, 6, col); R(x + 1, y + 3, 7, 4, P.void); R(x + 1, y + 3, 7, 4, '#5a3b2a');
  R(x + 4, y + 2, 1, 6, P.yellow); R(x + 1, y + 4, 7, 1, P.yellow);
  PX(x + 3, y + 1, P.yellow); PX(x + 5, y + 1, P.yellow); PX(x + 2, y, P.yellow); PX(x + 6, y, P.yellow);
}

const STATUS = {queued: 'EN COLA', running: 'EN MARCHA', done: 'ENTREGADA', failed: 'FALLIDA'};

export function createTaskSheet(root, catalog, {getState}) {
  const SP = Object.fromEntries(catalog.species.map(s => [s.key, s]));
  const L = catalog.limits;
  let lists = null, sheetMsg = null;

  function when(ts) { const cy = getState().cycle; return ts ? (cy ? cy.fmtTime(ts) : new Date(ts * 1000).toLocaleTimeString()) : ''; }

  function item(t) {
    const head = el('div', {class: 'th'},
      el('b', {}, t.title), el('span', {class: 'dim'}, ` · ${t.pet_name} · `),
      el('span', {class: 'st ' + t.status}, t.status === 'done' && !t.seen_at ? '★ NUEVA' : STATUS[t.status]));
    const box = el('div', {class: 'task ' + t.status, 'data-task': t.id}, head);
    const btn = (label, id, fn) => el('button', {type: 'button', class: 'chip', 'data-act': id, onclick: async () => { try { await fn(); } catch (e) { if (sheetMsg) sheetMsg.textContent = e.message; } refresh(); }}, label);
    if (t.status === 'done') {
      box.append(el('div', {class: 'dim'}, `Lista a las ${when(t.finished_at)} · ${t.tokens || '?'} tok` + (t.tps ? ` · ${t.tps} tok/s` : '') + (t.truncated ? ' · cortada al tope de tokens' : '')),
        el('pre', {class: 'result'}, t.result),
        el('div', {class: 'row'}, t.seen_at ? null : btn('VISTO', 'seen', () => api.seenTask(t.id)), btn('BORRAR', 'delete', () => api.deleteTask(t.id))));
    } else if (t.status === 'failed') {
      box.append(el('div', {class: 'err'}, `${t.error ? t.error.code + ': ' + t.error.message : 'error'} · ${t.attempts} intentos`),
        el('div', {class: 'row'}, btn('REINTENTAR', 'retry', () => api.retryTask(t.id)), btn('BORRAR', 'delete', () => api.deleteTask(t.id))));
    } else {
      const extra = t.status === 'running' ? `desde las ${when(t.started_at)}` :
        (t.attempts ? `intento ${t.attempts + 1} · último error ${t.error ? t.error.code : '?'}` : 'esperando la noche o a que su nodo esté en línea');
      box.append(el('div', {class: 'dim'}, extra), el('details', {}, el('summary', {}, 'Ver encargo'), el('pre', {class: 'result'}, t.prompt)));
      if (t.status === 'queued') box.append(el('div', {class: 'row'}, btn('QUITAR', 'delete', () => api.deleteTask(t.id))));
    }
    return box;
  }

  async function refresh() {
    if (!lists) return;
    let tasks;
    try { tasks = (await api.tasks()).tasks; } catch (e) { lists.done.replaceChildren(el('p', {class: 'err'}, e.message)); return; }
    const done = tasks.filter(t => t.status === 'done').sort((a, b) => (!!a.seen_at - !!b.seen_at) || b.finished_at - a.finished_at);
    const queue = tasks.filter(t => t.status === 'queued' || t.status === 'running').sort((a, b) => a.id - b.id);
    const failed = tasks.filter(t => t.status === 'failed');
    const fill = (node, arr, empty) => node.replaceChildren(...(arr.length ? arr.map(item) : [el('p', {class: 'dim'}, empty)]));
    fill(lists.done, done, 'Aún no hay entregas.');
    fill(lists.queue, queue, 'Nada en cola.');
    fill(lists.failed, failed, 'Ninguna.');
  }

  function open() {
    const st = getState(), cy = st.cycle;
    const able = st.pets.filter(p => SP[p.species] && SP[p.species].kind === 'chat' && !SP[p.species].locked);
    const pet = el('select', {id: 'tk-pet'}, ...able.map(p => el('option', {value: p.id}, `${p.name} · ${SP[p.species].role}`)));
    const tcnt = el('span', {class: 'cnt'}, '0/' + L.task_title_max), pcnt = el('span', {class: 'cnt'}, '0/' + L.task_prompt_max);
    const title = el('input', {id: 'tk-title', type: 'text', maxlength: L.task_title_max, autocomplete: 'off', oninput: e => { tcnt.textContent = e.target.value.length + '/' + L.task_title_max; }});
    const prompt = el('textarea', {id: 'tk-prompt', rows: 4, maxlength: L.task_prompt_max, oninput: e => { pcnt.textContent = e.target.value.length + '/' + L.task_prompt_max; }});
    const ferr = n => el('div', {class: 'ferr', 'data-for': n});
    const msg = el('span', {id: 'tk-msg', class: 'msg'}); sheetMsg = msg;
    lists = {done: el('div', {id: 'tasks-done', class: 'tasks'}), queue: el('div', {id: 'tasks-queue', class: 'tasks'}), failed: el('div', {id: 'tasks-failed', class: 'tasks'})};

    async function submit() {
      root.querySelectorAll('.ferr').forEach(n => (n.textContent = '')); msg.textContent = '';
      try {
        await api.createTask({pet_id: +pet.value, title: title.value, prompt: prompt.value});
        title.value = ''; prompt.value = ''; tcnt.textContent = '0/' + L.task_title_max; pcnt.textContent = '0/' + L.task_prompt_max;
        msg.textContent = cy && cy.work ? 'Encargada: empieza en cuanto su nodo esté libre.' : 'Encargada: la trabajará esta noche.';
        refresh();
      } catch (e) {
        const t = root.querySelector(`.ferr[data-for="${e.field}"]`);
        (t || msg).textContent = e.message;
      }
    }

    const hours = cy ? `de ${cy.sleep} a ${cy.wake}` : 'de noche';
    const sheet = el('div', {class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Encomiendas'},
      el('header', {}, el('h2', {}, 'ENCOMIENDAS'), el('button', {class: 'x', type: 'button', onclick: close, 'aria-label': 'Cerrar'}, '×')),
      el('div', {class: 'body'},
        el('section', {},
          el('p', {}, `Encarga de día; tus mascotas las trabajan de noche (${hours}, según tu horario) y las entregan al amanecer. Cada encargo debe caber en una respuesta corta (~${L.task_output_tokens} tokens).`),
          el('p', {class: 'warn', id: 'tk-privacy'}, 'No escribas datos de pacientes ni información clínica: las encomiendas viajan a los nodos del Consejo.')),
        el('section', {},
          el('h3', {}, el('i', {}, '1'), 'NUEVA ENCOMIENDA'),
          able.length ? null : el('p', {class: 'dim'}, 'Ninguna mascota acepta encomiendas de texto todavía.'),
          el('label', {class: 'field'}, el('span', {class: 'lbl'}, 'MASCOTA'), pet, ferr('pet_id')),
          el('label', {class: 'field'}, el('span', {class: 'lbl'}, 'TÍTULO'), el('div', {class: 'row'}, title, tcnt), ferr('title')),
          el('label', {class: 'field'}, el('span', {class: 'lbl'}, 'ENCARGO (entradas explícitas: la mascota no ve nada más)'), prompt, pcnt, ferr('prompt')),
          el('div', {class: 'row'}, el('button', {type: 'button', class: 'btn primary', id: 'tk-save', disabled: !able.length, onclick: submit}, 'ENCARGAR'), msg)),
        el('section', {}, el('h3', {}, el('i', {}, '2'), 'ENTREGAS'), lists.done),
        el('section', {}, el('h3', {}, el('i', {}, '3'), 'EN COLA'), lists.queue),
        el('section', {}, el('h3', {}, el('i', {}, '4'), 'FALLIDAS'), lists.failed)),
      el('footer', {}, el('button', {type: 'button', class: 'btn', onclick: close, id: 'tk-close'}, 'CERRAR')));
    root.replaceChildren(el('div', {class: 'backdrop', onclick: e => { if (e.target === e.currentTarget) close(); }}, sheet));
    root.hidden = false;
    document.addEventListener('keydown', onKey);
    refresh();
    (able.length ? title : root.querySelector('#tk-close')).focus();
  }
  function close() { lists = null; root.hidden = true; root.replaceChildren(); document.removeEventListener('keydown', onKey); }
  function onKey(e) { if (e.key === 'Escape') close(); }
  return {open, close, refresh, isOpen: () => !root.hidden};
}
