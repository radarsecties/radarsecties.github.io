// Programa de parceiros do CIQUANTA: cotas anuais com contrapartidas, adesões e receita recorrente.
import * as store from '../store.js';
import { esc, money, num, pct, modal, formData, options, toast, fmtDate, isoDay, abrirJanela, mostrarDocumento, MESES_LONGOS } from '../util.js';
import { icon } from '../icons.js';
import { segBadge } from '../components.js';
import { pontuar, contexto } from '../score.js';
import { compactoBR as compacto } from '../motion.js';

export const COTAS_PADRAO = [
  { id: 'fundador', nome: 'Fundador', valor: 2000000, vagas: 3, c1: '#0F1A36', c2: '#2B4CC8', beneficios: ['Assento no conselho consultivo', '400 horas de processador quântico por ano', 'Projeto de P&D dedicado', 'Marca nos espaços do centro'] },
  { id: 'estrategico', nome: 'Estratégico', valor: 750000, vagas: 8, c1: '#2B4CC8', c2: '#5B7CFA', beneficios: ['150 horas de processador quântico', 'Laboratório conjunto', 'Dois eventos exclusivos por ano', 'Capacitação para 20 pessoas'] },
  { id: 'associado', nome: 'Associado', valor: 200000, vagas: 20, c1: '#1D84B5', c2: '#2BB6D9', beneficios: ['40 horas de processador quântico', 'Vagas nos cursos do centro', 'Convites para a agenda institucional'] },
  { id: 'startup', nome: 'Deep tech', valor: 24000, vagas: 30, c1: '#0E8A68', c2: '#2BB6D9', beneficios: ['10 horas de processador quântico', 'Mentoria técnica', 'Vitrine no hall de exposição'] },
];
export const cotas = () => store.cfg().cotas?.length ? store.cfg().cotas : COTAS_PADRAO;
const ST = { negociacao: ['Em negociação', 'warn'], ativa: ['Ativa', 'ok'], encerrada: ['Encerrada', 'gray'] };

function formAdesao(a = {}, depois) {
  const orgs = [...store.list('orgs')].sort((x, y) => x.nome.localeCompare(y.nome));
  const cs = cotas(), hoje = isoDay();
  const { el, close } = modal({ title: a.id ? 'Adesão' : 'Nova adesão', body: `<form id="f" class="form-grid">
    <label class="field full">Organização<select name="orgId" required>${options(orgs.map(o => ({ id: o.id, nome: o.nome })), a.orgId, { empty: 'Escolha…' })}</select></label>
    <label class="field">Cota<select name="cota">${options(cs.map(c => ({ id: c.id, nome: `${c.nome} · ${money(c.valor)}` })), a.cota || cs[1]?.id)}</select></label>
    <label class="field">Valor anual (R$)<input type="number" name="valor" min="0" step="1000" value="${esc(a.valor ?? '')}" placeholder="valor da cota"></label>
    <label class="field">Situação<select name="status">${options(Object.entries(ST).map(([id, [nome]]) => ({ id, nome })), a.status || 'negociacao')}</select></label>
    <label class="field">Início<input type="date" name="inicio" value="${esc(a.inicio || hoje)}"></label>
    <label class="field full">Observações<textarea name="notas">${esc(a.notas || '')}</textarea></label></form>`,
    footer: `${a.id ? '<button class="btn danger ghost" id="del" style="margin-right:auto">Excluir</button><button class="btn" id="prop">Carta de adesão</button>' : ''}<button class="btn" data-close>Cancelar</button><button class="btn primary" id="ok">Salvar</button>`,
    onMount: (m, fechar) => {
      m.querySelector('#ok').onclick = () => {
        const f = m.querySelector('#f'); if (!f.reportValidity()) return;
        const d = formData(f), cota = cs.find(c => c.id === d.cota);
        d.valor = Number(d.valor) || cota?.valor || 0;
        const ini = new Date(d.inicio + 'T12:00:00'); ini.setFullYear(ini.getFullYear() + 1); d.renovacao = ini.toISOString().slice(0, 10);
        const salvo = store.upsert('adesoes', { ...a, ...d }, 'ade');
        const org = store.get('orgs', d.orgId);
        if (d.status === 'ativa' && org) org.relacionamento = 'parceira';
        sincronizarOportunidade(salvo); store.touch('orgs');
        toast('Adesão salva.', 'ok'); fechar(); depois();
      };
      m.querySelector('#del')?.addEventListener('click', () => { fechar(); store.removerComDesfazer('adesoes', a.id, 'Adesão', depois); depois(); });
      m.querySelector('#prop')?.addEventListener('click', () => carta(a));
    } });
  return { el, close };
}

