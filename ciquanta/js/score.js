// Pontuação de potencial das organizações e recomendação de próximas ações
import * as store from './store.js';
import { REGIAO, isEmail, isoDay } from './util.js';
import { citadasRecentes } from './sinais.js';

const OBRIGATORIOS = ['pdi-aneel', 'pdi-anp', 'lei-de-tics', 'lei-tics-zfm', 'brasil-semicon', 'mover', 'redata'];

/** Pontuação de 0 a 100, com os motivos. Critérios fixos e visíveis para a equipe. */
export function pontuar(o, ctx = contexto()) {
  const m = [];
  const add = (pts, txt) => { if (pts) m.push([pts, txt]); };
  add({ confirmada: 25, indicios: 15 }[o.evidencia] || 5, { confirmada: 'Atuação quântica confirmada', indicios: 'Indícios públicos de interesse' }[o.evidencia] || 'Perfil compatível de P&D');
  add({ A: 15, B: 8, C: 3 }[o.prioridade] || 5, `Prioridade ${o.prioridade || 'B'}`);
  if ((o.mecanismos || []).some(x => OBRIGATORIOS.includes(x))) add(15, 'Obrigação ou compromisso de PD&I vinculado a incentivo ou regulação');
  if (store.setoresLista().find(s => s.id === o.setor)?.estrategico) add(10, 'Setor de aplicação estratégica do centro');
  if (REGIAO[o.uf] === 'Nordeste') add(5, 'Sediada no Nordeste');
  if (ctx.comEmail.has(o.id)) add(8, 'Contato com e-mail cadastrado');
  if (o.ultimaResposta || ctx.respondeu.has(o.id)) add(12, 'Já respondeu a mensagens');
  add({ engajada: 6, parceira: 10 }[o.relacionamento] || 0, o.relacionamento === 'parceira' ? 'Parceira' : 'Relacionamento engajado');
  if (ctx.comOpp.has(o.id)) add(10, 'Oportunidade em aberto');
  if (ctx.citadas?.has(o.id)) add(5, 'Citada em notícia recente');
  const total = Math.min(100, m.reduce((a, x) => a + x[0], 0));
  return { total, faixa: total >= 65 ? 'alto' : total >= 40 ? 'medio' : 'baixo', motivos: m };
}

export function contexto() {
  const comEmail = new Set(store.list('contatos').filter(c => isEmail(c.email) && !c.optout).map(c => c.orgId));
  const respondeu = new Set(store.list('recebidos').filter(r => r.direcao === 'entrada').map(r => r.orgId));
  const comOpp = new Set(store.list('oportunidades').filter(o => !['contratada', 'perdida'].includes(o.etapa)).map(o => o.orgId));
  return { comEmail, respondeu, comOpp, citadas: citadasRecentes(30) };
}

/** Lista priorizada do que fazer agora. Cada item: { peso, titulo, detalhe, href, tipo }. */
export function proximasAcoes(limite = 8) {
  const ctx = contexto(), hoje = isoDay(), agora = Date.now(), out = [];
  const orgs = store.list('orgs'), nome = o => o.nomeFantasia || o.nome;
  const naoLidos = store.list('recebidos').filter(r => !r.lido && r.direcao === 'entrada');
  if (naoLidos.length) out.push({ peso: 100, tipo: 'Responder', titulo: `${naoLidos.length} mensagem(ns) recebida(s) sem leitura`, detalhe: naoLidos.slice(0, 3).map(r => r.nome || r.email).join(', '), href: '#/interacoes' });
  for (const op of store.list('oportunidades')) {
    if (['contratada', 'perdida'].includes(op.etapa)) continue;
    const o = store.get('orgs', op.orgId); if (!o) continue;
    if (op.proximoEm && op.proximoEm < hoje) out.push({ peso: 90, tipo: 'Atrasado', titulo: `${op.proximoPasso || op.titulo}`, detalhe: `${nome(o)}: próximo passo vencido`, href: `#/org/${o.id}?aba=oportunidades` });
    else if (agora - new Date(op.atualizadoEm || op.criadoEm).getTime() > 14 * 864e5) out.push({ peso: 60 + store.pipelineValor(op) / 1e6, tipo: 'Retomar', titulo: `Oportunidade parada há mais de 14 dias: ${op.titulo}`, detalhe: nome(o), href: `#/org/${o.id}?aba=oportunidades` });
    if (['proposta', 'negociacao'].includes(op.etapa) && !op.propostaEm) out.push({ peso: 80, tipo: 'Proposta', titulo: `Gerar proposta: ${op.titulo}`, detalhe: nome(o), href: `#/org/${o.id}?aba=oportunidades` });
  }
  for (const ed of store.list('editais')) if (ed.prazo && ed.prazo >= hoje && ['aberto', 'preparacao'].includes(ed.status) && (new Date(ed.prazo) - agora) < 21 * 864e5) out.push({ peso: 85, tipo: 'Edital', titulo: `Prazo em ${ed.prazo.split('-').reverse().join('/')}: ${ed.titulo}`, detalhe: ed.orgao || '', href: '#/editais' });
  const inscritos = new Set(store.list('inscricoes').filter(i => i.status === 'ativa').map(i => store.get('contatos', i.contatoId)?.orgId));
  const contatada = new Set(store.list('envios').filter(e => e.status === 'enviado').map(e => store.get('contatos', e.contatoId)?.orgId));
  const pont = orgs.map(o => [o, pontuar(o, ctx)]).sort((a, b) => b[1].total - a[1].total);
  let semContato = 0, semCadencia = 0, semOpp = 0;
  for (const [o, p] of pont) {
    if (p.total < 45) break;
    if (!ctx.comEmail.has(o.id)) { if (semContato++ < 3) out.push({ peso: 40 + p.total / 5, tipo: 'Contato', titulo: `Encontrar contato em ${nome(o)}`, detalhe: `Potencial ${p.total}: ainda sem contato com e-mail`, href: `#/org/${o.id}?aba=busca` }); }
    else if (!contatada.has(o.id) && !inscritos.has(o.id)) { if (semCadencia++ < 3) out.push({ peso: 55 + p.total / 5, tipo: 'Cadência', titulo: `Iniciar contato com ${nome(o)}`, detalhe: `Potencial ${p.total}: contato cadastrado, sem abordagem`, href: '#/cadencias' }); }
    else if ((o.relacionamento === 'engajada' || ctx.respondeu.has(o.id)) && !ctx.comOpp.has(o.id) && o.relacionamento !== 'parceira') { if (semOpp++ < 3) out.push({ peso: 75, tipo: 'Oportunidade', titulo: `Registrar oportunidade com ${nome(o)}`, detalhe: 'Organização engajada, sem oportunidade em aberto', href: `#/org/${o.id}?aba=agenda` }); }
  }
  return out.sort((a, b) => b.peso - a.peso).slice(0, limite);
}

/** Receita por fonte, conforme a política de sustentabilidade do centro. */
export function receitaPorFonte() {
  const fonte = m => m === 'institucional' ? 'Financiamento público estruturante' : m === 'patrocinio' ? 'Parcerias e patrocínios' : 'Receita contratual de projetos';
  const g = {};
  for (const op of store.list('oportunidades')) {
    if (op.etapa === 'perdida') continue;
    const k = fonte(op.modalidade); g[k] ||= { contratado: 0, ponderado: 0 };
    if (op.etapa === 'contratada') g[k].contratado += Number(op.valor) || 0; else g[k].ponderado += store.pipelineValor(op);
  }
  return g;
}
