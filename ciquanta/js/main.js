// Roteador e estrutura da aplicação
import { $, $$, toast, esc } from './util.js';
import * as store from './store.js';
import * as G from './google.js';
import * as monitor from './monitor.js';
import { icon } from './icons.js';
import * as cadencia from './cadencia.js';
import { abrirPaleta } from './paleta.js';
import * as sync from './sync.js';
import * as automacao from './automacao.js';
import { animarNumeros, revelar } from './motion.js';
import * as acesso from './acesso.js';

// [título, ícone, carregador, grupo do menu (null: fora do menu), rótulo curto no menu]
const ROUTES = {
  painel: ['Hoje', 'painel', () => import('./pages/painel.js'), '', 'Hoje'],
  interacoes: ['Caixa de entrada', 'interacoes', () => import('./pages/interacoes.js'), '', 'Caixa de entrada'],
  agenda: ['Agenda', 'agenda', () => import('./pages/agenda.js'), '', 'Agenda'],
  organizacoes: ['Organizações', 'organizacoes', () => import('./pages/organizacoes.js'), 'Relacionamento'],
  contatos: ['Contatos', 'contatos', () => import('./pages/contatos.js'), 'Relacionamento'],
  oportunidades: ['Oportunidades', 'oportunidades', () => import('./pages/oportunidades.js'), 'Relacionamento'],
  parceiros: ['Programa de parceiros', 'parceiro', () => import('./pages/parceiros.js'), 'Relacionamento', 'Parceiros'],
  rede: ['Rede de relacionamento', 'link', () => import('./pages/rede.js'), 'Relacionamento', 'Rede'],
  captacao: ['Plano de captação', 'captacao', () => import('./pages/captacao.js'), 'Captação', 'Plano de captação'],
  editais: ['Editais e chamadas', 'edital', () => import('./pages/editais.js'), 'Captação', 'Editais'],
  mecanismos: ['Leis e mecanismos de fomento', 'mecanismos', () => import('./pages/mecanismos.js'), 'Captação', 'Leis e mecanismos'],
  simulador: ['Simulador de incentivos', 'simulador', () => import('./pages/simulador.js'), 'Captação', 'Simulador'],
  campanhas: ['Campanhas', 'campanhas', () => import('./pages/campanhas.js'), 'Comunicação'],
  cadencias: ['Cadências', 'play', () => import('./pages/cadencias.js'), 'Comunicação'],
  modelos: ['Modelos de e-mail', 'modelos', () => import('./pages/modelos.js'), 'Comunicação'],
  apresentacoes: ['Apresentações', 'apresentacoes', () => import('./pages/apresentacoes.js'), 'Comunicação'],
  materiais: ['Materiais', 'materiais', () => import('./pages/materiais.js'), 'Comunicação'],
  sinais: ['Sinais do mercado', 'sinal', () => import('./pages/sinais.js'), 'Inteligência', 'Sinais'],
  busca: ['Busca ativa', 'busca', () => import('./pages/busca.js'), 'Inteligência'],
  setores: ['Setores e aplicações', 'setores', () => import('./pages/setores.js'), 'Inteligência', 'Setores'],
  visitas: ['Visitas e cadastros', 'contatos', () => import('./pages/visitas.js'), 'Inteligência', 'Visitas'],
  automacao: ['Automação', 'robo', () => import('./pages/automacao.js'), false],
  config: ['Configurações', 'config', () => import('./pages/config.js'), false],
  fontes: ['Fontes e referências', 'fontes', () => import('./pages/fontes.js'), null],
  org: ['Organização', 'organizacoes', () => import('./pages/org.js'), null],
};
const GRUPO_DE = Object.fromEntries(Object.entries(ROUTES).map(([id, r]) => [id, r[3]]));

let cleanup = null, current = '', seq = 0;

