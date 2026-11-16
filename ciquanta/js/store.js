// Armazenamento local (localStorage + IndexedDB para arquivos) e dados de referência
import { uid, toast, norm } from './util.js';

const KEY = 'ciquanta:crm:v2';
const VERSION = 2;
const COLS = ['orgs', 'contatos', 'interacoes', 'oportunidades', 'campanhas', 'envios', 'recebidos', 'modelos', 'materiais', 'eventos'];

const empty = () => ({
  version: VERSION,
  orgs: [], contatos: [], interacoes: [], oportunidades: [], campanhas: [], envios: [], recebidos: [],
  modelos: [], materiais: [], eventos: [], supressao: [],
  config: {
    clientId: '', remetenteNome: '', remetenteCargo: '', remetenteTelefone: '', replyTo: 'ciquanta@secties.pb.gov.br',
    enderecoPublico: '', intervaloSeg: 5, limiteDiario: 400, monitorSeg: 30, notificacoes: true,
    rodape: 'Você recebeu esta mensagem por sua atuação institucional em ciência, tecnologia e inovação. Para não receber novos contatos do CIQUANTA, responda com "REMOVER".',
    escopos: { rascunhos: true, leitura: true, agenda: true, drive: false, backup: false },
    historyId: '', driveFileId: '', seeded: false,
  },
});

let db = load();
const listeners = new Set();

function load() {
  try {
    let raw = localStorage.getItem(KEY);
    const base = empty();
    if (!raw) {
      // Migração da versão anterior do sistema, se existir neste navegador
      const old = localStorage.getItem('ciquanta:dados:v1');
      if (old) {
        const o = JSON.parse(old);
        const mapa = { prospeccao: 'mapeada', contato: 'contato', reuniao: 'engajada', proposta: 'engajada', negociacao: 'engajada', parceria: 'parceira', pausado: 'pausada' };
        const m = { ...base, ...o, version: VERSION, oportunidades: [], recebidos: [], modelos: [], eventos: [],
          orgs: (o.orgs || []).map(x => ({ ...x, relacionamento: mapa[x.estagio] || 'mapeada' })),
          config: { ...base.config, ...(o.config || {}), escopos: base.config.escopos, seeded: false } };
        return m;
      }
      return base;
    }
    const d = JSON.parse(raw);
    return { ...base, ...d, config: { ...base.config, ...(d.config || {}), escopos: { ...base.config.escopos, ...(d.config?.escopos || {}) } } };
  } catch (e) { console.error(e); return empty(); }
}

let saveTimer;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (e) { toast('Não foi possível salvar no navegador (espaço cheio?). Baixe um backup em Configurações.', 'bad'); }
  }, 150);
}
export function flush() { clearTimeout(saveTimer); try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {} }
window.addEventListener('beforeunload', flush);

export const onChange = fn => (listeners.add(fn), () => listeners.delete(fn));
function emit(what) { persist(); listeners.forEach(fn => { try { fn(what); } catch (e) { console.error(e); } }); }

export const state = () => db;
export const cfg = () => db.config;
export function setConfig(patch) { db.config = { ...db.config, ...patch }; emit('config'); }

const now = () => new Date().toISOString();
export function list(col) { return db[col]; }
export function get(col, id) { return db[col].find(x => x.id === id); }
export function upsert(col, obj, prefix) {
  if (obj.id && get(col, obj.id)) {
    const cur = get(col, obj.id);
    Object.assign(cur, obj, { atualizadoEm: now() });
    emit(col); return cur;
  }
  const o = { ...obj, id: obj.id || uid(prefix || col.slice(0, 3)), criadoEm: obj.criadoEm || now() };
  db[col].push(o); emit(col); return o;
}
export function remove(col, id) {
  db[col] = db[col].filter(x => x.id !== id);
  if (col === 'orgs') {
    db.contatos = db.contatos.filter(c => c.orgId !== id);
    db.interacoes = db.interacoes.filter(i => i.orgId !== id);
    db.oportunidades = db.oportunidades.filter(o => o.orgId !== id);
  }
  if (col === 'contatos') db.interacoes = db.interacoes.filter(i => i.contatoId !== id);
  if (col === 'campanhas') db.envios = db.envios.filter(e => e.campanhaId !== id);
  emit(col);
}
export function touch(col) { emit(col); }

