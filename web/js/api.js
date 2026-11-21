/* Cliente de la API del lobby. Todos los errores llegan como {code, message, field}. */
async function j(method, url, body) {
  let r;
  try {
    r = await fetch(url, {method, headers: body ? {'Content-Type': 'application/json'} : {}, body: body ? JSON.stringify(body) : undefined});
  } catch (e) { throw {code: 'LOBBY_OFFLINE', message: 'No se puede contactar con el lobby.'}; }
  if (r.status === 204) return null;
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw d.error || {code: 'HTTP_' + r.status, message: 'Error ' + r.status};
  return d;
}
export const api = {
  species: () => j('GET', 'api/species'),
  pets: () => j('GET', 'api/pets'),
  events: (limit = 6) => j('GET', 'api/events?limit=' + limit),
  probe: b => j('POST', 'api/probe', b),
  create: b => j('POST', 'api/pets', b),
  patch: (id, b) => j('PATCH', 'api/pets/' + id, b),
  remove: id => j('DELETE', 'api/pets/' + id),
  recheck: id => j('POST', `api/pets/${id}/probe`),
  hello: id => fetch(`api/pets/${id}/hello`, {method: 'POST'}).then(r => r.json()),
  persona: b => j('POST', 'api/persona-preview', b),
  cycle: () => j('GET', 'api/cycle'),
  setCycle: b => j('PUT', 'api/cycle', b),
};
/* Tiempo real: SSE con reintento; si falla, sondeo cada 5 s. */
export function subscribe(onState) {
  let es = null, timer = null;
  const poll = async () => { try { onState(await api.pets()); } catch (e) { onState(null, e); } };
  const startPoll = () => { if (!timer) { poll(); timer = setInterval(poll, 5000); } };
  try {
    es = new EventSource('api/stream');
    es.onmessage = m => { if (timer) { clearInterval(timer); timer = null; } onState(JSON.parse(m.data)); };
    es.onerror = () => { startPoll(); };
  } catch (e) { startPoll(); }
  poll();
}
