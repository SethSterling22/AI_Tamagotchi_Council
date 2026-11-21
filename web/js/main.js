import {api, subscribe} from './api.js';
import {setup, loadAssets, gfx} from './pixel.js';
import {createBoard} from './board.js';
import {createPanel, tickMinis} from './panel.js';

const cv = document.getElementById('c');
const portrait = () => window.innerHeight > window.innerWidth * 1.05;
let lastPortrait = null;
function layout() {
  const p = portrait(); if (p === lastPortrait) return; lastPortrait = p;
  setup(cv, p ? 216 : 384, p ? 384 : 216); cv.classList.toggle('portrait', p);
}
const STATE = {pets: [], events: [], offline: false, version: -1};
let board = null;

async function refreshEvents() { try { STATE.events = (await api.events(6)).events; } catch (e) {} }

async function boot() {
  layout();
  const catalog = await api.species();
  const meta = await loadAssets(catalog.species.map(s => s.key));
  document.body.dataset.ready = '1';
  const panel = createPanel(document.getElementById('panel'), catalog, {
    onSaved: () => refreshEvents(), onDeleted: () => refreshEvents(),
  });
  board = createBoard({onAdd: () => panel.open(null), onOpen: pet => panel.open(pet)});
  window.addEventListener('resize', layout);
  subscribe((d, err) => {
    if (!d) { STATE.offline = true; return; }
    STATE.offline = false; STATE.pets = d.pets;
    if (d.version !== STATE.version) { STATE.version = d.version; refreshEvents(); }
  });
  (function frame() {
    const t = performance.now() / 1000;
    board.draw(t, STATE); tickMinis(t);
    requestAnimationFrame(frame);
  })();
  window.__state = STATE;
}
boot().catch(e => { document.body.dataset.error = e.message || e.code; document.getElementById('fatal').textContent = 'No se pudo iniciar el lobby: ' + (e.message || e.code); });