/** Cada adesão em negociação vira uma oportunidade no funil, para entrar na previsão de captação. */
function sincronizarOportunidade(a) {
  const cota = cotas().find(c => c.id === a.cota), org = store.get('orgs', a.orgId); if (!org) return;
  const etapa = a.status === 'ativa' ? 'contratada' : a.status === 'encerrada' ? 'perdida' : 'negociacao';
  const prob = { contratada: 100, perdida: 0, negociacao: 70 }[etapa];
  const op = store.list('oportunidades').find(o => o.adesaoId === a.id);
  store.upsert('oportunidades', { ...(op || {}), adesaoId: a.id, orgId: a.orgId, setor: org.setor, titulo: `Programa de parceiros: cota ${cota?.nome || a.cota}`, etapa, probabilidade: prob, valor: a.valor, modalidade: 'patrocinio', previsao: a.inicio, responsavel: op?.responsavel || 'Relações institucionais' }, 'opp');
}

function carta(a) {
  const w = abrirJanela(); if (!w) return;
  const org = store.get('orgs', a.orgId) || {}, cota = cotas().find(c => c.id === a.cota) || {}, d = new Date(), c = store.cfg();
  const base = new URL('.', location.href).href;
  mostrarDocumento(w, `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Carta de adesão · ${esc(org.nome || '')}</title>
<style>@page{size:A4;margin:18mm}body{font:11pt/1.55 Arial,sans-serif;color:#0F1A36;margin:0}@media screen{body{max-width:210mm;margin:60px auto;padding:0 18mm}}
header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #3056D5;padding-bottom:12px;margin-bottom:24px}header img{height:22px}
h1{font-size:20pt;margin:0 0 4px}.k{color:#3056D5;font-weight:700;font-size:10pt;letter-spacing:.06em;text-transform:uppercase}.box{background:#EEF2FB;border-radius:10px;padding:14px 18px;margin:16px 0}
.v{font-size:22pt;font-weight:700;color:#3056D5}ul{padding-left:18px}.barra{position:fixed;top:0;left:0;right:0;background:#0F1A36;color:#fff;padding:10px 16px;font:13px Arial;display:flex}.barra button{margin-left:auto;border:0;border-radius:6px;background:#3056D5;color:#fff;padding:6px 14px;cursor:pointer}@media print{.barra{display:none}}</style></head><body>
<div class="barra">Carta de adesão ao Programa de Parceiros<button data-imprimir>Salvar em PDF ou imprimir</button></div>
<header><img src="${base}assets/logo-azul.png" alt="CIQUANTA"><img src="${base}assets/secties-govpb.png" alt="SECTIES, Governo da Paraíba"></header>
<div class="k">Programa de Parceiros CIQUANTA · ${d.getDate()} de ${MESES_LONGOS[d.getMonth()]} de ${d.getFullYear()}</div>
<h1>${esc(org.nome || '')}</h1><p>Cota <b>${esc(cota.nome || '')}</b>, com vigência de doze meses a partir de ${fmtDate(a.inicio)}.</p>
<div class="box"><div class="k">Contribuição anual</div><div class="v">${money(a.valor)}</div></div>
<p><b>Contrapartidas</b></p><ul>${(cota.beneficios || []).map(b => `<li>${esc(b)}</li>`).join('')}</ul>
<p>Os recursos apoiam a operação e a pesquisa aplicada do Centro Internacional de Computação e Tecnologias Quânticas do Estado da Paraíba. O instrumento jurídico (termo de parceria, convênio ou acordo de cooperação) define as condições finais, inclusive o uso de incentivos como a Lei do Bem.</p>
<p style="margin-top:40px">${esc(c.remetenteNome || 'Relações institucionais')}${c.remetenteCargo ? `<br>${esc(c.remetenteCargo)}` : ''}<br>CIQUANTA · ${esc(c.replyTo || 'ciquanta@secties.pb.gov.br')}</p></body></html>`);
}

