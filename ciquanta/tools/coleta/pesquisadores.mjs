// Pessoas de P&D das organizações, a partir da produção científica e técnica (OpenAlex) e dos registros ORCID.
//
// Vai além dos portais institucionais: encontra quem de fato publica pela organização (artigos, anais,
// relatórios técnicos), os temas de cada pessoa, se ela trabalha com computação quântica e o trabalho
// mais recente. Do ORCID vêm o cargo atual e o e-mail, apenas quando o próprio pesquisador o tornou
// público e quando o domínio é o da organização (e-mail profissional). Nenhum e-mail pessoal entra.
//
// Variáveis opcionais: OPENALEX_API_KEY (cota maior na OpenAlex), CIQUANTA_LOTE_PESQUISA (organizações por execução).
import { ler, gravar, agora, dominio, norm, organizacoes, baixar, sleep } from './lib.mjs';

const LOTE = Number(process.env.CIQUANTA_LOTE_PESQUISA || 45);
const RENOVAR_DIAS = 30, POR_ORG = 15, ANOS = 6;
const OA = 'https://api.openalex.org';
const chave = () => process.env.OPENALEX_API_KEY ? `&api_key=${encodeURIComponent(process.env.OPENALEX_API_KEY)}` : '';
const QUANTICO = /quantum|qu[aâ]ntic|qubit|post-quantum|p[oó]s-qu[aâ]ntic|annealing|variational quantum|qaoa/i;
// Temas próximos das linhas de pesquisa do CIQUANTA: contam a favor, sem serem quânticos
const AFINS = /optimi[sz]ation|otimiza|cryptograph|criptograf|machine learning|aprendizado de m[aá]quina|molecular simulation|simula[cç][aã]o|high.performance computing|computa[cç][aã]o de alto desempenho|reservoir|portfolio|carteira|logistics|log[ií]stica|power system|sistemas de pot[eê]ncia/i;

const SEGMENTOS = new Set(['Empresa', 'Startup', 'Academia/ICT', 'Fomentador', 'Associação/Rede']);
const TIPOS_OK = { Empresa: ['company'], Startup: ['company'], 'Academia/ICT': ['education', 'facility', 'nonprofit', 'government', 'company'], Fomentador: ['government', 'company', 'nonprofit', 'funder'], 'Associação/Rede': ['nonprofit', 'company', 'facility', 'other'] };

const oa = async caminho => baixar(`${OA}${caminho}${chave()}`, { tipo: 'json', timeout: 25000, headers: { Accept: 'application/json' } });
const palavras = s => norm(s).replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(w => w.length > 2 && !['s.a', 'sa', 'ltda', 'grupo', 'the', 'and', 'de', 'do', 'da', 'dos', 'das', 'brasil', 'brazil', 'instituto', 'institute', 'company', 'companhia'].includes(w));

/** Escolhe a instituição da OpenAlex que corresponde à organização: pelo domínio do site ou pelo nome. */
export function escolherInstituicao(org, candidatas) {
  const dOrg = dominio(org.site), pOrg = new Set(palavras(org.nomeFantasia || org.nome));
  let melhor = null, nota = 0;
  for (const c of candidatas || []) {
    const dC = dominio(c.homepage_url);
    let n = 0;
    if (dOrg && dC && (dC === dOrg || dC.endsWith('.' + dOrg) || dOrg.endsWith('.' + dC))) n += 3;
    const pC = palavras(c.display_name), comuns = pC.filter(w => pOrg.has(w)).length;
    const cobertura = pOrg.size ? comuns / pOrg.size : 0, precisao = pC.length ? comuns / pC.length : 0;
    n += cobertura * 1.2 + precisao * 0.8;
    if ((TIPOS_OK[org.segmento] || []).includes(c.type)) n += 0.4;
    if (c.country_code && c.country_code !== 'BR') n -= 1;
    if (n > nota) { nota = n; melhor = c; }
  }
  // Exige o domínio ou um nome muito próximo: melhor ficar sem do que associar a organização errada
  return nota >= 1.75 ? melhor : null;
}

/** Junta os trabalhos por pessoa, contando só as autorias feitas pela própria organização. */
export function agruparAutores(trabalhos, instId) {
  const por = new Map();
  for (const w of trabalhos) {
    const titulo = w.title || w.display_name || '', ano = w.publication_year || 0;
    const temas = (w.topics || []).map(t => t.display_name).filter(Boolean);
    const quant = QUANTICO.test(titulo) || temas.some(t => QUANTICO.test(t)), afim = AFINS.test(titulo) || temas.some(t => AFINS.test(t));
    for (const a of w.authorships || []) {
      if (!(a.institutions || []).some(i => i.id === instId || (i.lineage || []).includes(instId))) continue;
      const id = a.author?.id; if (!id || !a.author.display_name) continue;
      const p = por.get(id) || { id: id.replace('https://openalex.org/', ''), nome: a.author.display_name, orcid: (a.author.orcid || '').replace('https://orcid.org/', ''), trabalhos: 0, ultimoAno: 0, temas: {}, quantico: false, afim: false, destaque: null };
      p.trabalhos++; p.quantico ||= quant; p.afim ||= afim;
      temas.slice(0, 2).forEach(t => { p.temas[t] = (p.temas[t] || 0) + 1; });
      // Trabalho de destaque: o mais recente sobre computação quântica; sem nenhum, o mais recente
      const cand = { titulo, ano, url: w.doi || w.id, quantico: quant }, d = p.destaque;
      if (!d || (quant && !d.quantico) || (quant === d.quantico && ano > d.ano)) p.destaque = cand;
      p.ultimoAno = Math.max(p.ultimoAno, ano);
      por.set(id, p);
    }
  }
  return [...por.values()]
    .map(p => ({ ...p, temas: Object.entries(p.temas).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t), relevancia: (p.quantico ? 40 : 0) + (p.afim ? 12 : 0) + Math.min(30, p.trabalhos * 3) + Math.max(0, 18 - (new Date().getFullYear() - p.ultimoAno) * 4) }))
    .sort((a, b) => b.relevancia - a.relevancia || b.ultimoAno - a.ultimoAno);
}

