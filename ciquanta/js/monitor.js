// Acompanhamento em tempo real das interações por e-mail na conta Google do CIQUANTA.
// Usa o histórico do Gmail (history.list) a cada N segundos enquanto o sistema estiver aberto.
import * as store from './store.js';
import * as G from './google.js';
import { toast } from './util.js';
import { marcarResposta } from './cadencia.js';
import { podeAutomatizar } from './sync.js';

let timer = null, rodando = false, ultimo = null, erro = '';
const subs = new Set();
export const onLive = fn => (subs.add(fn), () => subs.delete(fn));
const emit = ev => subs.forEach(f => { try { f(ev); } catch (e) { console.error(e); } });
export const estado = () => ({ ativo: !!timer, ultimo, erro, naoLidos: store.list('recebidos').filter(r => !r.lido).length });

export function iniciar() {
  if (timer || !G.hasScope('read')) return false;
  const seg = Math.max(15, Number(store.cfg().monitorSeg) || 30);
  timer = setInterval(ciclo, seg * 1000);
  ciclo();
  emit({ tipo: 'estado' });
  return true;
}
export function parar() { clearInterval(timer); timer = null; emit({ tipo: 'estado' }); }

async function ciclo() {
  if (rodando || !G.status().conectado || !podeAutomatizar()) return;
  rodando = true;
  try {
    let hid = store.cfg().historyId;
    if (!hid) { const p = await G.freshProfile(); store.setConfig({ historyId: p.historyId }); hid = p.historyId; }
    let r;
    try { r = await G.history(hid); }
    catch (e) {
      if (e.status === 404) { const p = await G.freshProfile(); store.setConfig({ historyId: p.historyId }); rodando = false; return; }
      throw e;
    }
    const ids = new Set();
    (r.history || []).forEach(h => (h.messagesAdded || []).forEach(m => ids.add(m.message.id)));
    for (const id of ids) await processar(id, { aoVivo: true });
    if (r.historyId) store.setConfig({ historyId: r.historyId });
    ultimo = new Date().toISOString(); erro = '';
  } catch (e) { erro = e.message; console.warn('monitor', e); }
  rodando = false;
  emit({ tipo: 'ciclo' });
}

/** Processa uma mensagem do Gmail: vincula ao CRM, registra a interação e avisa a equipe. */
export async function processar(id, { aoVivo = false } = {}) {
  if (store.list('recebidos').some(r => r.id === id) || store.list('envios').some(e => e.messageId === id)) return null;
  const m = await G.messageMeta(id);
  const labels = m.labelIds || [];
  if (labels.includes('SPAM') || labels.includes('TRASH') || labels.includes('CHAT')) return null;
  const enviado = labels.includes('SENT');
  const me = (G.status().email || '').toLowerCase();
  const de = G.parseAddr(G.header(m, 'From'))[0] || {};
  const para = [...G.parseAddr(G.header(m, 'To')), ...G.parseAddr(G.header(m, 'Cc'))].filter(a => a.email !== me);
  const assunto = G.header(m, 'Subject') || '(sem assunto)';
  const data = m.internalDate ? new Date(Number(m.internalDate)).toISOString() : new Date().toISOString();

  if (enviado) {
    // E-mail enviado diretamente pelo Gmail para alguém do CRM: registra no histórico
    for (const a of para) {
      const { contato, org } = store.matchEmail(a.email);
      if (!org) continue;
      store.list('recebidos').push({ id, threadId: m.threadId, direcao: 'saida', email: a.email, nome: a.nome, assunto, snippet: m.snippet || '', data, orgId: org.id, contatoId: contato?.id || '', lido: true });
      store.logInteracao({ orgId: org.id, contatoId: contato?.id || '', tipo: 'email', titulo: assunto, descricao: 'Enviado pelo Gmail', data, threadId: m.threadId, messageId: id });
      if (!org.relacionamento || org.relacionamento === 'mapeada') org.relacionamento = 'contato';
      store.touch('recebidos'); store.touch('orgs');
      return { saida: true, org };
    }
    return null;
  }
  if (!de.email || de.email === me) return null;
  const { contato, org } = store.matchEmail(de.email);
  const envio = store.list('envios').find(e => e.threadId && e.threadId === m.threadId);
  if (!org && !envio) return null;
  const orgF = org || store.orgOf(store.get('contatos', envio?.contatoId));
  let novoContato = null;
  if (!contato && orgF && store.cfg().autoGmailContatos && !store.list('contatos').some(c => (c.email || '').toLowerCase() === de.email.toLowerCase())) {
    novoContato = store.upsert('contatos', { nome: de.nome || de.email.split('@')[0], email: de.email.toLowerCase(), orgId: orgF.id, cargo: '', tratamento: 'Prezado(a)', fonte: 'Resposta recebida no Gmail', tags: ['automático'], auto: true }, 'ct');
  }
  const item = { id, threadId: m.threadId, direcao: 'entrada', email: de.email, nome: de.nome, assunto, snippet: m.snippet || '', data, orgId: orgF?.id || '', contatoId: contato?.id || novoContato?.id || envio?.contatoId || '', lido: false, campanhaId: envio?.campanhaId || '' };
  store.list('recebidos').push(item);
  if (envio) envio.respondido = true;
  marcarResposta(item.contatoId, de.email);
  if (orgF) {
    store.logInteracao({ orgId: orgF.id, contatoId: item.contatoId, tipo: 'recebido', titulo: assunto, descricao: (m.snippet || '').slice(0, 280), data, threadId: m.threadId, messageId: id });
    if (!orgF.relacionamento || ['mapeada', 'contato'].includes(orgF.relacionamento)) orgF.relacionamento = 'engajada';
    orgF.ultimaResposta = data;
  }
  store.touch('recebidos'); store.touch('envios'); store.touch('orgs');
  if (aoVivo) avisar(item, orgF);
  emit({ tipo: 'novo', item });
  return item;
}

function avisar(item, org) {
  const quem = item.nome || item.email;
  toast(`Nova mensagem de ${quem}${org ? ` (${org.nomeFantasia || org.nome})` : ''}: ${item.assunto}`, 'ok');
  if (store.cfg().notificacoes && 'Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
    try { new Notification(`CIQUANTA · ${org ? org.nomeFantasia || org.nome : quem}`, { body: item.assunto, icon: 'assets/favicon.svg', tag: item.id }); } catch {}
  }
}

/** Varre os últimos dias da caixa para trazer ao CRM conversas anteriores com organizações cadastradas. */
export async function sincronizar(dias = 14, onProgresso) {
  if (!G.hasScope('read')) throw new Error('Conecte o e-mail do CIQUANTA em Configurações.');
  const l = await G.listMessages(`newer_than:${dias}d -in:chats -in:spam -in:trash`, 150);
  const msgs = l.messages || [];
  let vinculadas = 0;
  for (let i = 0; i < msgs.length; i++) {
    try { if (await processar(msgs[i].id)) vinculadas++; } catch (e) { console.warn(e); }
    onProgresso?.(i + 1, msgs.length);
  }
  if (!store.cfg().historyId) { const p = await G.freshProfile(); store.setConfig({ historyId: p.historyId }); }
  emit({ tipo: 'ciclo' });
  return { lidas: msgs.length, vinculadas };
}

export function marcarLidos(ids) { store.list('recebidos').forEach(r => { if (!ids || ids.includes(r.id)) r.lido = true; }); store.touch('recebidos'); emit({ tipo: 'lidos' }); }
