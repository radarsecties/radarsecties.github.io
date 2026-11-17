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
// Computação e informação quânticas, não física quântica em geral ("quantum yield", "quantum dots" e afins ficam de fora)
const QUANTICO = /quantum[ -](comput|algorithm|annealing|annealer|circuit|machine learning|neural|optimi[sz]|approximate optimi|simulat|information|cryptograph|key distribution|communicat|internet|network|sens(?:or|ing)|software|advantage|supremacy|hardware|processor|chip|error[ -]correct|gate|walk|random number|state|entangle|programming|cloud|readiness|safe|resistant|secure)|simulation of (?:open )?quantum|qubit|\bqaoa\b|\bvqe\b|\bqkd\b|\bqrng\b|variational quantum|post-quantum|p[oó]s-qu[aâ]ntic|computa[cç][aã]o qu[aâ]ntica|computador(?:es)? qu[aâ]ntico|algoritmos? qu[aâ]ntico|criptografia qu[aâ]ntica|redes? qu[aâ]ntica|internet qu[aâ]ntica|era qu[aâ]ntica|ataques? qu[aâ]ntico|entropia qu[aâ]ntica|ml-kem|crystals-(?:kyber|dilithium)/i;
const TEMA_QUANTICO = /quantum computing|quantum information/i;
const BUSCA_QUANTICA = '"quantum computing" OR "quantum algorithm" OR qubit OR "post-quantum" OR "quantum annealing" OR "quantum machine learning" OR "quantum cryptography" OR "quantum information" OR "quantum key distribution" OR "quantum optimization" OR "computação quântica"';
// Temas próximos das linhas de pesquisa do CIQUANTA: contam a favor, sem serem quânticos
const AFINS = /optimi[sz]ation|otimiza|cryptograph|criptograf|machine learning|aprendizado de m[aá]quina|molecular simulation|simula[cç][aã]o|high.performance computing|computa[cç][aã]o de alto desempenho|reservoir|portfolio|carteira|logistics|log[ií]stica|power system|sistemas de pot[eê]ncia/i;

const SEGMENTOS = new Set(['Empresa', 'Startup', 'Academia/ICT', 'Fomentador', 'Associação/Rede']);
const TIPOS_OK = { Empresa: ['company'], Startup: ['company'], 'Academia/ICT': ['education', 'facility', 'nonprofit', 'government', 'company'], Fomentador: ['government', 'company', 'nonprofit', 'funder'], 'Associação/Rede': ['nonprofit', 'company', 'facility', 'other'] };

const oa = async caminho => baixar(`${OA}${caminho}${chave()}`, { tipo: 'json', timeout: 25000, headers: { Accept: 'application/json' } });
// Nomes em português e em inglês viram as mesmas palavras ("Fundação" e "Foundation", "Banco" e "Bank")
const SINONIMOS = { foundation: 'fundacao', university: 'universidade', national: 'nacional', research: 'pesquisa', center: 'centro', centre: 'centro', bank: 'banco', development: 'desenvolvimento', technology: 'tecnologia', technological: 'tecnologico', federal: 'federal', state: 'estadual', agricultural: 'agropecuaria', telecommunications: 'telecomunicacoes', energy: 'energia', health: 'saude', space: 'espaciais', hospital: 'hospital', military: 'militar', engineering: 'engenharia', northeast: 'nordeste', north: 'norte', south: 'sul', southeast: 'sudeste' };
const VAZIAS = new Set(['s.a', 'sa', 'ltda', 'grupo', 'the', 'and', 'for', 'of', 'de', 'do', 'da', 'dos', 'das', 'em', 'brasil', 'brazil', 'brazilian', 'brasileira', 'brasileiro', 'instituto', 'institute', 'company', 'companhia', 'inc']);
const palavras = s => norm(s).replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9 ]/g, ' ').split(' ').map(w => SINONIMOS[w] || w).filter(w => w.length > 2 && !VAZIAS.has(w));
/** Domínio registrável (fiocruz.br, itau.com.br). Sites dentro de gov.br não identificam a organização. */
export const dominioBase = u => { const d = dominio(u); if (!d) return ''; const l = d.split('.'); const b = l.slice(/\.(com|gov|org|edu|mil|net|ind|coop|art)\.br$/.test(d) ? -3 : -2).join('.'); return ['gov.br', 'org.br', 'com.br', 'edu.br'].includes(b) ? '' : b; };

