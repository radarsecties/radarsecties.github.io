// Fila de envio de campanhas pelo Gmail: ritmo controlado, limite diário, pausa/retomada, registro por destinatário
import * as store from './store.js';
import * as G from './google.js';
import { podeAutomatizar } from './sync.js';
import { compose, buildMime, loadMecanismos } from './email.js';
import { isEmail, norm, sleep, toast, isoDay } from './util.js';

let running = null; // { campId, pause:boolean, cancel:boolean }
const subs = new Set();
export const onProgress = fn => (subs.add(fn), () => subs.delete(fn));
const emit = (campId, msg) => subs.forEach(f => f(campId, msg));
export const isRunning = id => running && (!id || running.campId === id);

export function enviadosHoje() {
  const d = isoDay();
  return store.list('envios').filter(e => e.status === 'enviado' && (e.data || '').startsWith(d)).length;
}

async function attachmentsFor(camp) {
  const out = [];
  for (const id of camp.materiais || []) {
    const m = store.get('materiais', id);
    if (!m?.arquivoId || !camp.anexarArquivos) continue;
    const f = await store.fileGet(m.arquivoId);
    if (!f) continue;
    const buf = await f.blob.arrayBuffer();
    let bin = ''; const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    out.push({ name: f.name, type: f.type, base64: btoa(bin) });
  }
  return out;
}

export function destinatarios(camp) {
  const seen = new Set();
  return (camp.destinatarios || []).map(id => store.get('contatos', id)).filter(Boolean).map(c => {
    const e = norm(c.email);
    let motivo = '';
    if (!isEmail(c.email)) motivo = 'e-mail inválido';
    else if (c.optout || store.suprimido(c.email)) motivo = 'descadastrado';
    else if (seen.has(e)) motivo = 'duplicado';
    seen.add(e);
    return { contato: c, motivo };
  });
}

