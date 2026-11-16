// Integração com a conta Google do CIQUANTA: login OAuth (Google Identity Services), Gmail, Agenda e Drive.
// Tudo roda no navegador; o token fica só na memória da aba e não é salvo.
import { cfg, setConfig } from './store.js';
import { sleep } from './util.js';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';
const CAL = 'https://www.googleapis.com/calendar/v3';
const DRIVE = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
export const SCOPES = {
  send: 'https://www.googleapis.com/auth/gmail.send',
  compose: 'https://www.googleapis.com/auth/gmail.compose',
  read: 'https://www.googleapis.com/auth/gmail.readonly',
  calendar: 'https://www.googleapis.com/auth/calendar.events',
  driveMeta: 'https://www.googleapis.com/auth/drive.metadata.readonly',
  driveFile: 'https://www.googleapis.com/auth/drive.file',
  sheets: 'https://www.googleapis.com/auth/spreadsheets.readonly',
};

let token = null, profile = null, tokenClient = null;
const subs = new Set();
export const onAuth = fn => (subs.add(fn), () => subs.delete(fn));
const notify = () => subs.forEach(f => { try { f(status()); } catch (e) { console.error(e); } });

export function status() { return { conectado: !!token && token.expires_at > Date.now(), email: profile?.emailAddress || '', escopos: token?.scope || '' }; }
const MAP = { send: 'send', compose: 'compose', read: 'read', calendar: 'calendar', drive: 'driveMeta', backup: 'driveFile', planilhas: 'sheets' };
export const hasScope = s => !!token && (token.scope || '').includes(SCOPES[MAP[s] || s]);

export function wantedScopes() {
  const e = cfg().escopos || {};
  const l = [SCOPES.send, 'openid', 'email'];
  if (e.rascunhos) l.push(SCOPES.compose);
  if (e.leitura) l.push(SCOPES.read);
  if (e.agenda) l.push(SCOPES.calendar);
  if (e.drive) l.push(SCOPES.driveMeta);
  if (e.backup) l.push(SCOPES.driveFile);
  if (e.planilhas) l.push(SCOPES.sheets);
  return l.join(' ');
}

function loadGIS() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = GIS_SRC; s.async = true;
    s.onload = res; s.onerror = () => rej(new Error('Não foi possível carregar o login do Google. Verifique a conexão ou bloqueadores de conteúdo.'));
    document.head.appendChild(s);
  });
}

