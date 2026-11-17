// Público sugerido para ações de marketing ligadas à agenda do CIQUANTA.
import * as store from './store.js';
import { isEmail } from './util.js';
import { pontuar, contexto } from './score.js';

const PAPEL_INSTITUCIONAL = /institucion|diretori|gabinete|presid|reitor|superintend|inova/i;

/**
 * Para eventos do próprio CIQUANTA: autoridades, fomentadores, parceiros e organizações já em relacionamento,
 * mais os canais de diretoria das organizações de maior potencial.
 * Para eventos externos (potenciais): organizações dos setores do evento.
 * Um contato por organização, sempre o mais direto (pessoa antes de canal), sem descadastrados.
 */
export function publicoDoEvento(ev, { limite = 150 } = {}) {
  const s = store.state(), ctx = contexto();
  const setores = new Set(ev.setores || []);
  const proprio = !['potencial', 'prazo'].includes(ev.tipo);
  const escolher = o => {
    const cts = s.contatos.filter(c => c.orgId === o.id && isEmail(c.email) && !c.optout && !store.suprimido(c.email));
    if (!cts.length) return null;
    return [...cts].sort((a, b) => (a.canal ? 1 : 0) - (b.canal ? 1 : 0) || (PAPEL_INSTITUCIONAL.test(b.area || b.cargo || '') ? 1 : 0) - (PAPEL_INSTITUCIONAL.test(a.area || a.cargo || '') ? 1 : 0))[0];
  };
  const candidatas = s.orgs.filter(o => {
    if ((o.tags || []).includes('CNPJ irregular')) return false;
    if (setores.size) return setores.has(o.setor);
    if (!proprio) return false;
    return ['Autoridade', 'Fomentador'].includes(o.segmento) || ['contato', 'engajada', 'parceira'].includes(o.relacionamento) || pontuar(o, ctx).total >= 60;
  }).map(o => ({ o, p: pontuar(o, ctx).total + ({ parceira: 30, engajada: 20, contato: 8 }[o.relacionamento] || 0) }))
    .sort((a, b) => b.p - a.p);
  const out = [];
  for (const { o } of candidatas) { const c = escolher(o); if (c) out.push(c.id); if (out.length >= limite) break; }
  return out;
}
