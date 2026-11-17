// Armazenamento local (localStorage + IndexedDB para arquivos) e dados de referência
import { uid, toast, norm } from './util.js';

const KEY = 'ciquanta:crm:v2';
const VERSION = 2;
const SEED = 4; // versão dos dados iniciais (modelos, agenda e cadências)
export const COLS = ['orgs', 'contatos', 'interacoes', 'oportunidades', 'campanhas', 'envios', 'recebidos', 'modelos', 'materiais', 'eventos', 'cadencias', 'inscricoes', 'editais', 'adesoes'];

const empty = () => ({
  version: VERSION,
  orgs: [], contatos: [], interacoes: [], oportunidades: [], campanhas: [], envios: [], recebidos: [],
  modelos: [], materiais: [], eventos: [], cadencias: [], inscricoes: [], editais: [], adesoes: [], supressao: [], descartadas: [],
  painel: { atualizadoEm: '', visitas: [], cadastros: {}, temas: {}, totais: {} },
  config: {
    ponteUrl: '', ponteChave: '', ponteSessao: '', remetenteNome: '', remetenteCargo: '', remetenteTelefone: '', replyTo: 'ciquanta@secties.pb.gov.br',
    enderecoPublico: '', intervaloSeg: 5, limiteDiario: 400, monitorSeg: 60, notificacoes: true,
    rodape: 'Você recebeu esta mensagem por sua atuação institucional em ciência, tecnologia e inovação. Para não receber novos contatos do CIQUANTA, responda com "REMOVER".',
    escopos: { rascunhos: true, leitura: true, agenda: true, drive: true, backup: false, planilhas: true },
    planilhaVisitas: '', planilhaCadastros: '', painelUrl: 'https://painelciquanta.secties.pb.gov.br',
    metaAnual: 0, metas: {}, cotas: [], horarioComercial: true, cadenciasAtivas: true,
    sincronizar: false, baseFileId: '', cfgEm: {}, guiaOculto: false,
    autoMapeamento: true, autoCanais: true, autoReceita: true, autoPainel: true, autoGmailContatos: true,
    pilotoAutomatico: false, pilotoLimite: 12, pilotoMinimo: 55,
    historyId: '', driveFileId: '', seed: 0,
  },
});

/** Garante a forma das coleções: listas válidas, sem itens repetidos e sem registros órfãos. Devolve o próprio objeto. */
export function sanear(d) {
  if (!d || typeof d !== 'object') return empty();
  let n = 0;
  for (const c of COLS) {
    const visto = new Set(), antes = Array.isArray(d[c]) ? d[c].length : 0;
    d[c] = (Array.isArray(d[c]) ? d[c] : []).filter(x => x && typeof x === 'object' && x.id && !visto.has(x.id) && visto.add(x.id));
    n += antes - d[c].length;
  }
  const orgs = new Set(d.orgs.map(o => o.id)), cts = new Set(d.contatos.map(c => c.id)), cads = new Set(d.cadencias.map(c => c.id));
  const corta = (c, ok) => { const a = d[c].length; d[c] = d[c].filter(ok); n += a - d[c].length; };
  corta('oportunidades', o => orgs.has(o.orgId));
  corta('inscricoes', i => cts.has(i.contatoId) && cads.has(i.cadenciaId));
  d.contatos.forEach(c => { if (c.orgId && !orgs.has(c.orgId)) { c.orgId = ''; n++; } });
  d.supressao = Array.isArray(d.supressao) ? [...new Set(d.supressao.filter(x => typeof x === 'string' && x))] : [];
  d.descartadas = Array.isArray(d.descartadas) ? [...new Set(d.descartadas.filter(x => typeof x === 'string' && x))] : [];
  if (!d.painel || typeof d.painel !== 'object') delete d.painel;
  if (n) console.info(`CRM: ${n} registro(s) inconsistente(s) corrigido(s) ao carregar.`);
  return d;
}

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
    const d = sanear(JSON.parse(raw));
    return { ...base, ...d, config: { ...base.config, ...(d.config || {}), escopos: { ...base.config.escopos, ...(d.config?.escopos || {}) } } };
  } catch (e) { console.error(e); return empty(); }
}