function buildNav() {
  let g = null, h = '<span class="indicador" aria-hidden="true"></span>';
  for (const [id, [title, ic, , grupo, curto]] of Object.entries(ROUTES)) {
    if (grupo === null || grupo === false) continue;
    if (grupo !== g) { if (grupo) h += `<div class="nav-group">${esc(grupo)}</div>`; g = grupo; }
    h += `<a href="#/${id}" data-route="${id}"><span>${esc(curto || title)}</span>${id === 'interacoes' ? '<span class="count hidden" id="nav-live"></span>' : ''}</a>`;
  }
  $('#nav').innerHTML = h;
}
/** Desliza o destaque do menu até o item ativo. */
function moverIndicador() {
  const a = $('#nav a.active'), ind = $('#nav .indicador');
  if (!ind) return;
  if (!a) { ind.style.opacity = 0; return; }
  ind.style.opacity = 1; ind.style.height = (a.offsetHeight - 8) + 'px'; ind.style.transform = `translateY(${a.offsetTop + 4}px)`;
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
  const navId = name === 'org' ? 'organizacoes' : name;
  const grupo = GRUPO_DE[navId] || (GRUPO_DE[navId] === false ? 'Sistema' : '');
  $('#page-title').innerHTML = `${grupo ? esc(grupo) + ' / ' : ''}<b>${esc(title)}</b>`;
  document.title = `${title} · CIQUANTA CRM`;
  $$('#nav a').forEach(a => a.classList.toggle('active', a.dataset.route === navId));
  $$('#conta-menu [data-ir]').forEach(b => b.classList.toggle('active', b.dataset.ir === navId));
  fecharConta();
  moverIndicador();
  $('#sidebar').classList.remove('open');
  const view = $('#view');
  view.classList.remove('entrada');
  view.innerHTML = '<div class="esqueleto" aria-busy="true" aria-label="Carregando"><i></i><i></i><i></i><i></i><b></b><b></b></div>';
  try {
    const mod = await loader();
    await store.loadSetores();
    await (await import('./pesquisa.js')).carregarPesquisa();
    if (my !== seq) return;
    view.innerHTML = '';
    const c = (await mod.render(view, { arg, params })) || null;
    if (my !== seq) { try { c?.(); } catch {} return; }
    cleanup = c;
    void view.offsetWidth; view.classList.add('entrada');
    animarNumeros(view); revelar(view);
    view.focus({ preventScroll: true }); window.scrollTo(0, 0);
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="card"><h3>Não foi possível abrir esta página</h3><p class="muted">${esc(e.message)}</p></div>`;
  }
}

function abrirConta() {
  const m = $('#conta-menu'); m.hidden = false; $('#conta').setAttribute('aria-expanded', 'true');
  requestAnimationFrame(() => m.classList.add('aberto'));
  m.querySelector('[role=menuitem]:not([hidden])')?.focus({ preventScroll: true });
}
function fecharConta() {
  const m = $('#conta-menu'); if (!m || m.hidden) return;
  m.classList.remove('aberto'); $('#conta').setAttribute('aria-expanded', 'false');
  setTimeout(() => { if (!m.classList.contains('aberto')) m.hidden = true; }, 180);
}

function badges() {
  const s = G.status(), m = monitor.estado();
  const el = $('#conta-estado');
  el.classList.toggle('on', s.conectado); el.classList.toggle('off', !s.conectado);
  el.querySelector('span').textContent = s.conectado ? (s.email || 'E-mail conectado') : 'E-mail desconectado';
  $('#conta').title = s.conectado ? s.email || '' : 'E-mail do CIQUANTA desconectado';
  $('#m-sair').hidden = !G.temAcesso();
  $('#m-tema').textContent = (document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark' ? 'Tema claro' : 'Tema escuro';
  $('#live-btn').classList.toggle('on', m.ativo);
  $('#live-btn').title = m.ativo ? `Acompanhamento ativo${m.ultimo ? ', última verificação ' + new Date(m.ultimo).toLocaleTimeString('pt-BR') : ''}` : 'Acompanhamento em tempo real desligado';
  const n = $('#nav-live'); if (n) { n.textContent = m.naoLidos; n.classList.toggle('hidden', !m.naoLidos); }
  const y = sync.estado(), sb = $('#sync-btn');
  sb.classList.toggle('hidden', !y.ativo); sb.classList.toggle('on', y.fase === 'ok'); sb.classList.toggle('bad', y.fase === 'erro'); sb.classList.toggle('girando', y.fase === 'sincronizando');
  sb.title = y.fase === 'erro' ? 'Base compartilhada: ' + y.erro : y.fase === 'sincronizando' ? 'Sincronizando a base compartilhada…' : `Base compartilhada sincronizada${y.ultimo ? ' às ' + new Date(y.ultimo).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}. Clique para sincronizar agora.`;
}

function init() {
  buildNav();
  $('#menu-btn').innerHTML = icon('menu', 18);
  $('#theme-btn').innerHTML = icon('tema', 17);
  $('#live-btn').innerHTML = icon('sino', 17);
  $('#sync-btn').innerHTML = icon('sync', 17);
  $('#busca-ic').outerHTML = icon('busca', 15);
  $('#sync-btn').onclick = () => sync.sincronizar({ manual: true });
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
  const novo = async tipo => { const c = await import('./components.js'); const ir = o => { if (o?.orgId || o?.id) location.hash = `#/org/${o.orgId || o.id}`; }; ({ org: () => c.openOrgForm({}, ir), contato: () => c.openContatoForm({}, ir), oportunidade: () => c.openOportunidadeForm({}, ir), reuniao: () => c.openReuniaoForm({}) })[tipo](); };
  const acoes = [
    { n: 'Nova organização', f: () => novo('org') }, { n: 'Novo contato', f: () => novo('contato') }, { n: 'Nova oportunidade', f: () => novo('oportunidade') }, { n: 'Agendar reunião', f: () => novo('reuniao') },
    { n: 'Relatório executivo de captação', f: async () => (await import('./relatorio.js')).gerarRelatorio() },
    { n: 'Sincronizar a base compartilhada', f: () => sync.sincronizar({ manual: true }) },
    { n: 'Baixar cópia de segurança', f: async () => (await import('./util.js')).download(`ciquanta-crm-${new Date().toISOString().slice(0, 10)}.json`, store.exportJSON(), 'application/json') },
    { n: 'Alternar tema claro e escuro', f: () => $('#theme-btn').click() }, { n: 'Atalhos de teclado', f: () => atalhos() },
  ];
  const paleta = () => abrirPaleta(Object.entries(ROUTES).filter(([id]) => id !== 'org').map(([id, r]) => ({ id, titulo: r[0] })), acoes);
  const IR = { h: 'painel', m: 'captacao', o: 'organizacoes', c: 'contatos', n: 'oportunidades', p: 'parceiros', a: 'agenda', i: 'interacoes', e: 'cadencias', s: 'sinais', l: 'mecanismos' };
  const atalhos = async () => (await import('./util.js')).modal({ title: 'Atalhos de teclado', body: `<div class="atalhos">
    <kbd>Ctrl K</kbd><span>Busca rápida e ações (organizações, contatos, oportunidades, telas)</span>
    <kbd>?</kbd><span>Esta lista de atalhos</span>
    ${Object.entries(IR).map(([k, r]) => `<kbd>g ${k}</kbd><span>Ir para ${esc(ROUTES[r][0])}</span>`).join('')}
    <kbd>Esc</kbd><span>Fechar janelas</span></div>` });
  let g = 0;
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable || $('#modal-root').children.length || document.querySelector('.paleta')) return;
    if (e.key === '?') { e.preventDefault(); atalhos(); }
    else if (e.key === '/') { e.preventDefault(); paleta(); }
    else if (e.key === 'g') g = Date.now();
    else if (Date.now() - g < 1200 && IR[e.key]) { g = 0; location.hash = '#/' + IR[e.key]; }
  });
  $('#global-search').addEventListener('click', paleta);
  window.addEventListener('resize', moverIndicador);
  window.addEventListener('scroll', () => $('.topbar').classList.toggle('rolou', scrollY > 4), { passive: true });
  window.addEventListener('ciq:paleta', paleta);
  document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); paleta(); } });
  // Menu da conta: abre para cima, fecha com Esc, clique fora ou ao trocar de tela
  $('#conta').onclick = () => ($('#conta-menu').hidden ? abrirConta() : fecharConta());
  document.addEventListener('pointerdown', e => { if (!e.target.closest('#conta, #conta-menu')) fecharConta(); });
  $('#conta-menu').addEventListener('keydown', e => {
    const itens = $$('#conta-menu [role=menuitem]').filter(b => !b.hidden), i = itens.indexOf(document.activeElement);
    if (e.key === 'Escape') { fecharConta(); $('#conta').focus(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); itens[(i + (e.key === 'ArrowDown' ? 1 : -1) + itens.length) % itens.length]?.focus(); }
  });
  $$('#conta-menu [data-ir]').forEach(b => b.onclick = () => { location.hash = '#/' + b.dataset.ir; fecharConta(); });
  $('#m-tema').onclick = () => { $('#theme-btn').click(); badges(); };
  $('#m-sair').addEventListener('click', async () => {
    fecharConta();
    const { modal } = await import('./util.js');
    const { el, close } = modal({ title: 'Sair do CRM', body: '<p>Este computador volta para a tela de entrada. Para entrar de novo, use o código enviado ao e-mail do CIQUANTA.</p>',
      footer: '<button class="btn" data-close>Cancelar</button><button class="btn danger" id="s-apagar">Sair e apagar os dados deste computador</button><button class="btn primary" id="s-sair">Sair</button>' });
    const sair = async apagar => { close(); await G.sair(); if (apagar) await acesso.apagarDadosLocais(); location.hash = '#/painel'; location.reload(); };
    el.querySelector('#s-sair').onclick = () => sair(false);
    el.querySelector('#s-apagar').onclick = () => sair(true);
  });
  window.addEventListener('ciq:acesso-expirado', () => acesso.mostrarEntrada());
  G.onAuth(s => {
    badges();
    if (s.conectado) cadencia.iniciar(); else cadencia.parar();
    if (s.conectado && G.hasScope('read')) {
      monitor.iniciar();
      if (store.cfg().notificacoes && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
    } else if (!s.conectado) monitor.parar();
  });
  monitor.onLive(badges);
  sync.onSync(badges);
  let reabrir;
  store.onChange(w => {
    if (w === 'recebidos') badges();
    // Dados alterados por outra aba ou por outro computador: atualiza a tela, sem interromper quem está digitando
    if (w === 'externo') { clearTimeout(reabrir); reabrir = setTimeout(() => { if (!$('#modal-root').children.length && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) route(); badges(); }, 400); }
  });
  store.pontoDiario();
  G.iniciarConexao();
  automacao.iniciar();
  automacao.onAutomacao(res => { if (res?.some(x => x.n) && ['painel', 'organizacoes', 'contatos', 'visitas'].includes(current) && !$('#modal-root').children.length && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) route(); });
  store.seedIfNeeded().then(novo => { if (novo && ['painel', 'agenda', 'modelos'].includes(current)) route(); });
  if (!location.hash) location.hash = '#/painel'; else route();
  badges();
  // Aplicativo instalável e uso sem conexão (somente em endereço seguro)
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) navigator.serviceWorker.register('sw.js').catch(e => console.warn('sw', e));
  window.addEventListener('error', e => { if (e.message && !/ResizeObserver/.test(e.message)) toast('Erro: ' + e.message, 'bad'); });
  window.addEventListener('unhandledrejection', e => { console.error(e.reason); toast('Erro: ' + (e.reason?.message || 'operação não concluída'), 'bad'); });
  window.addEventListener('offline', () => toast('Sem conexão com a internet. O que você fizer fica guardado neste navegador.', 'bad'));
  window.addEventListener('online', () => { toast('Conexão restabelecida.', 'ok'); sync.sincronizar(); });
}
// Nada do CRM abre antes de confirmar o acesso deste computador
acesso.liberado().then(ok => { if (ok) init(); });