function formCotas(depois) {
  const cs = cotas();
  modal({ title: 'Cotas do programa', wide: true, body: `<form id="f" class="grid g2">${cs.map((c, i) => `<div class="card" style="box-shadow:none;border:1px solid var(--line)"><div class="form-grid">
    <label class="field">Nome<input name="nome${i}" value="${esc(c.nome)}"></label><label class="field">Valor anual (R$)<input type="number" name="valor${i}" min="0" step="1000" value="${c.valor}"></label>
    <label class="field">Vagas<input type="number" name="vagas${i}" min="1" value="${c.vagas}"></label><span></span>
    <label class="field full">Contrapartidas (uma por linha)<textarea name="ben${i}">${esc(c.beneficios.join('\n'))}</textarea></label></div></div>`).join('')}</form>`,
    footer: '<button class="btn ghost" id="pad" style="margin-right:auto">Restaurar padrão</button><button class="btn" data-close>Cancelar</button><button class="btn primary" id="ok">Salvar cotas</button>',
    onMount: (m, fechar) => {
      m.querySelector('#ok').onclick = () => { const d = formData(m.querySelector('#f')); store.setConfig({ cotas: cs.map((c, i) => ({ ...c, nome: d['nome' + i] || c.nome, valor: Number(d['valor' + i]) || 0, vagas: Number(d['vagas' + i]) || 1, beneficios: String(d['ben' + i] || '').split('\n').map(x => x.trim()).filter(Boolean) })) }); toast('Cotas salvas.', 'ok'); fechar(); depois(); };
      m.querySelector('#pad').onclick = () => { store.setConfig({ cotas: [] }); fechar(); depois(); };
    } });
}