export async function connect({ silent = false } = {}) {
  const clientId = (cfg().clientId || '').trim();
  if (!clientId) throw new Error('Informe o Client ID do Google em Configurações para conectar a conta.');
  await loadGIS();
  return new Promise((resolve, reject) => {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId, scope: wantedScopes(),
      callback: async resp => {
        if (resp.error) return reject(new Error(resp.error_description || resp.error));
        token = { access_token: resp.access_token, expires_at: Date.now() + (Number(resp.expires_in) - 60) * 1000, scope: resp.scope };
        try { profile = await api(`${GMAIL}/profile`); } catch (e) { console.warn(e); }
        notify(); resolve(status());
      },
      error_callback: err => reject(new Error(err?.message || err?.type || 'Login cancelado.')),
    });
    tokenClient.requestAccessToken(silent ? { prompt: '' } : {});
  });
}
export function disconnect() {
  if (token && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(token.access_token, () => {});
  token = null; profile = null; notify();
}
async function ensureToken() {
  if (token && token.expires_at > Date.now()) return token.access_token;
  if (!token) throw new Error('Conecte a conta Google primeiro.');
  await connect({ silent: true });
  return token.access_token;
}

async function api(url, opts = {}, tries = 0) {
  const t = token?.access_token || await ensureToken();
  const json = opts.body && typeof opts.body === 'string' && !opts.raw;
  const r = await fetch(url, { ...opts, headers: { Authorization: 'Bearer ' + t, ...(json ? { 'Content-Type': 'application/json' } : {}), ...(opts.headers || {}) } });
  if (r.status === 401 && tries < 1) { token.expires_at = 0; await ensureToken(); return api(url, opts, tries + 1); }
  if ((r.status === 429 || r.status >= 500) && tries < 4) { await sleep(2000 * 2 ** tries); return api(url, opts, tries + 1); }
  if (!r.ok) { let msg = String(r.status); try { const j = await r.json(); msg = j.error?.message || msg; } catch {} const e = new Error(msg); e.status = r.status; throw e; }
  return r.status === 204 ? null : (opts.text ? r.text() : r.json());
}

// ---- Gmail
function b64url(str) {
  const bytes = new TextEncoder().encode(str); let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export async function sendRaw(raw, threadId) { await ensureToken(); return api(`${GMAIL}/messages/send`, { method: 'POST', body: JSON.stringify({ raw: b64url(raw), ...(threadId ? { threadId } : {}) }) }); }
export async function draftRaw(raw) { await ensureToken(); return api(`${GMAIL}/drafts`, { method: 'POST', body: JSON.stringify({ message: { raw: b64url(raw) } }) }); }
export async function thread(id) { await ensureToken(); return api(`${GMAIL}/threads/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`); }
export async function searchThreads(q, max = 20) { await ensureToken(); return api(`${GMAIL}/threads?maxResults=${max}&q=${encodeURIComponent(q)}`); }
export async function listMessages(q, max = 50) { await ensureToken(); return api(`${GMAIL}/messages?maxResults=${max}&q=${encodeURIComponent(q)}`); }
export async function messageMeta(id) { await ensureToken(); return api(`${GMAIL}/messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=Message-ID`); }
export async function history(startHistoryId) { await ensureToken(); return api(`${GMAIL}/history?startHistoryId=${encodeURIComponent(startHistoryId)}&historyTypes=messageAdded&maxResults=100`); }
export async function freshProfile() { profile = await api(`${GMAIL}/profile`); return profile; }
export const header = (m, n) => (m.payload?.headers || []).find(h => h.name.toLowerCase() === n.toLowerCase())?.value || '';
export function parseAddr(v) {
  return String(v || '').split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(p => {
    const m = p.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
    return m ? { nome: m[1].trim(), email: m[2].trim().toLowerCase() } : { nome: '', email: p.trim().toLowerCase() };
  }).filter(x => x.email.includes('@'));
}
export async function threadHasReply(threadId) {
  const t = await thread(threadId);
  const me = (profile?.emailAddress || '').toLowerCase();
  return (t.messages || []).some(m => me && !header(m, 'From').toLowerCase().includes(me));
}

// ---- Agenda
export async function calendarEvents({ dias = 60, passado = 7 } = {}) {
  await ensureToken();
  const min = new Date(Date.now() - passado * 864e5).toISOString(), max = new Date(Date.now() + dias * 864e5).toISOString();
  return api(`${CAL}/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=250&timeMin=${encodeURIComponent(min)}&timeMax=${encodeURIComponent(max)}`);
}
export async function createEvent({ titulo, descricao, inicio, fim, convidados = [], local = '', meet = true }) {
  await ensureToken();
  const body = {
    summary: titulo, description: descricao, location: local,
    start: { dateTime: new Date(inicio).toISOString(), timeZone: 'America/Fortaleza' },
    end: { dateTime: new Date(fim).toISOString(), timeZone: 'America/Fortaleza' },
    attendees: convidados.map(email => ({ email })),
    ...(meet ? { conferenceData: { createRequest: { requestId: 'cq' + Date.now(), conferenceSolutionKey: { type: 'hangoutsMeet' } } } } : {}),
  };
  return api(`${CAL}/calendars/primary/events?sendUpdates=all&conferenceDataVersion=${meet ? 1 : 0}`, { method: 'POST', body: JSON.stringify(body) });
}

// ---- Drive: apresentações do CIQUANTA e backup
export async function driveSearchPresentations(termo = 'CIQUANTA') {
  await ensureToken();
  const q = `(fullText contains '${termo.replace(/'/g, "\\'")}' or name contains '${termo.replace(/'/g, "\\'")}') and trashed = false and (mimeType = 'application/vnd.google-apps.presentation' or mimeType = 'application/pdf' or mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation')`;
  return api(`${DRIVE}?q=${encodeURIComponent(q)}&pageSize=50&orderBy=modifiedTime desc&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,mimeType,modifiedTime,webViewLink,owners(displayName))`);
}
export async function driveSave(json, name = 'ciquanta-crm-backup.json') {
  await ensureToken();
  const id = cfg().driveFileId;
  if (id) {
    try { return await api(`${UPLOAD}/${id}?uploadType=media`, { method: 'PATCH', body: new Blob([json], { type: 'application/json' }), headers: { 'Content-Type': 'application/json' } }); }
    catch (e) { if (e.status !== 404) throw e; }
  }
  const boundary = 'cq' + Math.random().toString(36).slice(2);
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, mimeType: 'application/json' })}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${json}\r\n--${boundary}--`;
  const r = await api(`${UPLOAD}?uploadType=multipart&fields=id,name`, { method: 'POST', raw: true, body: new Blob([body]), headers: { 'Content-Type': 'multipart/related; boundary=' + boundary } });
  setConfig({ driveFileId: r.id });
  return r;
}
// Arquivos JSON criados pelo próprio sistema (base compartilhada e reserva do motor)
export async function driveFindId(nome) {
  await ensureToken();
  const l = await api(`${DRIVE}?q=${encodeURIComponent(`name = '${nome}' and trashed = false`)}&orderBy=createdTime&pageSize=1&fields=files(id)`);
  return l.files?.[0]?.id || '';
}
export async function driveMeta(id) { await ensureToken(); return api(`${DRIVE}/${id}?fields=id,headRevisionId,modifiedTime`); }
export async function driveGet(id) { await ensureToken(); return api(`${DRIVE}/${id}?alt=media`, { text: true }); }
export async function driveUpdate(id, json) { await ensureToken(); return api(`${UPLOAD}/${id}?uploadType=media&fields=id,headRevisionId`, { method: 'PATCH', body: new Blob([json], { type: 'application/json' }), headers: { 'Content-Type': 'application/json' } }); }
export async function driveCreate(nome, json) {
  await ensureToken();
  const boundary = 'cq' + Math.random().toString(36).slice(2);
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: nome, mimeType: 'application/json' })}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${json}\r\n--${boundary}--`;
  return api(`${UPLOAD}?uploadType=multipart&fields=id,headRevisionId`, { method: 'POST', raw: true, body: new Blob([body]), headers: { 'Content-Type': 'multipart/related; boundary=' + boundary } });
}
export async function driveLoad() {
  await ensureToken();
  let id = cfg().driveFileId;
  if (!id) {
    const q = encodeURIComponent("name = 'ciquanta-crm-backup.json' and trashed = false");
    const l = await api(`${DRIVE}?q=${q}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc`);
    id = l.files?.[0]?.id; if (!id) throw new Error('Nenhum backup do CRM encontrado no Drive.');
    setConfig({ driveFileId: id });
  }
  return api(`${DRIVE}/${id}?alt=media`, { text: true });
}

