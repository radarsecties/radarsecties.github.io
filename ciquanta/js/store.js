// Armazenamento local (localStorage + IndexedDB para arquivos) e dados de referência
import { uid, toast, norm } from './util.js';

const KEY = 'ciquanta:dados:v1';
const VERSION = 1;

const empty = () => ({
  version: VERSION,
  orgs: [], contatos: [], interacoes: [], campanhas: [], envios: [],
  modelos: [], materiais: [], eventos: [], supressao: [],
  config: {
    clientId: '', remetenteNome: '', remetenteCargo: '', remetenteTelefone: '', replyTo: '',
    intervaloSeg: 5, limiteDiario: 400,
    rodape: 'Você recebeu esta mensagem por sua atuação institucional em ciência, tecnologia e inovação. Para não receber novos contatos do CIQuanta-PB, responda com "REMOVER".',
    escopos: { rascunhos: true, leitura: false, drive: false },
    driveFileId: '', seeded: false,
  },
});

let db = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const d = JSON.parse(raw);
    const base = empty();
    return { ...base, ...d, config: { ...base.config, ...(d.config || {}), escopos: { ...base.config.escopos, ...(d.config?.escopos || {}) } } };
  } catch (e) { console.error(e); return empty(); }
}

let saveTimer;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (e) { toast('Não foi possível salvar no navegador (espaço cheio?). Exporte um backup em Configurações.', 'bad'); }
  }, 150);
}
export function flush() { clearTimeout(saveTimer); try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {} }
window.addEventListener('beforeunload', flush);

export const onChange = fn => (listeners.add(fn), () => listeners.delete(fn));
function emit(what) { persist(); listeners.forEach(fn => { try { fn(what); } catch (e) { console.error(e); } }); }

export const state = () => db;
export const cfg = () => db.config;
export function setConfig(patch) { db.config = { ...db.config, ...patch }; emit('config'); }

// ---- CRUD genérico
const now = () => new Date().toISOString();
export function list(col) { return db[col]; }
export function get(col, id) { return db[col].find(x => x.id === id); }
export function upsert(col, obj, prefix) {
  if (obj.id && get(col, obj.id)) {
    const i = db[col].findIndex(x => x.id === obj.id);
    db[col][i] = { ...db[col][i], ...obj, atualizadoEm: now() };
    emit(col); return db[col][i];
  }
  const o = { ...obj, id: obj.id || uid(prefix || col.slice(0, 3)), criadoEm: obj.criadoEm || now() };
  db[col].push(o); emit(col); return o;
}
export function bulkAdd(col, arr) { db[col].push(...arr); emit(col); }
export function remove(col, id) {
  db[col] = db[col].filter(x => x.id !== id);
  if (col === 'orgs') {
    db.contatos = db.contatos.filter(c => c.orgId !== id);
    db.interacoes = db.interacoes.filter(i => i.orgId !== id);
  }
  if (col === 'contatos') db.interacoes = db.interacoes.filter(i => i.contatoId !== id);
  if (col === 'campanhas') db.envios = db.envios.filter(e => e.campanhaId !== id);
  emit(col);
}
export function touch(col) { emit(col); }

// ---- Consultas de domínio
export const orgOf = c => c && get('orgs', c.orgId);
export const contatosDe = orgId => db.contatos.filter(c => c.orgId === orgId);
export const interacoesDe = orgId => db.interacoes.filter(i => i.orgId === orgId).sort((a, b) => (b.data || '').localeCompare(a.data || ''));
export const suprimido = email => db.supressao.includes(norm(email));
export function suprimir(email, on = true) {
  const e = norm(email); if (!e) return;
  db.supressao = db.supressao.filter(x => x !== e); if (on) db.supressao.push(e);
  db.contatos.forEach(c => { if (norm(c.email) === e) c.optout = on; });
  emit('supressao');
}
export function findOrgByName(nome) { const n = norm(nome); return db.orgs.find(o => norm(o.nome) === n || (o.nomeFantasia && norm(o.nomeFantasia) === n)); }
export function findOrgByCNPJ(cnpj) { const d = String(cnpj || '').replace(/\D/g, ''); return d && db.orgs.find(o => String(o.cnpj || '').replace(/\D/g, '') === d); }
export function logInteracao(i) { return upsert('interacoes', { data: now(), ...i }, 'int'); }

// ---- Dados de referência (somente leitura, servidos como JSON)
const cache = {};
export async function ref(name) {
  if (!cache[name]) cache[name] = fetch(`data/${name}.json`, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
  return cache[name];
}

export async function seedIfNeeded() {
  if (db.config.seeded) return false;
  try {
    const [m, a] = await Promise.all([ref('modelos'), ref('agenda')]);
    if (!db.modelos.length) db.modelos = m.itens.map(x => ({ ...x, criadoEm: now(), padrao: true }));
    if (!db.eventos.length) db.eventos = a.itens.map(x => ({ ...x, criadoEm: now(), padrao: true }));
    db.config.seeded = true; emit('seed');
    return true;
  } catch (e) { console.warn('seed', e); return false; }
}

// ---- Backup
export function exportJSON() { return JSON.stringify({ ...db, exportadoEm: now(), app: 'ciquanta-ri' }, null, 1); }
export function importJSON(text, { merge = false } = {}) {
  const d = JSON.parse(text);
  if (!d || !Array.isArray(d.orgs)) throw new Error('Arquivo não parece um backup do CIQuanta.');
  if (!merge) {
    const keepCfg = db.config;
    db = { ...empty(), ...d, config: { ...empty().config, ...keepCfg, ...(d.config || {}), clientId: d.config?.clientId || keepCfg.clientId } };
  } else {
    for (const col of ['orgs', 'contatos', 'interacoes', 'campanhas', 'envios', 'modelos', 'materiais', 'eventos']) {
      const ids = new Set(db[col].map(x => x.id));
      (d[col] || []).forEach(x => { if (!ids.has(x.id)) db[col].push(x); });
    }
    db.supressao = Array.from(new Set([...db.supressao, ...(d.supressao || [])]));
  }
  emit('import');
}
export function resetAll() { const c = db.config.clientId; db = empty(); db.config.clientId = c; emit('reset'); }

// ---- IndexedDB (arquivos de materiais)
let idbp;
function idb() {
  if (!idbp) idbp = new Promise((res, rej) => {
    const r = indexedDB.open('ciquanta-arquivos', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('arquivos');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  return idbp;
}
export async function fileput(id, value) { const d = await idb(); return new Promise((res, rej) => { const t = d.transaction('arquivos', 'readwrite'); t.objectStore('arquivos').put(value, id); t.oncomplete = res; t.onerror = () => rej(t.error); }); }
export async function fileGet(id) { const d = await idb(); return new Promise((res, rej) => { const r = d.transaction('arquivos').objectStore('arquivos').get(id); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
export async function fileDel(id) { const d = await idb(); return new Promise(res => { const t = d.transaction('arquivos', 'readwrite'); t.objectStore('arquivos').delete(id); t.oncomplete = res; }); }