let saveTimer, avisouFalha = false, descartado = false;
/** Depois de apagar os dados deste computador, nada mais é gravado até recarregar a página. */
export function descartar() { descartado = true; clearTimeout(saveTimer); }
function gravar() {
  if (descartado) return true;
  try { localStorage.setItem(KEY, JSON.stringify(db)); avisouFalha = false; return true; }
  catch (e) {
    console.error(e);
    if (!avisouFalha) toast('Não foi possível gravar no navegador (espaço cheio ou navegação privada). Baixe uma cópia em Configurações para não perder o trabalho.', 'bad');
    avisouFalha = true; return false;
  }
}
function persist() { clearTimeout(saveTimer); saveTimer = setTimeout(gravar, 150); }
export function flush() { clearTimeout(saveTimer); return gravar(); }
window.addEventListener('beforeunload', flush);
window.addEventListener('pagehide', flush);

export const onChange = fn => (listeners.add(fn), () => listeners.delete(fn));
const avisar = what => listeners.forEach(fn => { try { fn(what); } catch (e) { console.error(e); } });
function emit(what) { persist(); avisar(what); }

// Outra aba deste navegador gravou: recarrega a base para as duas abas não se sobrescreverem
window.addEventListener('storage', e => {
  if (e.key !== KEY || !e.newValue) return;
  clearTimeout(saveTimer); db = load(); avisar('externo');
});

export const state = () => db;
export const cfg = () => db.config;
/** Preferências que valem para toda a equipe e seguem para a base compartilhada. As demais são de cada computador. */
export const CONFIG_COMUM = ['remetenteNome', 'remetenteCargo', 'remetenteTelefone', 'replyTo', 'enderecoPublico', 'intervaloSeg', 'limiteDiario', 'rodape', 'planilhaVisitas', 'planilhaCadastros', 'painelUrl', 'metaAnual', 'metas', 'cotas', 'horarioComercial', 'cadenciasAtivas',
  'autoMapeamento', 'autoCanais', 'autoReceita', 'autoPainel', 'autoGmailContatos', 'pilotoAutomatico', 'pilotoLimite', 'pilotoMinimo'];
