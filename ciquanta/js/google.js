// Conexão com o e-mail do CIQUANTA pela ponte (ponte/ponte.gs), publicada como app da Web na própria conta.
// Mantém a mesma interface usada pelo resto do CRM (envio, leitura, agenda, Drive, planilhas e base compartilhada),
// sem Google Cloud, ID de cliente ou login por janela: basta o endereço da ponte e a chave de acesso.
import { cfg, setConfig } from './store.js';
import { sleep } from './util.js';

let info = null, ultimoErro = '';
const subs = new Set();
export const onAuth = fn => (subs.add(fn), () => subs.delete(fn));
const notify = () => subs.forEach(f => { try { f(status()); } catch (e) { console.error(e); } });

const configurada = () => /^https:\/\/script\.google(usercontent)?\.com\//.test(cfg().ponteUrl || '') && !!cfg().ponteChave;
export function status() { return { conectado: !!info, email: info?.email || '', configurada: configurada(), erro: ultimoErro, recursos: info || {} }; }
/** Todas as funções vêm da mesma ponte; o Meet e as conversas encadeadas dependem dos serviços avançados. */
export const hasScope = () => !!info;

/** Chave de acesso aleatória (32 caracteres). */
export function gerarChave() {
  const a = new Uint8Array(24); crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/\+/g, 'x').replace(/\//g, 'y').replace(/=+$/, '');
}

async function chamar(acao, dados = {}, tentativas = 0) {
  const { ponteUrl, ponteChave } = cfg();
  if (!configurada()) throw Object.assign(new Error('Conecte o e-mail do CIQUANTA em Configurações.'), { status: 401 });
  let r;
  try {
    // text/plain evita a verificação prévia do navegador, que o Apps Script não atende
    r = await fetch(ponteUrl, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ chave: ponteChave, acao, dados }) });
  } catch (e) {
    if (tentativas < 2) { await sleep(1500 * 2 ** tentativas); return chamar(acao, dados, tentativas + 1); }
    throw new Error('A ponte de e-mail não respondeu. Confira a conexão e o endereço em Configurações.');
  }
  if ((r.status === 429 || r.status >= 500) && tentativas < 3) { await sleep(2000 * 2 ** tentativas); return chamar(acao, dados, tentativas + 1); }
  let j; try { j = await r.json(); } catch { throw new Error('Resposta inesperada da ponte. Confira se a implantação está como "Qualquer pessoa".'); }
  if (!j.ok) {
    const e = Object.assign(new Error(j.erro || 'Falha na ponte de e-mail.'), { status: j.codigo || 400 });
    if (j.codigo === 401 && info) { info = null; ultimoErro = e.message; notify(); }
    throw e;
  }
  return j.dados;
}

export async function connect() {
  try { info = await chamar('ping'); ultimoErro = ''; }
  catch (e) { info = null; ultimoErro = e.message; notify(); throw e; }
  notify(); return status();
}
export function disconnect() { info = null; notify(); }
/** Conecta sozinho ao abrir, se a ponte já estiver configurada. */
export function iniciarConexao() { if (configurada()) connect().catch(e => console.warn('ponte:', e.message)); }

// ---- Gmail
function b64url(str) {
  const bytes = new TextEncoder().encode(str); let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_');
}
const metas = new Map(); // metadados já trazidos pela ponte, para não buscar a mesma mensagem duas vezes
const guardar = l => { (l || []).forEach(m => metas.set(m.id, m)); if (metas.size > 2000) [...metas.keys()].slice(0, 500).forEach(k => metas.delete(k)); return l; };