/** Escolhe a instituição da OpenAlex que corresponde à organização: pelo domínio do site ou pelo nome. */
export function escolherInstituicao(org, candidatas) {
  const dOrg = dominioBase(org.site), pOrg = new Set(palavras(org.nomeFantasia || org.nome));
  const siglas = [org.nome, org.nomeFantasia, ...String(org.nome).split(/[,(]/)].map(x => norm(String(x || '').replace(/\)/g, ''))).filter(x => /^[a-z0-9&-]{2,10}$/.test(x));
  let melhor = null, nota = 0;
  for (const c of candidatas || []) {
    const pC = palavras(c.display_name), comuns = pC.filter(w => pOrg.has(w)).length;
    const nome = (pOrg.size ? comuns / pOrg.size : 0) * 1.2 + (pC.length ? comuns / pC.length : 0) * 0.8;
    const tipo = (TIPOS_OK[org.segmento] || []).includes(c.type) ? 0.4 : 0;
    // Sigla registrada na OpenAlex (INPE, CBPF, IME) vale como nome
    const sigla = siglas.some(a => (c.display_name_acronyms || []).some(x => norm(x) === a)) ? 2 + Math.log10((c.works_count || 0) + 1) * 0.05 : 0;
    // Mesmo domínio: decide o porte (a sede publica mais que uma unidade regional); sem domínio, decide o nome
    const n = dOrg && dominioBase(c.homepage_url) === dOrg ? 3 + Math.log10((c.works_count || 0) + 1) * 0.6 + nome * 0.3 + tipo : Math.max(nome, sigla) + tipo - (c.country_code && c.country_code !== 'BR' ? 1 : 0);
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
    const quant = QUANTICO.test(titulo) || temas.some(t => TEMA_QUANTICO.test(t)), afim = AFINS.test(titulo) || temas.some(t => AFINS.test(t));
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
  // Versão 2: critério estrito de computação quântica e associação por domínio; refaz tudo uma vez
  if (!(base.versao >= 2)) { for (const x of Object.values(base.porOrg)) { delete x.buscadoEm; delete x.instituicao; } base.versao = 2; }
  // Versão 3: associação por sigla; refaz as organizações que ficaram sem instituição
  if (base.versao < 3) { for (const x of Object.values(base.porOrg)) if (!x.instituicao) { delete x.buscadoEm; x.pessoas = []; } base.versao = 3; }
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
      if (!inst) {
        const q = encodeURIComponent((o.nomeFantasia || o.nome).replace(/\(.*?\)/g, '').trim());
        const r = await oa(`/institutions?search=${q}&filter=country_code:BR&per_page=8&select=id,display_name,display_name_acronyms,type,homepage_url,country_code,works_count`);
        const c = escolherInstituicao(o, r.results);
        inst = x.instituicao = c ? { id: c.id.replace('https://openalex.org/', ''), nome: c.display_name, tipo: c.type, trabalhos: c.works_count } : null;
        await sleep(120);
      }
      x.buscadoEm = agora();
      if (!inst) { x.pessoas = []; continue; }
      comInst++;
      const sel = 'select=id,doi,title,publication_year,authorships,topics';
      const [rec, qua] = await Promise.all([
        oa(`/works?filter=authorships.institutions.lineage:${inst.id},from_publication_date:${desde}&sort=publication_date:desc&per_page=100&${sel}`),
        oa(`/works?filter=authorships.institutions.lineage:${inst.id},title_and_abstract.search:${encodeURIComponent(BUSCA_QUANTICA)}&sort=publication_date:desc&per_page=50&${sel}`)
          .catch(() => oa(`/works?filter=authorships.institutions.lineage:${inst.id},title_and_abstract.search:quantum%20computing&sort=publication_date:desc&per_page=50&${sel}`)).catch(() => ({ results: [] })),
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