export async function run(campId) {
  if (running) { toast('Já há uma campanha em envio. Aguarde ou pause.', 'bad'); return; }
  const camp = store.get('campanhas', campId); if (!camp) return;
  const conf = store.cfg();
  const modo = camp.modo === 'rascunho' ? 'rascunho' : 'enviar';
  if (modo === 'rascunho' && !G.hasScope('compose')) { toast('Para criar rascunhos, ative essa permissão em Configurações e reconecte a conta Google.', 'bad'); return; }
  if (!G.status().conectado) await G.connect();
  await loadMecanismos();

  running = { campId, pause: false, cancel: false };
  camp.status = 'enviando'; camp.iniciadaEm ||= new Date().toISOString(); store.touch('campanhas');
  emit(campId, { tipo: 'inicio' });

  const materiais = (camp.materiais || []).map(id => store.get('materiais', id)).filter(Boolean);
  let anexos = [];
  try { anexos = await attachmentsFor(camp); } catch (e) { console.warn(e); }
  const ja = new Set(store.list('envios').filter(e => e.campanhaId === campId && ['enviado', 'rascunho'].includes(e.status)).map(e => e.contatoId));
  const fila = destinatarios(camp);
  const intervalo = Math.max(1, Number(conf.intervaloSeg) || 5) * 1000;
  const limite = Number(conf.limiteDiario) || 400;
  const me = G.status().email;

  for (const { contato, motivo } of fila) {
    if (running.cancel) break;
    while (running.pause && !running.cancel) await sleep(400);
    if (running.cancel) break;
    if (ja.has(contato.id)) continue;
    if (motivo) {
      store.upsert('envios', { campanhaId: campId, contatoId: contato.id, email: contato.email, status: 'ignorado', erro: motivo, data: new Date().toISOString() }, 'env');
      emit(campId, { tipo: 'item', contato, status: 'ignorado', erro: motivo }); continue;
    }
    if (modo === 'enviar' && enviadosHoje() >= limite) {
      toast(`Limite diário de ${limite} envios atingido. A campanha foi pausada; retome amanhã.`, 'bad');
      camp.status = 'pausada'; store.touch('campanhas'); break;
    }
    const { subject, html } = compose(camp, contato, { materiais });
    const raw = buildMime({ to: contato.email, toName: contato.nome, from: me, fromName: conf.remetenteNome, replyTo: conf.replyTo, cc: camp.cc, subject, html, attachments: anexos });
    try {
      const r = modo === 'rascunho' ? await G.draftRaw(raw) : await G.sendRaw(raw);
      const msg = modo === 'rascunho' ? r.message : r;
      store.upsert('envios', { campanhaId: campId, contatoId: contato.id, email: contato.email, status: modo === 'rascunho' ? 'rascunho' : 'enviado', messageId: msg?.id, threadId: msg?.threadId, assunto: subject, data: new Date().toISOString() }, 'env');
      if (modo === 'enviar') {
        store.logInteracao({ orgId: contato.orgId, contatoId: contato.id, tipo: 'email', titulo: subject, descricao: `Campanha: ${camp.nome}`, campanhaId: campId, threadId: msg?.threadId });
        const org = store.orgOf(contato);
        if (org && (!org.relacionamento || org.relacionamento === 'mapeada')) { org.relacionamento = 'contato'; store.touch('orgs'); }
      }
      emit(campId, { tipo: 'item', contato, status: modo === 'rascunho' ? 'rascunho' : 'enviado' });
    } catch (e) {
      store.upsert('envios', { campanhaId: campId, contatoId: contato.id, email: contato.email, status: 'erro', erro: e.message, data: new Date().toISOString() }, 'env');
      emit(campId, { tipo: 'item', contato, status: 'erro', erro: e.message });
      if (e.status === 403 || e.status === 401) { toast('Gmail recusou o envio: ' + e.message, 'bad'); camp.status = 'pausada'; store.touch('campanhas'); break; }
    }
    await sleep(intervalo);
  }
  if (camp.status === 'enviando') camp.status = running.cancel ? 'pausada' : 'concluida';
  if (camp.status === 'concluida') camp.concluidaEm = new Date().toISOString();
  store.touch('campanhas');
  running = null;
  emit(campId, { tipo: 'fim' });
  toast(`Campanha "${camp.nome}": ${camp.status === 'concluida' ? 'concluída' : 'pausada'}.`, 'ok');
}

export function pause(on = true) { if (running) { running.pause = on; emit(running.campId, { tipo: on ? 'pausa' : 'retoma' }); } }
export function cancel() { if (running) running.cancel = true; }

/** Verifica respostas no Gmail para envios com threadId. */
export async function checkReplies(campId) {
  if (!G.hasScope('read')) throw new Error('Ative a leitura do Gmail em Configurações e reconecte a conta Google.');
  const envios = store.list('envios').filter(e => e.threadId && e.status === 'enviado' && !e.respondido && (!campId || e.campanhaId === campId));
  let n = 0;
  for (const e of envios) {
    try {
      if (await G.threadHasReply(e.threadId)) {
        e.respondido = true; n++;
        const c = store.get('contatos', e.contatoId);
        if (c) store.logInteracao({ orgId: c.orgId, contatoId: c.id, tipo: 'email', titulo: 'Resposta recebida', descricao: e.assunto || '', threadId: e.threadId });
      }
      e.verificadoEm = new Date().toISOString();
    } catch (err) { console.warn(err); }
    await sleep(150);
  }
  store.touch('envios');
  return { verificados: envios.length, respostas: n };
}

// Agendador: dispara campanhas agendadas enquanto o app estiver aberto
setInterval(() => {
  if (running || !G.status().conectado || !podeAutomatizar()) return;
  const due = store.list('campanhas').find(c => c.status === 'agendada' && c.agendadaPara && new Date(c.agendadaPara) <= new Date());
  if (due) { toast(`Iniciando campanha agendada: ${due.nome}`); run(due.id); }
}, 30000);