// ---- Consultas de domínio
export const orgOf = c => c && get('orgs', c.orgId);
export const contatosDe = orgId => db.contatos.filter(c => c.orgId === orgId);
export const oportunidadesDe = orgId => db.oportunidades.filter(o => o.orgId === orgId);
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
export const dominio = s => String(s || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0];
const GENERICOS = new Set(['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'yahoo.com.br', 'icloud.com', 'live.com', 'uol.com.br', 'bol.com.br', 'terra.com.br', 'msn.com', 'proton.me']);
/** Localiza contato e organização a partir de um endereço de e-mail (contato exato ou domínio institucional). */
export function matchEmail(email) {
  const e = norm(email); if (!e) return {};
  const contato = db.contatos.find(c => norm(c.email) === e);
  if (contato) return { contato, org: orgOf(contato) };
  const dom = e.split('@')[1]; if (!dom || GENERICOS.has(dom)) return {};
  const org = db.orgs.find(o => (o.site && (dominio(o.site) === dom || dom.endsWith('.' + dominio(o.site)))) || (o.email && norm(o.email).endsWith('@' + dom)))
    || orgOf(db.contatos.find(c => norm(c.email).endsWith('@' + dom)));
  return org ? { org } : {};
}
export function logInteracao(i) { return upsert('interacoes', { data: now(), ...i }, 'int'); }
export function pipelineValor(op) { return (Number(op.valor) || 0) * (Number(op.probabilidade) || 0) / 100; }

// ---- Dados de referência (somente leitura)
const cache = {};
export async function ref(name) {
  if (!cache[name]) cache[name] = fetch(`data/${name}.json`, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
  return cache[name];
}
let setoresMap = null;
export async function loadSetores() {
  if (!setoresMap) { const s = await ref('setores'); setoresMap = Object.fromEntries(s.itens.map(x => [x.id, x])); setoresMap.__comum = s.comum; }
  return setoresMap;
}
export const setorNome = id => setoresMap?.[id]?.nome || id || '—';
export const setorRef = id => setoresMap?.[id]?.ref || (setoresMap?.[id]?.nome || '').toLowerCase();
export const setorCurto = id => setoresMap?.[id]?.curto || id || '—';
export const setoresLista = () => Object.values(setoresMap || {}).filter(x => x && x.id);

export async function seedIfNeeded() {
  if (db.config.seeded) return false;
  try {
    const [m, a] = await Promise.all([ref('modelos'), ref('agenda')]);
    const ids = new Set(db.modelos.map(x => x.id));
    m.itens.forEach(x => { if (!ids.has(x.id)) db.modelos.push({ ...x, criadoEm: now(), padrao: true }); });
    const ev = new Set(db.eventos.map(x => x.id));
    a.itens.forEach(x => { if (!ev.has(x.id)) db.eventos.push({ ...x, criadoEm: now(), padrao: true }); });
    db.config.seeded = true; emit('seed');
    return true;
  } catch (e) { console.warn('seed', e); return false; }
}

// ---- Backup
export function exportJSON() { const { config, ...rest } = db; return JSON.stringify({ ...rest, config: { ...config, historyId: '' }, exportadoEm: now(), app: 'ciquanta-crm' }, null, 1); }
export function importJSON(text, { merge = false } = {}) {
  const d = JSON.parse(text);
  if (!d || !Array.isArray(d.orgs)) throw new Error('O arquivo não é um backup do CRM CIQUANTA.');
  if (!merge) {
    const keep = db.config;
    db = { ...empty(), ...d, config: { ...empty().config, ...keep, ...(d.config || {}), clientId: d.config?.clientId || keep.clientId, historyId: keep.historyId } };
  } else {
    for (const col of COLS) {
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