export function setConfig(patch) {
  // Cada preferência comum guarda quando foi alterada, para a mescla entre computadores valer item a item
  const em = { ...(db.config.cfgEm || {}) };
  if (!('cfgEm' in patch)) for (const k of CONFIG_COMUM) if (k in patch && JSON.stringify(patch[k]) !== JSON.stringify(db.config[k])) em[k] = now();
  db.config = { cfgEm: em, ...db.config, ...patch, ...('cfgEm' in patch ? {} : { cfgEm: em }) };
  emit('config');
}

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
/** Exclui o registro e o que depende dele. Devolve uma função que desfaz a exclusão. */
export function remove(col, id) {
  const fora = {};
  const tira = (c, sai) => { const l = db[c].filter(sai); if (l.length) { fora[c] = (fora[c] || []).concat(l); db[c] = db[c].filter(x => !sai(x)); } };
  if (col === 'orgs') {
    if (!db.descartadas.includes(id)) db.descartadas.push(id);
    const cts = new Set(db.contatos.filter(c => c.orgId === id).map(c => c.id));
    tira('inscricoes', i => cts.has(i.contatoId));
    tira('contatos', c => c.orgId === id); tira('interacoes', i => i.orgId === id); tira('oportunidades', o => o.orgId === id);
  }
  if (col === 'contatos') { tira('interacoes', i => i.contatoId === id); tira('inscricoes', i => i.contatoId === id); }
  if (col === 'campanhas') tira('envios', e => e.campanhaId === id);
  if (col === 'cadencias') tira('inscricoes', i => i.cadenciaId === id);
  tira(col, x => x.id === id);
  emit(col);
  return () => {
    for (const [c, l] of Object.entries(fora)) { const ids = new Set(db[c].map(x => x.id)); l.forEach(x => { if (!ids.has(x.id)) db[c].push(x); }); }
    if (col === 'orgs') db.descartadas = db.descartadas.filter(x => x !== id);
    emit(col);
  };
}
/** Exclui e mostra o aviso com "Desfazer". */
export function removerComDesfazer(col, id, rotulo, depois) {
  const desfazer = remove(col, id);
  toast(`${rotulo} excluído(a).`, '', { acao: 'Desfazer', onAcao: () => { desfazer(); depois?.(); } });
}
export function touch(col) { emit(col); }
/** Troca coleções inteiras preservando as referências dos registros que continuam (usado pela sincronização). */
export function aplicar(cols, extra = {}) {
  for (const [c, nova] of Object.entries(cols)) {
    const atual = new Map(db[c].map(x => [x.id, x]));
    db[c] = nova.map(n => { const a = atual.get(n.id); if (!a) return n; if (a !== n) { for (const k of Object.keys(a)) delete a[k]; Object.assign(a, n); } return a; });
  }
  Object.assign(db, extra);
  emit('externo');
}

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
  if ((db.config.seed || 0) >= SEED) return false;
  try {
    const [m, a] = await Promise.all([ref('modelos'), ref('agenda')]);
    const ids = new Set(db.modelos.map(x => x.id));
    m.itens.forEach(x => { const cur = db.modelos.find(y => y.id === x.id); if (!cur) db.modelos.push({ ...x, criadoEm: now(), padrao: true }); else if (cur.padrao && !cur.atualizadoEm) Object.assign(cur, x); });
    db.eventos = db.eventos.filter(x => !x.padrao);
    a.itens.forEach(x => db.eventos.push({ ...x, criadoEm: now(), padrao: true }));
    const cad = (id, nome, publico, passos) => { if (!db.cadencias.some(c => c.id === id)) db.cadencias.push({ id, nome, publico, passos, ativa: true, padrao: true, criadoEm: now() }); };
    cad('cad-empresas', 'Empresas: primeira abordagem', 'Gestores de P&D e inovação', [{ dias: 0, modeloId: 'mod-empresa-agenda' }, { dias: 5, modeloId: 'mod-followup' }, { dias: 9, modeloId: 'mod-followup-2' }]);
    cad('cad-autoridades', 'Autoridades: agenda institucional', 'Gabinetes e assessorias', [{ dias: 0, modeloId: 'mod-autoridade' }, { dias: 10, modeloId: 'mod-followup' }]);
    cad('cad-fomento', 'Fomentadores e bancos: cooperação', 'Agências, bancos e fundações', [{ dias: 0, modeloId: 'mod-fomento' }, { dias: 7, modeloId: 'mod-followup' }]);
    cad('cad-investidores', 'Investidores e corporate venture', 'Gestoras e áreas de venture', [{ dias: 0, modeloId: 'mod-investidor' }, { dias: 7, modeloId: 'mod-followup' }]);
    cad('cad-canais', 'Consultorias: parceria de canal', 'Consultorias de inovação e tecnologia', [{ dias: 0, modeloId: 'mod-canal' }, { dias: 7, modeloId: 'mod-followup' }]);
    db.config.seed = SEED; emit('seed');
    return true;
  } catch (e) { console.warn('seed', e); return false; }
}