// ---- Busca por organização em e-mails, arquivos e agenda
export async function driveSearch(termo, max = 15) {
  await ensureToken();
  const t = termo.replace(/['\\]/g, ' ');
  return api(`${DRIVE}?q=${encodeURIComponent(`fullText contains '${t}' and trashed = false and mimeType != 'application/vnd.google-apps.folder'`)}&pageSize=${max}&orderBy=modifiedTime desc&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,mimeType,modifiedTime,webViewLink,owners(displayName))`);
}
export async function driveFindByName(nome) {
  await ensureToken();
  const r = await api(`${DRIVE}?q=${encodeURIComponent(`name = '${nome.replace(/'/g, "\\'")}' and trashed = false and mimeType = 'application/vnd.google-apps.spreadsheet'`)}&pageSize=3&orderBy=modifiedTime desc&fields=files(id,name)`);
  return r.files?.[0]?.id || '';
}
export async function calendarSearch(q, { dias = 365, passado = 365 } = {}) {
  await ensureToken();
  const min = new Date(Date.now() - passado * 864e5).toISOString(), max = new Date(Date.now() + dias * 864e5).toISOString();
  return api(`${CAL}/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=20&q=${encodeURIComponent(q)}&timeMin=${encodeURIComponent(min)}&timeMax=${encodeURIComponent(max)}`);
}
export async function threadsDetalhe(q, max = 8) {
  const l = await searchThreads(q, max); const out = [];
  for (const t of l.threads || []) { const th = await thread(t.id); const m = th.messages?.[th.messages.length - 1]; if (m) out.push({ id: t.id, assunto: header(th.messages[0], 'Subject') || '(sem assunto)', de: header(m, 'From'), data: m.internalDate ? new Date(Number(m.internalDate)).toISOString() : '', n: th.messages.length }); }
  return out;
}

// ---- Planilhas (Google Sheets): leitura das bases do Painel CIQUANTA
const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
export const sheetId = v => (String(v || '').match(/\/d\/([a-zA-Z0-9_-]{20,})/) || [null, String(v || '').trim()])[1];
/** Lê todas as abas de uma planilha e devolve { aba: [ {coluna: valor} ] }. */
export async function sheetRead(idOuLink) {
  await ensureToken();
  const id = sheetId(idOuLink); if (!id) throw new Error('Informe o link ou o identificador da planilha.');
  const meta = await api(`${SHEETS}/${id}?fields=sheets.properties.title`);
  const out = {};
  for (const sh of meta.sheets || []) {
    const t = sh.properties.title;
    const v = await api(`${SHEETS}/${id}/values/${encodeURIComponent(t)}?majorDimension=ROWS`);
    const rows = v.values || []; if (rows.length < 2) { out[t] = []; continue; }
    const head = rows[0].map(h => String(h).trim());
    out[t] = rows.slice(1).filter(r => r.some(c => String(c).trim())).map(r => Object.fromEntries(head.map((h, i) => [h, String(r[i] ?? '').trim()])));
  }
  return out;
}