export async function render(view) {
  let filtro = '';
  const draw = () => {
    const ads = store.list('adesoes'), cs = cotas(), hoje = isoDay();
    const ativas = ads.filter(a => a.status === 'ativa'), neg = ads.filter(a => a.status === 'negociacao');
    const arr = ativas.reduce((s, a) => s + (Number(a.valor) || 0), 0), pipe = neg.reduce((s, a) => s + (Number(a.valor) || 0), 0);
    const em90 = new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10);
    const renov = ativas.filter(a => a.renovacao && a.renovacao <= em90);
    const potencial = cs.reduce((s, c) => s + c.valor * c.vagas, 0);
    const membros = new Set(ads.filter(a => a.status !== 'encerrada').map(a => a.orgId)), ctx = contexto();
    const cand = store.list('orgs').filter(o => !membros.has(o.id) && ['Empresa', 'Startup', 'Investidor'].includes(o.segmento))
      .map(o => ({ o, p: pontuar(o, ctx).total })).sort((a, b) => b.p - a.p).slice(0, 8);
    const sugestao = o => o.segmento === 'Startup' ? 'startup' : o.prioridade === 'A' ? 'estrategico' : 'associado';
    const lista = ads.filter(a => !filtro || a.cota === filtro).sort((a, b) => (b.valor || 0) - (a.valor || 0));
    view.innerHTML = `<div class="section-head"><div><h2>Programa de parceiros</h2></div>
      <div class="toolbar" style="margin:0"><button class="btn" id="cotas">${icon('config', 15)} Cotas</button><button class="btn primary" id="nova">${icon('mais', 15)} Nova adesão</button></div></div>
      <div class="grid g4" style="margin-bottom:18px">
        <div class="kpi"><span class="label">Receita recorrente anual</span><span class="value" data-contar="${arr}" data-formato="moeda">${compacto(arr)}</span><span class="sub">${ativas.length} parceiro(s) ativo(s)</span></div>
        <div class="kpi"><span class="label">Em negociação</span><span class="value" data-contar="${pipe}" data-formato="moeda">${compacto(pipe)}</span><span class="sub">${neg.length} adesão(ões)</span></div>
        <div class="kpi"><span class="label">Capacidade do programa</span><span class="value">${compacto(potencial)}</span><span class="sub">${pct(arr, potencial)}% ocupada</span></div>
        <div class="kpi"><span class="label">Renovações em 90 dias</span><span class="value" data-contar="${renov.length}">${renov.length}</span><span class="sub">${renov.length ? compacto(renov.reduce((s, a) => s + a.valor, 0)) + ' a renovar' : 'nenhuma pendente'}</span></div>
      </div>
      <div class="cotas" style="margin-bottom:18px">${cs.map(c => { const n = ads.filter(a => a.cota === c.id && a.status === 'ativa').length; return `<button class="cota" data-cota="${esc(c.id)}" style="--c1:${c.c1 || '#2B4CC8'};--c2:${c.c2 || '#5B7CFA'};text-align:left;border:0;cursor:pointer;font:inherit;${filtro && filtro !== c.id ? 'opacity:.45' : ''}">
        <span class="nome">${esc(c.nome)}</span><span class="preco">${compacto(c.valor)} <small>por ano</small></span><span class="vagas">${n} de ${c.vagas} vagas ocupadas</span>
        <ul>${c.beneficios.slice(0, 4).map(b => `<li>${esc(b)}</li>`).join('')}</ul></button>`; }).join('')}</div>
      <div class="grid split-21">
        <div>${lista.length ? `<div class="table-wrap"><table><thead><tr><th>Organização</th><th>Cota</th><th class="num">Valor anual</th><th>Situação</th><th>Renovação</th></tr></thead><tbody>${lista.map(a => { const o = store.get('orgs', a.orgId) || {}, c = cs.find(x => x.id === a.cota); return `<tr class="row-link" data-id="${esc(a.id)}"><td class="title">${esc(o.nome || '—')}</td><td>${esc(c?.nome || a.cota)}</td><td class="num">${money(a.valor)}</td><td><span class="badge ${ST[a.status]?.[1] || 'gray'}">${ST[a.status]?.[0] || a.status}</span></td><td class="nowrap ${a.renovacao && a.renovacao <= em90 && a.status === 'ativa' ? '' : 'muted'}">${a.renovacao ? fmtDate(a.renovacao) : '—'}</td></tr>`; }).join('')}</tbody></table></div>` : '<div class="card"><div class="empty">Nenhuma adesão registrada.</div></div>'}</div>
        <div class="card"><h3>Candidatas <span class="muted">por potencial</span></h3><div class="list">${cand.map(({ o, p }) => `<div class="list-item"><div style="flex:1;min-width:0"><a class="title" href="#/org/${esc(o.id)}">${esc(o.nomeFantasia || o.nome)}</a><div class="meta">${segBadge(o.segmento)} <span class="pot"><i><b style="width:${p}%"></b></i>${p}</span></div></div><button class="btn sm" data-propor="${esc(o.id)}" data-sug="${sugestao(o)}">Propor</button></div>`).join('') || '<div class="empty">Sem candidatas.</div>'}</div></div>
      </div>`;
    view.querySelector('#nova').onclick = () => formAdesao({}, draw);
    view.querySelector('#cotas').onclick = () => formCotas(draw);
    view.querySelectorAll('[data-cota]').forEach(b => b.onclick = () => { filtro = filtro === b.dataset.cota ? '' : b.dataset.cota; draw(); });
    view.querySelector('tbody')?.addEventListener('click', e => { const tr = e.target.closest('[data-id]'); if (tr) formAdesao(store.get('adesoes', tr.dataset.id), draw); });
    view.querySelectorAll('[data-propor]').forEach(b => b.onclick = () => { const c = cs.find(x => x.id === b.dataset.sug) || cs[0]; formAdesao({ orgId: b.dataset.propor, cota: c.id, valor: c.valor, status: 'negociacao' }, draw); });
  };
  draw();
}
