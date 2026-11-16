// Plano de captação: metas, frentes de financiamento e cobertura por mecanismo, calculados sobre a base do CRM.
import * as store from './store.js';

/** Frentes de captação. Cada mecanismo de fomento pertence a uma frente; oportunidades sem mecanismo contam como receita direta. */
export const FRENTES = [
  { id: 'incentivos', nome: 'Incentivos fiscais à P&D', desc: 'Empresas que reduzem tributos ou cumprem contrapartidas investindo em projetos com ICT.',
    mecs: ['lei-do-bem', 'lei-de-tics', 'ppi', 'lei-tics-zfm', 'brasil-semicon', 'mover', 'redata', 'sudene', 'importacao-pesquisa'] },
  { id: 'regulatorio', nome: 'Obrigações regulatórias de PD&I', desc: 'Concessionárias de energia e operadoras de óleo e gás com percentual obrigatório de investimento.',
    mecs: ['pdi-aneel', 'pdi-anp'] },
  { id: 'fomento', nome: 'Fomento público: subvenção, crédito e bolsas', desc: 'Agências, bancos, fundos setoriais e fundações de amparo.',
    mecs: ['finep', 'bndes', 'embrapii', 'funttel', 'fne-bnb', 'faps', 'sebrae', 'ibquantica', 'nib', 'fndct-setoriais', 'programas-startups', 'cnpq-rhae', 'fust', 'fundo-clima', 'pbia', 'senai-plataforma'] },
  { id: 'compras', nome: 'Compras públicas e encomendas tecnológicas', desc: 'Contratação direta de PD&I pelo poder público e instrumentos do Marco Legal de CT&I.',
    mecs: ['marco-legal-cti', 'etec', 'ceis', 'retid', 'compras-inovacao', 'fundacoes-apoio'] },
  { id: 'cooperacao', nome: 'Cooperação, filantropia e investimento', desc: 'Cooperação internacional, fundos patrimoniais, venture capital e ambiente de startups.',
    mecs: ['fundos-patrimoniais', 'coop-internacional', 'venture', 'marco-startups', 'inova-simples', 'sandbox'] },
  { id: 'direta', nome: 'Receita direta: serviços, acesso e patrocínios', desc: 'Contratos sem mecanismo de fomento associado.', mecs: [] },
];
const FRENTE_DO_MEC = Object.fromEntries(FRENTES.flatMap(f => f.mecs.map(m => [m, f.id])));
export const frenteDe = mec => FRENTE_DO_MEC[mec] || 'direta';

const valor = o => Number(o.valor) || 0;
const trimestre = iso => { const d = new Date(iso + 'T12:00:00'); return isNaN(d) ? '' : `${d.getFullYear()}-T${Math.floor(d.getMonth() / 3) + 1}`; };

export function resumo() {
  const s = store.state(), conf = s.config, metas = conf.metas || {};
  const vivas = s.oportunidades.filter(o => o.etapa !== 'perdida');
  const abertas = vivas.filter(o => o.etapa !== 'contratada'), fechadas = vivas.filter(o => o.etapa === 'contratada');
  const contratado = fechadas.reduce((a, o) => a + valor(o), 0), ponderado = abertas.reduce((a, o) => a + store.pipelineValor(o), 0);
  const meta = Number(conf.metaAnual) || 0;
  const comContato = new Set(s.contatos.filter(c => c.email).map(c => c.orgId));
  const abordada = new Set([...s.envios.filter(e => e.status === 'enviado').map(e => store.get('contatos', e.contatoId)?.orgId), ...s.orgs.filter(o => o.relacionamento && o.relacionamento !== 'mapeada').map(o => o.id)]);

  const medir = (ops, orgs) => ({
    contratado: ops.filter(o => o.etapa === 'contratada').reduce((a, o) => a + valor(o), 0),
    ponderado: ops.filter(o => o.etapa !== 'contratada').reduce((a, o) => a + store.pipelineValor(o), 0),
    bruto: ops.filter(o => o.etapa !== 'contratada').reduce((a, o) => a + valor(o), 0),
    nOpp: ops.length, orgs: orgs.length, comContato: orgs.filter(o => comContato.has(o.id)).length, abordadas: orgs.filter(o => abordada.has(o.id)).length,
  });
  const frentes = FRENTES.map(f => {
    const ops = vivas.filter(o => frenteDe(o.mecanismo) === f.id);
    const orgs = f.mecs.length ? s.orgs.filter(o => (o.mecanismos || []).some(m => f.mecs.includes(m))) : [];
    return { ...f, meta: Number(metas[f.id]) || 0, ...medir(ops, orgs) };
  });
  const mecs = [...new Set([...s.orgs.flatMap(o => o.mecanismos || []), ...vivas.map(o => o.mecanismo).filter(Boolean)])];
  const porMec = mecs.map(m => ({ id: m, frente: frenteDe(m), ...medir(vivas.filter(o => o.mecanismo === m), s.orgs.filter(o => (o.mecanismos || []).includes(m))) }))
    .sort((a, b) => (b.contratado + b.ponderado) - (a.contratado + a.ponderado) || b.orgs - a.orgs);

  // Previsão: próximos seis trimestres a partir do atual
  const hoje = new Date(), tri = [];
  for (let i = 0; i < 6; i++) { const d = new Date(hoje.getFullYear(), Math.floor(hoje.getMonth() / 3) * 3 + i * 3, 1); tri.push({ id: `${d.getFullYear()}-T${Math.floor(d.getMonth() / 3) + 1}`, rotulo: `${Math.floor(d.getMonth() / 3) + 1}º tri ${d.getFullYear()}`, contratado: 0, ponderado: 0 }); }
  let semData = 0;
  for (const o of vivas) { const t = tri.find(x => x.id === trimestre(o.previsao || '')); if (!t) { if (o.etapa !== 'contratada') semData += store.pipelineValor(o); continue; } if (o.etapa === 'contratada') t.contratado += valor(o); else t.ponderado += store.pipelineValor(o); }

  const lacuna = Math.max(0, meta - contratado - ponderado);
  const medio = abertas.length ? abertas.reduce((a, o) => a + valor(o), 0) / abertas.length : 0;
  const prob = abertas.length ? abertas.reduce((a, o) => a + (Number(o.probabilidade) || 0), 0) / abertas.length : 0;
  const novas = meta && lacuna && abertas.length >= 3 && medio && prob ? Math.ceil(lacuna / (medio * prob / 100)) : 0;
  const top = [...abertas].sort((a, b) => store.pipelineValor(b) - store.pipelineValor(a)).slice(0, 8);
  return { meta, contratado, ponderado, lacuna, cobertura: meta ? (contratado + ponderado) / meta : 0, abertas: abertas.length, fechadas: fechadas.length,
    frentes, porMec, tri, semData, medio, prob, novas, top, somaMetas: frentes.reduce((a, f) => a + f.meta, 0) };
}