// ---- Backup
export function exportJSON() { const { config, ...rest } = db; return JSON.stringify({ ...rest, config: { ...config, historyId: '', ponteChave: '', ponteSessao: '' }, exportadoEm: now(), app: 'ciquanta-crm' }, null, 1); }
export function importJSON(text, { merge = false } = {}) {
  let d; try { d = JSON.parse(text); } catch { throw new Error('O arquivo não é um JSON válido.'); }
  if (!d || !Array.isArray(d.orgs)) throw new Error('O arquivo não é uma cópia do CRM CIQUANTA.');
  criarPonto(merge ? 'antes de mesclar uma cópia' : 'antes de restaurar uma cópia');
  sanear(d);
  if (!merge) {
    const keep = db.config;
    db = { ...empty(), ...d, config: { ...empty().config, ...keep, ...(d.config || {}), ponteUrl: d.config?.ponteUrl || keep.ponteUrl, ponteChave: keep.ponteChave, ponteSessao: keep.ponteSessao, historyId: keep.historyId } };
  } else {
    for (const col of COLS) {
      const ids = new Set(db[col].map(x => x.id));
      (d[col] || []).forEach(x => { if (!ids.has(x.id)) db[col].push(x); });
    }
    db.supressao = Array.from(new Set([...db.supressao, ...(d.supressao || [])]));
    sanear(db);
  }
  emit('import');
}
export function resetAll() { criarPonto('antes de apagar todos os dados'); const { ponteUrl, ponteChave, ponteSessao } = db.config; db = empty(); Object.assign(db.config, { ponteUrl, ponteChave, ponteSessao }); emit('reset'); }
export const contagem = (d = db) => ({ orgs: d.orgs.length, contatos: d.contatos.length, oportunidades: d.oportunidades.length, interacoes: d.interacoes.length });

// ---- IndexedDB (arquivos de materiais)
let idbp;
function idb() {
  if (!idbp) idbp = new Promise((res, rej) => {
    const r = indexedDB.open('ciquanta-arquivos', 2);
    r.onupgradeneeded = () => { for (const n of ['arquivos', 'pontos']) if (!r.result.objectStoreNames.contains(n)) r.result.createObjectStore(n); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  return idbp;
}
export async function fileput(id, value) { const d = await idb(); return new Promise((res, rej) => { const t = d.transaction('arquivos', 'readwrite'); t.objectStore('arquivos').put(value, id); t.oncomplete = res; t.onerror = () => rej(t.error); }); }
export async function fileGet(id) { const d = await idb(); return new Promise((res, rej) => { const r = d.transaction('arquivos').objectStore('arquivos').get(id); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
export async function fileDel(id) { const d = await idb(); return new Promise(res => { const t = d.transaction('arquivos', 'readwrite'); t.objectStore('arquivos').delete(id); t.oncomplete = res; }); }

// ---- Pontos de restauração: cópias automáticas guardadas neste navegador
const MAX_PONTOS = 12;
const tx = async (modo, fn) => { const d = await idb(); return new Promise((res, rej) => { const t = d.transaction('pontos', modo), r = fn(t.objectStore('pontos')); t.oncomplete = () => res(r?.result); t.onerror = () => rej(t.error); }); };
export async function listarPontos() {
  try { const ks = await tx('readonly', o => o.getAllKeys()); const vs = await tx('readonly', o => o.getAll()); return ks.map((k, i) => ({ id: k, motivo: vs[i].motivo, n: vs[i].n })).sort((a, b) => b.id.localeCompare(a.id)); }
  catch (e) { console.warn(e); return []; }
}
export async function criarPonto(motivo = 'automático') {
  if (!db.orgs.length && !db.contatos.length) return;
  const reg = { motivo, n: contagem(), dados: exportJSON() }, id = now(); // fotografa antes de qualquer espera
  try {
    await tx('readwrite', o => o.put(reg, id));
    const l = await listarPontos();
    for (const p of l.slice(MAX_PONTOS)) await tx('readwrite', o => o.delete(p.id));
  } catch (e) { console.warn('ponto de restauração', e); }
}
export async function restaurarPonto(id) {
  const p = await tx('readonly', o => o.get(id)); if (!p) throw new Error('Ponto de restauração não encontrado.');
  importJSON(p.dados);
}
/** Uma cópia automática por dia de uso. */
export async function pontoDiario() {
  const l = await listarPontos(); const hoje = now().slice(0, 10);
  if (!l.some(p => p.id.slice(0, 10) === hoje && p.motivo === 'automático')) await criarPonto('automático');
}
