// Base compartilhada: uma única cópia do CRM no Google Drive da conta do CIQUANTA.
// Cada computador mescla as suas mudanças com as dos demais, registro a registro, sem servidor.
// Também decide qual aba e qual computador executam os envios automáticos, para nada sair em duplicidade.
import * as store from './store.js';
import * as G from './google.js';
import { toast } from './util.js';

const ARQ_BASE = 'ciquanta-crm-base.json', ARQ_MOTOR = 'ciquanta-crm-motor.json';
const K_BASE = 'ciquanta:sync:base', K_DISP = 'ciquanta:dispositivo';
const INTERVALO = 120000, VALIDADE_MOTOR = 8 * 60000;

const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
const hRec = x => hash(JSON.stringify(x));
const quando = x => x?.atualizadoEm || x?.criadoEm || x?.data || '';
const lerLocal = (k, padrao) => { try { return JSON.parse(localStorage.getItem(k)) ?? padrao; } catch { return padrao; } };
const gravarLocal = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.warn(e); } };

export const dispositivo = (() => { let d = lerLocal(K_DISP, ''); if (!d) { d = 'disp-' + Math.random().toString(36).slice(2, 10); gravarLocal(K_DISP, d); } return d; })();

// ---- Uma aba por navegador conduz os motores (cadências, campanhas agendadas e leitura da caixa)
let abaLider = !navigator.locks;
navigator.locks?.request('ciquanta:motor', () => { abaLider = true; avisar(); return new Promise(() => {}); });

let est = { fase: 'parado', ultimo: '', erro: '', motorAqui: true, motorDe: '' };
let ocupado = false, pausas = 0, timer = null, pendente = null;
const subs = new Set();
export const onSync = fn => (subs.add(fn), () => subs.delete(fn));
function avisar() { subs.forEach(f => { try { f(estado()); } catch (e) { console.error(e); } }); }
const habilitado = () => !!store.cfg().sincronizar && G.status().conectado && G.hasScope('backup');
export const estado = () => ({ ...est, ativo: habilitado(), abaLider });
/** Este computador e esta aba podem executar envios automáticos agora? */
export const podeAutomatizar = () => abaLider && (!habilitado() || est.motorAqui);
/** Suspende a sincronização enquanto um envio em série está em andamento. */
export function pausar(sim) { pausas = Math.max(0, pausas + (sim ? 1 : -1)); }

const pacote = () => { const s = store.state(), out = { app: 'ciquanta-crm', formato: 1, gravadoEm: new Date().toISOString(), gravadoPor: dispositivo, supressao: s.supressao, painel: s.painel, descartadas: s.descartadas, cfgEm: s.config.cfgEm || {}, config: {} };
  for (const c of store.COLS) out[c] = s[c];
  for (const k of store.CONFIG_COMUM) out.config[k] = s.config[k];
  return JSON.stringify(out); };
const hashes = cols => Object.fromEntries(store.COLS.map(c => [c, Object.fromEntries((cols[c] || []).map(x => [x.id, hRec(x)]))]));

/**
 * Mescla em três vias, por registro: `base` guarda a assinatura de cada registro na última sincronização.
 * Quem mudou desde então prevalece; se os dois lados mudaram, vale a alteração mais recente.
 * Exclusões são reconhecidas quando o registro existia na base e sumiu de um dos lados sem ter sido alterado no outro.
 */
export function mesclar(local, remoto, base) {
  const res = {}; let mudouLocal = false, mudouRemoto = false;
  for (const c of store.COLS) {
    const L = new Map((local[c] || []).map(x => [x.id, x])), R = new Map((remoto[c] || []).map(x => [x.id, x])), B = base?.[c] || {};
    const out = [];
    for (const id of new Set([...L.keys(), ...R.keys()])) {
      const l = L.get(id), r = R.get(id), hb = B[id];
      if (l && r) {
        const hl = hRec(l), hr = hRec(r);
        if (hl === hr || hr === hb) { out.push(l); if (hl !== hr) mudouRemoto = true; }
        else if (hl === hb || quando(r) > quando(l)) { out.push(r); mudouLocal = true; }
        else { out.push(l); mudouRemoto = true; }
      } else if (l) {
        if (hb && hRec(l) === hb) mudouLocal = true;      // excluído em outro computador
        else { out.push(l); mudouRemoto = true; }          // novo aqui, ou alterado aqui depois da exclusão
      } else if (hb && hRec(r) === hb) mudouRemoto = true; // excluído aqui
      else { out.push(r); mudouLocal = true; }             // novo em outro computador
    }
    res[c] = out;
  }
  return { cols: res, mudouLocal, mudouRemoto };
}