/** Cargo atual e e-mail profissional público, quando o pesquisador os publicou no ORCID. */
export async function orcidPublico(orcid, org) {
  const out = {};
  const h = { headers: { Accept: 'application/json' }, tipo: 'json', timeout: 15000, tentativas: 2 };
  const dOrg = dominio(org.site);
  try {
    const e = await baixar(`https://pub.orcid.org/v3.0/${orcid}/email`, h);
    const ok = (e.email || []).filter(x => x.visibility === 'public' || x.visibility === 'PUBLIC').map(x => String(x.email || '').toLowerCase())
      .find(m => dOrg && /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(m) && (m.split('@')[1] === dOrg || m.split('@')[1].endsWith('.' + dOrg)));
    if (ok) out.email = ok;
  } catch {}
  try {
    const em = await baixar(`https://pub.orcid.org/v3.0/${orcid}/employments`, h);
    const pOrg = new Set(palavras(org.nomeFantasia || org.nome));
    for (const g of em['affiliation-group'] || []) for (const s of g.summaries || []) {
      const x = s['employment-summary']; if (!x || x['end-date']) continue;
      if (!palavras(x.organization?.name).some(w => pOrg.has(w))) continue;
      out.cargo = [x['role-title'], x['department-name']].filter(Boolean).join(', ');
      if (out.cargo) return out;
    }
  } catch {}
  return out;
}

export async function coletarPesquisadores({ log = console.log } = {}) {
  const base = ler('pesquisadores.json', { porOrg: {} });
  const limite = new Date(Date.now() - RENOVAR_DIAS * 864e5).toISOString();
  const ordem = { A: 0, B: 1, C: 2 }, ev = { confirmada: 0, indicios: 1 };
  const fila = organizacoes().filter(o => SEGMENTOS.has(o.segmento) && !(base.porOrg[o.id]?.buscadoEm > limite))
    .sort((a, b) => (ordem[a.prioridade] ?? 3) - (ordem[b.prioridade] ?? 3) || (ev[a.evidencia] ?? 2) - (ev[b.evidencia] ?? 2))
    .slice(0, LOTE);
  const desde = `${new Date().getFullYear() - ANOS}-01-01`;
  let comInst = 0, pessoas = 0, emails = 0, falhas = 0;
  for (const o of fila) {
    const x = base.porOrg[o.id] ||= {};
    try {
      let inst = x.instituicao;
      if (inst === undefined) {
        const q = encodeURIComponent((o.nomeFantasia || o.nome).replace(/\(.*?\)/g, '').trim());
        const r = await oa(`/institutions?search=${q}&filter=country_code:BR&per_page=8&select=id,display_name,type,homepage_url,country_code,works_count`);
        const c = escolherInstituicao(o, r.results);
        inst = x.instituicao = c ? { id: c.id.replace('https://openalex.org/', ''), nome: c.display_name, tipo: c.type, trabalhos: c.works_count } : null;
        await sleep(120);
      }
      x.buscadoEm = agora();
      if (!inst) { x.pessoas = x.pessoas || []; continue; }
      comInst++;
      const sel = 'select=id,doi,title,publication_year,authorships,topics';
      const [rec, qua] = await Promise.all([
        oa(`/works?filter=authorships.institutions.lineage:${inst.id},from_publication_date:${desde}&sort=publication_date:desc&per_page=100&${sel}`),
        oa(`/works?filter=authorships.institutions.lineage:${inst.id},title_and_abstract.search:quantum&sort=publication_date:desc&per_page=50&${sel}`).catch(() => ({ results: [] })),
      ]);
      const vistos = new Set(), trabalhos = [...(qua.results || []), ...(rec.results || [])].filter(w => !vistos.has(w.id) && vistos.add(w.id));
      const lista = agruparAutores(trabalhos, 'https://openalex.org/' + inst.id).slice(0, POR_ORG);
      const antigos = new Map((x.pessoas || []).map(p => [p.id, p]));
      for (const p of lista) {
        const a = antigos.get(p.id);
        if (a?.orcidVistoEm > limite) { p.email = a.email; p.cargo = a.cargo; p.orcidVistoEm = a.orcidVistoEm; }
        else if (p.orcid && (p.quantico || p.afim || p.relevancia >= 30)) { Object.assign(p, await orcidPublico(p.orcid, o)); p.orcidVistoEm = agora(); await sleep(150); }
        if (p.email) emails++;
      }
      x.pessoas = lista; pessoas += lista.length;
      await sleep(150);
    } catch (e) { falhas++; log(`pesquisadores: ${o.nome}: ${e.message}`); }
  }
  base.atualizadoEm = agora();
  base.fonte = 'OpenAlex (produção científica e técnica) e ORCID (dados tornados públicos pelos próprios pesquisadores)';
  gravar('pesquisadores.json', base);
  const total = Object.values(base.porOrg).reduce((a, v) => a + (v.pessoas?.length || 0), 0);
  log(`pesquisadores: ${fila.length} organizações consultadas, ${comInst} com produção identificada, ${pessoas} pessoas de P&D, ${emails} com e-mail profissional público, ${falhas} falhas · base: ${total} pessoas`);
  if (fila.length && falhas === fila.length) throw new Error('nenhuma consulta à OpenAlex funcionou');
  return { n: pessoas };
}
