// Roteador e estrutura da aplicação
import { $, $$, toast, esc } from './util.js';
import * as store from './store.js';
import * as G from './google.js';
import * as monitor from './monitor.js';
import { icon } from './icons.js';
import * as cadencia from './cadencia.js';
import { abrirPaleta } from './paleta.js';

const ROUTES = {
  painel: ['Painel', 'painel', () => import('./pages/painel.js'), 'Visão geral'],
  interacoes: ['Interações em tempo real', 'interacoes', () => import('./pages/interacoes.js'), 'Visão geral'],
  agenda: ['Agenda', 'agenda', () => import('./pages/agenda.js'), 'Visão geral'],
  visitas: ['Visitas e cadastros', 'contatos', () => import('./pages/visitas.js'), 'Visão geral'],
  organizacoes: ['Organizações', 'organizacoes', () => import('./pages/organizacoes.js'), 'Relacionamento'],
  contatos: ['Contatos', 'contatos', () => import('./pages/contatos.js'), 'Relacionamento'],
  oportunidades: ['Oportunidades de negócio', 'oportunidades', () => import('./pages/oportunidades.js'), 'Relacionamento'],
  rede: ['Rede de relacionamento', 'link', () => import('./pages/rede.js'), 'Relacionamento'],
  setores: ['Setores e aplicações', 'setores', () => import('./pages/setores.js'), 'Relacionamento'],
  busca: ['Busca ativa', 'busca', () => import('./pages/busca.js'), 'Relacionamento'],
  cadencias: ['Cadências automáticas', 'play', () => import('./pages/cadencias.js'), 'Comunicação'],
  campanhas: ['Campanhas de e-mail', 'campanhas', () => import('./pages/campanhas.js'), 'Comunicação'],
  modelos: ['Modelos de e-mail', 'modelos', () => import('./pages/modelos.js'), 'Comunicação'],
  apresentacoes: ['Apresentações', 'apresentacoes', () => import('./pages/apresentacoes.js'), 'Comunicação'],
  materiais: ['Materiais', 'materiais', () => import('./pages/materiais.js'), 'Comunicação'],
  mecanismos: ['Leis e mecanismos de fomento', 'mecanismos', () => import('./pages/mecanismos.js'), 'Fomento'],
  editais: ['Editais e chamadas', 'modelos', () => import('./pages/editais.js'), 'Fomento'],
  simulador: ['Simulador de incentivos', 'simulador', () => import('./pages/simulador.js'), 'Fomento'],
  fontes: ['Fontes e referências', 'fontes', () => import('./pages/fontes.js'), 'Sistema'],
  config: ['Configurações', 'config', () => import('./pages/config.js'), 'Sistema'],
  org: ['Organização', 'organizacoes', () => import('./pages/org.js'), null],
};
const NAV_LABEL = { interacoes: 'Interações', oportunidades: 'Oportunidades', setores: 'Setores', campanhas: 'Campanhas', mecanismos: 'Leis e mecanismos', simulador: 'Simulador', fontes: 'Fontes', cadencias: 'Cadências', rede: 'Rede', editais: 'Editais', visitas: 'Visitas e cadastros' };

let cleanup = null, current = '', seq = 0;

function buildNav() {
  let g = '', h = '';
  for (const [id, [title, ic, , grupo]] of Object.entries(ROUTES)) {
    if (!grupo) continue;
    if (grupo !== g) { h += `<div class="nav-group">${esc(grupo)}</div>`; g = grupo; }
    h += `<a href="#/${id}" data-route="${id}">${icon(ic)}<span>${esc(NAV_LABEL[id] || title)}</span>${id === 'interacoes' ? '<span class="count hidden" id="nav-live"></span>' : ''}</a>`;
  }
  $('#nav').innerHTML = h;
}

function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = h.split('?');
  const [name, ...rest] = path.split('/');
  return { name: ROUTES[name] ? name : 'painel', arg: rest.join('/') ? decodeURIComponent(rest.join('/')) : '', params: new URLSearchParams(query) };
}

async function route() {
  const { name, arg, params } = parseHash();
  const my = ++seq;
  const [title, , loader] = ROUTES[name];
  try { cleanup?.(); } catch {}
  cleanup = null; current = name;
  $('#page-title').textContent = title;
  document.title = `${title} · CIQUANTA`;
  const navId = name === 'org' ? 'organizacoes' : name;
  $$('#nav a').forEach(a => a.classList.toggle('active', a.dataset.route === navId));
  $('#sidebar').classList.remove('open');
  const view = $('#view');
  view.innerHTML = '<div class="empty">Carregando…</div>';
  try {
    const mod = await loader();
    await store.loadSetores();
    if (my !== seq) return;
    view.innerHTML = '';
    const c = (await mod.render(view, { arg, params })) || null;
    if (my !== seq) { try { c?.(); } catch {} return; }
    cleanup = c;
    view.focus({ preventScroll: true }); window.scrollTo(0, 0);
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="card"><h3>Não foi possível abrir esta página</h3><p class="muted">${esc(e.message)}</p></div>`;
  }
}

function badges() {
  const s = G.status(), m = monitor.estado();
  const el = $('#gmail-status');
  el.classList.toggle('on', s.conectado); el.classList.toggle('off', !s.conectado);
  el.querySelector('.txt').textContent = s.conectado ? s.email || 'Conta Google conectada' : 'Conta Google desconectada';
  $('#live-btn').classList.toggle('on', m.ativo);
  $('#live-btn').title = m.ativo ? `Acompanhamento ativo${m.ultimo ? ', última verificação ' + new Date(m.ultimo).toLocaleTimeString('pt-BR') : ''}` : 'Acompanhamento em tempo real desligado';
  const n = $('#nav-live'); if (n) { n.textContent = m.naoLidos; n.classList.toggle('hidden', !m.naoLidos); }
}

function init() {
  buildNav();
  $('#menu-btn').innerHTML = icon('menu', 18);
  $('#theme-btn').innerHTML = icon('tema', 17);
  $('#live-btn').innerHTML = icon('sino', 17);
  window.addEventListener('hashchange', route);
  $('#menu-btn').onclick = () => $('#sidebar').classList.toggle('open');
  $('#theme-btn').onclick = () => {
    const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('ciquanta:tema', next); } catch {}
    window.dispatchEvent(new Event('themechange'));
  };
  $('#live-btn').onclick = () => { location.hash = '#/interacoes'; };
  const paleta = () => abrirPaleta(Object.entries(ROUTES).filter(([, r]) => r[3]).map(([id, r]) => ({ id, titulo: r[0] })));
  $('#global-search').addEventListener('focus', e => { e.target.blur(); paleta(); });
  window.addEventListener('ciq:paleta', paleta);
  document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); paleta(); } });
  $('#gmail-status').onclick = () => { location.hash = '#/config'; };
  G.onAuth(s => {
    badges();
    if (s.conectado) cadencia.iniciar(); else cadencia.parar();
    if (s.conectado && G.hasScope('read')) {
      monitor.iniciar();
      if (store.cfg().notificacoes && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
    } else if (!s.conectado) monitor.parar();
  });
  monitor.onLive(badges);
  store.onChange(w => { if (w === 'recebidos') badges(); });
  store.seedIfNeeded().then(novo => { if (novo && ['painel', 'agenda', 'modelos'].includes(current)) route(); });
  if (!location.hash) location.hash = '#/painel'; else route();
  badges();
  window.addEventListener('error', e => { if (e.message && !/ResizeObserver/.test(e.message)) toast('Erro: ' + e.message, 'bad'); });
}
init();
