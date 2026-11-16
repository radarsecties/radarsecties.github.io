// Roteador e casca da aplicação
import { $, $$, toast, esc } from './util.js';
import * as store from './store.js';
import * as G from './google.js';

const ROUTES = {
  painel: ['Painel', () => import('./pages/painel.js')],
  agenda: ['Agenda setorial', () => import('./pages/agenda.js')],
  radar: ['Radar quântico', () => import('./pages/radar.js')],
  organizacoes: ['Organizações', () => import('./pages/organizacoes.js')],
  org: ['Organização', () => import('./pages/org.js')],
  contatos: ['Contatos', () => import('./pages/contatos.js')],
  pipeline: ['Funil de parcerias', () => import('./pages/pipeline.js')],
  busca: ['Busca ativa', () => import('./pages/busca.js')],
  campanhas: ['Campanhas Gmail', () => import('./pages/campanhas.js')],
  modelos: ['Modelos de e-mail', () => import('./pages/modelos.js')],
  materiais: ['Materiais institucionais', () => import('./pages/materiais.js')],
  mecanismos: ['Mecanismos e leis de inovação', () => import('./pages/mecanismos.js')],
  simulador: ['Simulador de incentivos', () => import('./pages/simulador.js')],
  config: ['Configurações', () => import('./pages/config.js')],
};

let cleanup = null;
let current = '';
let seq = 0;

function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = h.split('?');
  const [name, ...rest] = path.split('/');
  return { name: ROUTES[name] ? name : 'painel', arg: rest.join('/') ? decodeURIComponent(rest.join('/')) : '', params: new URLSearchParams(query) };
}

async function route() {
  const { name, arg, params } = parseHash();
  const my = ++seq;
  const [title, loader] = ROUTES[name];
  try { cleanup?.(); } catch {}
  cleanup = null;
  current = name;
  $('#page-title').textContent = title;
  document.title = `${title} · CIQuanta`;
  $$('#nav a').forEach(a => a.classList.toggle('active', a.dataset.route === name || (name === 'org' && a.dataset.route === 'organizacoes')));
  $('#sidebar').classList.remove('open');
  const view = $('#view');
  view.innerHTML = '<div class="empty">Carregando…</div>';
  try {
    const mod = await loader();
    if (my !== seq) return;
    view.innerHTML = '';
    const c = (await mod.render(view, { arg, params })) || null;
    if (my !== seq) { try { c?.(); } catch {} return; }
    cleanup = c;
    view.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="card"><h3>Não foi possível abrir esta página</h3><p class="muted">${esc(e.message)}</p></div>`;
  }
}

function gmailBadge(s) {
  const el = $('#gmail-status');
  el.classList.toggle('on', s.conectado); el.classList.toggle('off', !s.conectado);
  el.querySelector('.txt').textContent = s.conectado ? s.email || 'Gmail conectado' : 'Gmail desconectado';
  el.title = s.conectado ? 'Conectado ao Gmail' : 'Conecte em Campanhas ou Configurações';
}

function init() {
  window.addEventListener('hashchange', route);
  $('#menu-btn').onclick = () => $('#sidebar').classList.toggle('open');
  $('#theme-btn').onclick = () => {
    const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('ciquanta:tema', next); } catch {}
    window.dispatchEvent(new Event('themechange'));
  };
  $('#global-search').addEventListener('keydown', e => {
    if (e.key === 'Enter') { const q = e.target.value.trim(); location.hash = `#/organizacoes?q=${encodeURIComponent(q)}`; }
  });
  $('#gmail-status').onclick = () => { location.hash = '#/config'; };
  $('#gmail-status').style.cursor = 'pointer';
  G.onAuth(gmailBadge);
  store.seedIfNeeded().then(novo => { if (novo && ['painel', 'agenda', 'modelos'].includes(current)) route(); });
  if (!location.hash) location.hash = '#/painel'; else route();
  window.addEventListener('error', e => { if (e.message && !/ResizeObserver/.test(e.message)) toast('Erro: ' + e.message, 'bad'); });
}
init();
