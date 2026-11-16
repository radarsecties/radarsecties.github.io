// Integração Google: login OAuth (Google Identity Services), Gmail API e Drive (backup)
// Tudo roda no navegador. O token fica só na memória da aba (não é salvo).
import { cfg, setConfig } from './store.js';
import { sleep } from './util.js';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';
const S = {
  send: 'https://www.googleapis.com/auth/gmail.send',
  compose: 'https://www.googleapis.com/auth/gmail.compose',
  read: 'https://www.googleapis.com/auth/gmail.readonly',
  drive: 'https://www.googleapis.com/auth/drive.file',
};

let token = null;      // { access_token, expires_at, scope }
let profile = null;    // { emailAddress }
let tokenClient = null;
const subs = new Set();
export const onAuth = fn => (subs.add(fn), () => subs.delete(fn));
const notify = () => subs.forEach(f => f(status()));

export function status() {
  return { conectado: !!token && token.expires_at > Date.now(), email: profile?.emailAddress || '', escopos: token?.scope || '' };
}
export const hasScope = s => !!token && (token.scope || '').includes(S[s]);

export function wantedScopes() {
  const e = cfg().escopos || {};
  const list = [S.send, 'openid', 'email'];
  if (e.rascunhos) list.push(S.compose);
  if (e.leitura) list.push(S.read);
  if (e.drive) list.push(S.drive);
  return list.join(' ');
}

function loadGIS() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = GIS_SRC; s.async = true;
    s.onload = res; s.onerror = () => rej(new Error('Não foi possível carregar o login do Google (verifique a conexão ou bloqueadores).'));
    document.head.appendChild(s);
  });
}

export async function connect({ silent = false } = {}) {
  const clientId = (cfg().clientId || '').trim();
  if (!clientId) throw new Error('Configure o Client ID do Google em Configurações → Integração Gmail.');
  await loadGIS();
  return new Promise((resolve, reject) => {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: wantedScopes(),
      prompt: silent ? '' : undefined,
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
  if (!token) throw new Error('Conecte o Gmail primeiro (botão "Conectar Gmail").');
  await connect({ silent: true });
  return token.access_token;
}

async function api(url, opts = {}, tries = 0) {
  const t = token?.access_token || await ensureToken();
  const r = await fetch(url, { ...opts, headers: { Authorization: 'Bearer ' + t, ...(opts.body && !(opts.body instanceof Blob) && !opts.raw ? { 'Content-Type': 'application/json' } : {}), ...(opts.headers || {}) } });
  if (r.status === 401 && tries < 1) { token.expires_at = 0; await ensureToken(); return api(url, opts, tries + 1); }
  if ((r.status === 429 || r.status >= 500) && tries < 4) { await sleep(2000 * 2 ** tries); return api(url, opts, tries + 1); }
  if (!r.ok) {
    let msg = r.status + ''; try { const j = await r.json(); msg = j.error?.message || msg; } catch {}
    const e = new Error(msg); e.status = r.status; throw e;
  }
  return r.status === 204 ? null : (opts.text ? r.text() : r.json());
}

// ---- Gmail
function b64url(str) {
  const bytes = new TextEncoder().encode(str); let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export async function sendRaw(raw) { await ensureToken(); return api(`${GMAIL}/messages/send`, { method: 'POST', body: JSON.stringify({ raw: b64url(raw) }) }); }
export async function draftRaw(raw) { await ensureToken(); return api(`${GMAIL}/drafts`, { method: 'POST', body: JSON.stringify({ message: { raw: b64url(raw) } }) }); }
export async function thread(id) { await ensureToken(); return api(`${GMAIL}/threads/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`); }
export async function searchThreads(q, max = 20) { await ensureToken(); return api(`${GMAIL}/threads?maxResults=${max}&q=${encodeURIComponent(q)}`); }

/** Retorna true se a conversa tem mensagem de outra pessoa (resposta). */
export async function threadHasReply(threadId) {
  const t = await thread(threadId);
  const me = (profile?.emailAddress || '').toLowerCase();
  return (t.messages || []).some(m => {
    const from = (m.payload?.headers || []).find(h => h.name.toLowerCase() === 'from')?.value?.toLowerCase() || '';
    return me && !from.includes(me);
  });
}

// ---- Drive (backup em arquivo criado pelo app; escopo drive.file)
const DRIVE = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
export async function driveSave(json, name = 'ciquanta-relacoes-institucionais.json') {
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
export async function driveLoad() {
  await ensureToken();
  let id = cfg().driveFileId;
  if (!id) {
    const q = encodeURIComponent("name = 'ciquanta-relacoes-institucionais.json' and trashed = false");
    const l = await api(`${DRIVE}?q=${q}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc`);
    id = l.files?.[0]?.id; if (!id) throw new Error('Nenhum backup do CIQuanta encontrado no seu Drive.');
    setConfig({ driveFileId: id });
  }
  return api(`${DRIVE}/${id}?alt=media`, { text: true });
}
