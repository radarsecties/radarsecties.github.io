// Cadências: sequências automáticas de e-mails por contato, que param quando há resposta ou descadastro.
// O motor roda enquanto o sistema estiver aberto com a conta Google conectada.
import * as store from './store.js';
import * as G from './google.js';
import { compose, buildMime, loadMecanismos } from './email.js';
import { enviadosHoje } from './runner.js';
import { isEmail, sleep, toast } from './util.js';
import * as sync from './sync.js';

let rodando = false, timer = null, ultimo = null;
const subs = new Set();
export const onCadencia = fn => (subs.add(fn), () => subs.delete(fn));
const emit = () => subs.forEach(f => { try { f(); } catch (e) { console.error(e); } });
export const estado = () => ({ ativo: !!timer, rodando, ultimo });

const now = () => new Date();
function dentroDoHorario(d = now()) { const dia = d.getDay(), h = d.getHours(); return dia >= 1 && dia <= 5 && h >= 8 && h < 18; }
/** Próximo horário válido: dias úteis, das 8h às 18h, quando a opção está ligada. */
export function proximoHorario(base, dias) {
  const d = new Date(base.getTime() + dias * 864e5);
  if (!store.cfg().horarioComercial) return d;
  if (dias > 0) d.setHours(9, 10 + Math.floor(Math.random() * 40), 0, 0);
  while (!dentroDoHorario(d)) { d.setHours(d.getHours() < 8 ? 9 : 33, 5, 0, 0); if (d.getDay() === 6) d.setDate(d.getDate() + 2); if (d.getDay() === 0) d.setDate(d.getDate() + 1); }
  return d;
}

export function inscrever(cadenciaId, contatoIds) {
  const cad = store.get('cadencias', cadenciaId); if (!cad?.passos?.length) return { novos: 0, ignorados: 0 };
  let novos = 0, ignorados = 0;
  for (const id of contatoIds) {
    const c = store.get('contatos', id);
    const ativo = store.list('inscricoes').some(i => i.contatoId === id && i.status === 'ativa');
    if (!c || !isEmail(c.email) || c.optout || store.suprimido(c.email) || ativo) { ignorados++; continue; }
    store.list('inscricoes').push({ id: 'ins-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), cadenciaId, contatoId: id, passo: 0, status: 'ativa', proximoEm: proximoHorario(now(), cad.passos[0].dias || 0).toISOString(), criadoEm: now().toISOString(), envios: [] });
    novos++;
  }
  store.touch('inscricoes'); emit();
  return { novos, ignorados };
}

export function marcarResposta(contatoId, email) {
  let n = 0;
  store.list('inscricoes').forEach(i => { const c = store.get('contatos', i.contatoId); if (i.status === 'ativa' && (i.contatoId === contatoId || (email && c?.email?.toLowerCase() === email))) { i.status = 'respondeu'; i.encerradaEm = now().toISOString(); n++; } });
  if (n) { store.touch('inscricoes'); emit(); }
  return n;
}

export async function ciclo({ manual = false } = {}) {
  if (rodando) return 0;
  const conf = store.cfg();
  if (!manual && (!conf.cadenciasAtivas || !sync.podeAutomatizar() || (conf.horarioComercial && !dentroDoHorario()))) return 0;
  if (!G.status().conectado) { if (manual) toast('Conecte a conta Google para executar as cadências.', 'bad'); return 0; }
  if (manual) await sync.sincronizar(); // traz o que outros computadores já enviaram
  rodando = true; emit(); sync.pausar(true);
  await loadMecanismos();
  let enviados = 0;
  try {
    const due = store.list('inscricoes').filter(i => i.status === 'ativa' && new Date(i.proximoEm) <= now()).sort((a, b) => a.proximoEm.localeCompare(b.proximoEm));
    for (const ins of due) {
      const cad = store.get('cadencias', ins.cadenciaId), c = store.get('contatos', ins.contatoId);
      if (!cad || !cad.ativa) continue;
      if (!c || !isEmail(c.email) || c.optout || store.suprimido(c.email)) { ins.status = 'encerrada'; ins.motivo = 'contato indisponível ou descadastrado'; continue; }
      const desde = ins.criadoEm;
      if (store.list('recebidos').some(r => r.direcao === 'entrada' && r.data >= desde && (r.contatoId === c.id || r.email === c.email.toLowerCase()))) { ins.status = 'respondeu'; ins.encerradaEm = now().toISOString(); continue; }
      if (enviadosHoje() >= (Number(conf.limiteDiario) || 400)) break;
      const passo = cad.passos[ins.passo], mod = store.get('modelos', passo?.modeloId);
      if (!mod) { ins.status = 'erro'; ins.motivo = 'modelo de e-mail não encontrado'; continue; }
      const m = compose({ assunto: mod.assunto, corpo: mod.corpo, vars: {} }, c);
      const assunto = ins.passo > 0 && ins.assunto ? `Re: ${ins.assunto}` : m.subject.replace(/^Re:\s*/i, ins.passo > 0 ? 'Re: ' : '');
      try {
        const r = await G.sendRaw(buildMime({ to: c.email, toName: c.nome, from: G.status().email, fromName: conf.remetenteNome, replyTo: conf.replyTo, subject: assunto, html: m.html }), ins.passo > 0 ? ins.threadId : undefined);
        if (ins.passo === 0) { ins.threadId = r.threadId; ins.assunto = m.subject; }
        ins.envios.push({ passo: ins.passo, data: now().toISOString(), messageId: r.id });
        store.list('envios').push({ id: 'env-' + r.id, campanhaId: 'cad:' + cad.id, contatoId: c.id, email: c.email, status: 'enviado', messageId: r.id, threadId: r.threadId, assunto, data: now().toISOString() });
        store.logInteracao({ orgId: c.orgId, contatoId: c.id, tipo: 'email', titulo: assunto, descricao: `Cadência "${cad.nome}", passo ${ins.passo + 1} de ${cad.passos.length}`, threadId: r.threadId });
        const org = store.orgOf(c); if (org && (!org.relacionamento || org.relacionamento === 'mapeada')) org.relacionamento = 'contato';
        enviados++;
        ins.passo++;
        if (ins.passo >= cad.passos.length) { ins.status = 'concluida'; ins.encerradaEm = now().toISOString(); }
        else ins.proximoEm = proximoHorario(now(), cad.passos[ins.passo].dias || 1).toISOString();
      } catch (e) {
        ins.erros = (ins.erros || 0) + 1; ins.motivo = e.message;
        if (e.status === 401 || e.status === 403 || ins.erros >= 3) { ins.status = 'erro'; if (e.status === 401 || e.status === 403) break; }
      }
      await sleep(Math.max(1, Number(conf.intervaloSeg) || 5) * 1000);
    }
  } finally {
    rodando = false; ultimo = now().toISOString(); sync.pausar(false);
    store.touch('inscricoes'); store.touch('envios'); store.touch('orgs'); emit();
  }
  if (enviados && manual) toast(`${enviados} e-mail(s) de cadência enviado(s).`, 'ok');
  return enviados;
}

export function iniciar() { if (timer) return; timer = setInterval(() => ciclo(), 60000); setTimeout(() => ciclo(), 4000); emit(); }
export function parar() { clearInterval(timer); timer = null; emit(); }