export async function sendRaw(raw, threadId) { return chamar('enviar', { raw: b64url(raw), threadId: threadId || '' }); }
export async function draftRaw(raw) { return chamar('rascunho', { raw: b64url(raw) }); }
export async function thread(id) { const t = await chamar('conversa', { id }); guardar(t.messages); return t; }
export async function searchThreads(q, max = 20) { const l = await chamar('conversas', { q, max }); return { threads: l.map(t => ({ id: t.id })) }; }
export async function listMessages(q, max = 50) { const l = guardar(await chamar('mensagens', { q, max })); return { messages: l.map(m => ({ id: m.id, threadId: m.threadId })) }; }
export async function messageMeta(id) { return metas.get(id) || chamar('mensagem', { id }); }
/** Equivalente ao histórico do Gmail: o "historyId" passa a ser o instante da última verificação. */
export async function freshProfile() { return { emailAddress: info?.email || '', historyId: String(Date.now()) }; }
export async function history(desde) {
  const r = await chamar('novidades', { desde: Number(desde) || Date.now() - 3600e3 });
  guardar(r.mensagens);
  return { historyId: String(r.agora), history: r.mensagens.length ? [{ messagesAdded: r.mensagens.map(m => ({ message: { id: m.id } })) }] : [] };
}
export const header = (m, n) => (m.payload?.headers || []).find(h => h.name.toLowerCase() === n.toLowerCase())?.value || '';
export function parseAddr(v) {
  return String(v || '').split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(p => {
    const m = p.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
    return m ? { nome: m[1].trim(), email: m[2].trim().toLowerCase() } : { nome: '', email: p.trim().toLowerCase() };
  }).filter(x => x.email.includes('@'));
}
export async function threadHasReply(threadId) {
  const t = await thread(threadId);
  const me = (info?.email || '').toLowerCase();
  return (t.messages || []).some(m => me && !header(m, 'From').toLowerCase().includes(me));
}
export async function threadsDetalhe(q, max = 8) { return chamar('conversas', { q, max }); }

// ---- Agenda
export async function calendarEvents({ dias = 60, passado = 7 } = {}) { return chamar('agenda', { dias, passado }); }
export async function calendarSearch(q, { dias = 365, passado = 365 } = {}) { const r = await chamar('agenda', { dias, passado, q }); return { items: (r.items || []).slice(0, 20) }; }
export async function createEvent({ titulo, descricao, inicio, fim, convidados = [], local = '', meet = true }) {
  const evento = {
    summary: titulo, description: descricao, location: local,
    start: { dateTime: new Date(inicio).toISOString(), timeZone: 'America/Fortaleza' },
    end: { dateTime: new Date(fim).toISOString(), timeZone: 'America/Fortaleza' },
    attendees: convidados.map(email => ({ email })),
    ...(meet ? { conferenceData: { createRequest: { requestId: 'cq' + Date.now(), conferenceSolutionKey: { type: 'hangoutsMeet' } } } } : {}),
  };
  return chamar('agendaCriar', { evento });
}

// ---- Drive
export async function driveSearchPresentations(termo = 'CIQUANTA') { return chamar('driveBuscar', { termo, apresentacoes: true, max: 50 }); }
export async function driveSearch(termo, max = 15) { return chamar('driveBuscar', { termo, max }); }
export async function driveFindByName(nome) { return chamar('planilhaPorNome', { nome }); }
// Arquivos do próprio CRM, guardados na pasta "CIQUANTA CRM" do Drive da conta
export async function driveFindId(nome) { return chamar('arquivoId', { nome }); }
export async function driveMeta(id) { return chamar('arquivoMeta', { id }); }
export async function driveGet(id) { return chamar('arquivoLer', { id }); }
export async function driveUpdate(id, json) { return chamar('arquivoGravar', { id, conteudo: json }); }
export async function driveCreate(nome, json) { return chamar('arquivoCriar', { nome, conteudo: json }); }
export async function driveSave(json, nome = 'ciquanta-crm-copia.json') {
  const id = cfg().driveFileId || await driveFindId(nome);
  const r = id ? await driveUpdate(id, json) : await driveCreate(nome, json);
  setConfig({ driveFileId: r.id });
  return r;
}
export async function driveLoad(nome = 'ciquanta-crm-copia.json') {
  const id = cfg().driveFileId || await driveFindId(nome);
  if (!id) throw new Error('Nenhuma cópia do CRM encontrada no Drive.');
  return driveGet(id);
}

// ---- Planilhas do Painel CIQUANTA
export const sheetId = v => (String(v || '').match(/\/d\/([a-zA-Z0-9_-]{20,})/) || [null, String(v || '').trim()])[1];
export async function sheetRead(idOuLink) {
  const id = sheetId(idOuLink); if (!id) throw new Error('Informe o link ou o identificador da planilha.');
  return chamar('planilha', { id });
}
