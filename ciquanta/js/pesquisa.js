// Pessoas de P&D das organizações (data/pesquisadores.json, gerado pela coleta diária a partir da
// OpenAlex, do ORCID e de páginas públicas). Une a base pública aos contatos do CRM.
import * as store from './store.js';
import { esc, norm, toast } from './util.js';

let base = null;
export async function carregarPesquisa() {
  if (!base) base = await store.ref('pesquisadores').catch(() => ({ porOrg: {} }));
  return base;
}
const refDe = id => Object.keys(base?.porOrg || {}).find(k => 'org-' + k.replace(/^(ref|auto)-/, '') === id);
/** Pessoas de P&D e lideranças de uma organização do CRM. */
export function pesquisaDe(org) {
  const k = refDe(org.id), x = k ? base.porOrg[k] : null;
  const lista = [...(x?.liderancas || []).map(p => ({ ...p, org, tipo: 'lideranca', id: 'l-' + norm(p.nome).replace(/\W+/g, '-') })), ...(x?.pessoas || []).map(p => ({ ...p, org, tipo: 'pesquisa' }))];
  return { instituicao: x?.instituicao || null, lista, buscadoEm: x?.buscadoEm };
}
/** Organizações do CRM com pessoas publicando sobre computação quântica: { orgId: [nomes] }. Vazio até a base carregar. */
export function quanticasPorOrg() {
  const out = new Map();
  for (const [k, x] of Object.entries(base?.porOrg || {})) {
    const q = (x.pessoas || []).filter(p => p.quantico); if (q.length) out.set('org-' + k.replace(/^(ref|auto)-/, ''), q);
  }
  return out;
}
/** Todas as pessoas, com a organização do CRM correspondente. */
export function todasPessoas() {
  const out = [];
  for (const [k, x] of Object.entries(base?.porOrg || {})) {
    const org = store.get('orgs', 'org-' + k.replace(/^(ref|auto)-/, '')); if (!org) continue;
    (x.pessoas || []).forEach(p => out.push({ ...p, org, tipo: 'pesquisa' }));
    (x.liderancas || []).forEach(p => out.push({ ...p, org, tipo: 'lideranca', id: 'l-' + norm(p.nome).replace(/\W+/g, '-') }));
  }
  return out;
}
const jaContato = p => store.list('contatos').some(c => (p.email && norm(c.email) === norm(p.email)) || (norm(c.nome) === norm(p.nome) && c.orgId === p.org.id));

/** Leva a pessoa ao CRM como contato, com a fonte registrada. Sem e-mail público, entra sem e-mail. */
export function adicionarContato(p) {
  if (jaContato(p)) return null;
  const cargo = p.cargo || (p.tipo === 'lideranca' ? '' : p.quantico ? 'Pesquisador(a) em computação quântica' : 'Pesquisador(a) de P&D');
  return store.upsert('contatos', {
    nome: p.nome, email: p.email || '', orgId: p.org.id, cargo, area: 'P&D e inovação', tratamento: 'Prezado(a)',
    fonte: p.tipo === 'lideranca' ? `Liderança citada em ${p.url}` : `Produção científica (OpenAlex${p.orcid ? ', ORCID ' + p.orcid : ''})`,
    linkedin: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(p.nome + ' ' + (p.org.nomeFantasia || p.org.nome))}`,
    optout: p.email ? store.suprimido(p.email) : false, tags: ['P&D'],
  }, 'ct');
}

const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return 'fonte pública'; } };
const linkedin = p => `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(p.nome + ' ' + (p.org.nomeFantasia || p.org.nome))}`;
/** Linha de uma pessoa: nome, cargo ou temas, trabalho de destaque e ações. */
export function linhaPessoa(p, { comOrg = false } = {}) {
  const perfil = p.orcid ? `https://orcid.org/${p.orcid}` : p.id && !p.id.startsWith('l-') ? `https://openalex.org/${p.id}` : p.url;
  const ja = jaContato(p);
  return `<div class="pessoa" data-pid="${esc(p.id)}" data-org="${esc(p.org.id)}">
    <div class="quem"><a class="nome" href="${esc(perfil)}" target="_blank" rel="noopener">${esc(p.nome)}</a>${p.quantico ? '<span class="q" title="Publica sobre computação quântica">quântica</span>' : ''}
      <div class="meta">${comOrg ? `<a href="#/org/${esc(p.org.id)}">${esc(p.org.nomeFantasia || p.org.nome)}</a> · ` : ''}${esc(p.cargo || (p.temas || []).join(', ') || (p.tipo === 'lideranca' ? 'Liderança de P&D e inovação' : ''))}</div></div>
    <div class="obra">${p.destaque ? `<a href="${esc(p.destaque.url)}" target="_blank" rel="noopener">${esc(p.destaque.titulo)}</a><span class="muted"> ${p.destaque.ano || ''}</span>` : p.tipo === 'lideranca' ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">Citado em ${esc(host(p.url))}</a>` : ''}
      ${p.trabalhos ? `<div class="meta">${p.trabalhos} trabalho(s) desde ${new Date().getFullYear() - 6}${p.email ? ` · ${esc(p.email)}` : ''}</div>` : p.email ? `<div class="meta">${esc(p.email)}</div>` : ''}</div>
    <div class="acoes-p"><a class="btn sm ghost" href="${esc(linkedin(p))}" target="_blank" rel="noopener">LinkedIn</a>${ja ? '<span class="muted small">no CRM</span>' : '<button class="btn sm" data-add>Adicionar</button>'}</div>
  </div>`;
}
/** Liga os botões "Adicionar" de uma lista de pessoas. */
export function ligarPessoas(raiz, lista, aoMudar) {
  raiz.querySelectorAll('[data-add]').forEach(b => b.onclick = () => {
    const el = b.closest('.pessoa'), p = lista.find(x => x.id === el.dataset.pid && x.org.id === el.dataset.org);
    if (p && adicionarContato(p)) { toast(`${p.nome} entrou nos contatos de ${p.org.nomeFantasia || p.org.nome}.`, 'ok'); aoMudar?.(); }
  });
}
