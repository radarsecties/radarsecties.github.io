// Sinais do mercado: notícias coletadas todos os dias e associadas às organizações (data/sinais.json).
import * as store from './store.js';

let cache = { itens: [], porOrg: new Map(), atualizadoEm: '' };
const refParaOrg = id => 'org-' + String(id).replace(/^(ref|auto)-/, '');

export async function carregarSinais() {
  try {
    const r = await store.ref('sinais');
    const porOrg = new Map();
    for (const s of r.itens || []) for (const id of s.orgs || []) { const k = refParaOrg(id); if (!porOrg.has(k)) porOrg.set(k, []); porOrg.get(k).push(s); }
    cache = { itens: r.itens || [], porOrg, atualizadoEm: r.atualizadoEm || '' };
  } catch { /* sem coleta publicada ainda */ }
  return cache;
}
export const sinais = () => cache;
export const sinaisDe = orgId => cache.porOrg.get(orgId) || [];
/** Organizações citadas em notícias nos últimos `dias`. */
export function citadasRecentes(dias = 30) {
  const lim = new Date(Date.now() - dias * 864e5).toISOString(), out = new Set();
  cache.porOrg.forEach((l, id) => { if (l.some(s => s.data >= lim)) out.add(id); });
  return out;
}
export const TEMAS = { quantica: 'Computação quântica', ciquanta: 'CIQUANTA', seguranca: 'Criptografia pós-quântica', financeiro: 'Sistema financeiro', saude: 'Saúde', energia: 'Energia e petróleo', agro: 'Agro', investimento: 'Investimento em deep tech', pdi: 'P&D e incentivos', edital: 'Editais e chamadas' };