/** Preferências comuns: vale, item a item, a alteração mais recente. Devolve true se este computador tem algo mais novo a enviar. */
function mesclarConfig(remoto) {
  const loc = store.cfg().cfgEm || {}, rem = remoto.cfgEm || {}, patch = {}, em = { ...loc }; let enviar = false;
  for (const k of store.CONFIG_COMUM) {
    if ((rem[k] || '') > (loc[k] || '') && remoto.config && k in remoto.config) { patch[k] = remoto.config[k]; em[k] = rem[k]; }
    else if ((loc[k] || '') > (rem[k] || '')) enviar = true;
  }
  if (Object.keys(patch).length) store.setConfig({ ...patch, cfgEm: em });
  return enviar;
}
const carimbo = () => JSON.stringify(store.cfg().cfgEm || {});

async function arquivo(nome, chave) {
  let id = store.cfg()[chave];
  if (!id) { id = await G.driveFindId(nome); if (id && chave) store.setConfig({ [chave]: id }); }
  return id;
}

// O motor pertence a um computador por vez; a reserva expira sozinha se ele for fechado
let motorId = '';
async function disputarMotor() {
  try {
    motorId ||= await G.driveFindId(ARQ_MOTOR);
    const agora = Date.now();
    const eu = () => JSON.stringify({ disp: dispositivo, ate: agora + VALIDADE_MOTOR });
    if (!motorId) { motorId = (await G.driveCreate(ARQ_MOTOR, eu())).id; est.motorAqui = true; est.motorDe = dispositivo; return; }
    const m = JSON.parse(await G.driveGet(motorId) || '{}');
    if (m.disp && m.disp !== dispositivo && m.ate > agora) { est.motorAqui = false; est.motorDe = m.disp; return; }
    await G.driveUpdate(motorId, eu()); est.motorAqui = true; est.motorDe = dispositivo;
  } catch (e) { if (e.status === 404) motorId = ''; console.warn('motor', e); }
}

export async function sincronizar({ manual = false } = {}) {
  if (!habilitado()) { if (manual) toast('Ative a base compartilhada em Configurações e conecte a conta Google com a permissão de guardar no Drive.', 'bad'); return false; }
  if (ocupado || pausas) return false;
  ocupado = true; est.fase = 'sincronizando'; avisar();
  try {
    await disputarMotor();
    const memo = lerLocal(K_BASE, null);
    let id = await arquivo(ARQ_BASE, 'baseFileId');
    if (!id) {
      const r = await G.driveCreate(ARQ_BASE, pacote());
      store.setConfig({ baseFileId: r.id });
      gravarLocal(K_BASE, { rev: r.headRevisionId, h: hashes(store.state()), cfg: carimbo() });
    } else {
      const meta = await G.driveMeta(id);
      let enviar = !memo || JSON.stringify(hashes(store.state())) !== JSON.stringify(memo.h) || carimbo() !== memo.cfg;
      let rev = meta.headRevisionId;
      if (!memo || meta.headRevisionId !== memo.rev) {
        const remoto = store.sanear(JSON.parse(await G.driveGet(id)));
        const m = mesclar(store.state(), remoto, memo?.h);
        const extra = {};
        if (m.mudouLocal) await store.criarPonto('antes de receber mudanças de outro computador');
        const sup = [...new Set([...store.state().supressao, ...(remoto.supressao || [])])];
        if (sup.length !== store.state().supressao.length) extra.supressao = sup;
        const desc = [...new Set([...(store.state().descartadas || []), ...(remoto.descartadas || [])])];
        if (desc.length !== (store.state().descartadas || []).length) extra.descartadas = desc;
        if ((remoto.painel?.atualizadoEm || '') > (store.state().painel?.atualizadoEm || '')) extra.painel = remoto.painel;
        if (m.mudouLocal || Object.keys(extra).length) store.aplicar(m.cols, extra);
        const cfgNova = mesclarConfig(remoto);
        enviar = m.mudouRemoto || cfgNova || sup.length !== (remoto.supressao || []).length || desc.length !== (remoto.descartadas || []).length || (store.state().painel?.atualizadoEm || '') > (remoto.painel?.atualizadoEm || '');
      }
      if (enviar) rev = (await G.driveUpdate(id, pacote())).headRevisionId;
      gravarLocal(K_BASE, { rev, h: hashes(store.state()), cfg: carimbo() });
    }
    est.fase = 'ok'; est.erro = ''; est.ultimo = new Date().toISOString();
    return true;
  } catch (e) {
    console.error('sincronização', e);
    if (e.status === 404) store.setConfig({ baseFileId: '' });
    est.fase = 'erro'; est.erro = e.message || String(e);
    if (manual) toast('Não foi possível sincronizar: ' + est.erro, 'bad');
    return false;
  } finally { ocupado = false; avisar(); }
}

export function iniciar() {
  if (timer) return;
  timer = setInterval(() => sincronizar(), INTERVALO);
  sincronizar();
}
export function parar() { clearInterval(timer); timer = null; est.fase = 'parado'; avisar(); }

// Mudanças locais seguem para o Drive alguns segundos depois
store.onChange(w => { if (w === 'externo' || !timer || !habilitado()) return; clearTimeout(pendente); pendente = setTimeout(() => sincronizar(), 12000); });
G.onAuth(() => { if (habilitado()) iniciar(); else parar(); });
