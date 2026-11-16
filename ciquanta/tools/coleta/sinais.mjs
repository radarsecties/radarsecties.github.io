// Sinais do mercado e editais: notícias sobre computação quântica e P&D no Brasil, associadas às organizações do mapeamento,
// e chamadas públicas de fomento. Grava data/sinais.json e data/editais-auto.json.
import { baixar, lerRSS, ler, gravar, hash, norm, agora, organizacoes, indiceApelidos, citadas, sleep } from './lib.mjs';

const GN = q => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;

// Consultas por tema: cada uma vira uma etiqueta no sinal
export const CONSULTAS = [
  ['quantica', '"computação quântica" when:7d'],
  ['quantica', '"tecnologias quânticas" OR "tecnologia quântica" Brasil when:7d'],
  ['quantica', '"quantum computing" Brazil when:14d'],
  ['ciquanta', 'CIQUANTA OR "computador quântico" Paraíba when:30d'],
  ['seguranca', '"pós-quântica" OR "pós-quântico" OR "post-quantum" Brasil when:14d'],
  ['financeiro', '"computação quântica" (banco OR bancos OR Febraban OR financeiro) when:30d'],
  ['saude', '"computação quântica" (saúde OR fármacos OR hospital) when:30d'],
  ['energia', '"computação quântica" (energia OR petróleo OR Petrobras) when:30d'],
  ['agro', '"computação quântica" (agro OR agronegócio OR Embrapa) when:30d'],
  ['investimento', '(deeptech OR "deep tech") (investimento OR aporte OR rodada) Brasil when:7d'],
  ['pdi', '("Lei do Bem" OR "PD&I" OR "P&D") investimento empresa when:7d'],
];
const CONSULTAS_EDITAIS = [
  '"chamada pública" (inovação OR "P&D" OR tecnologia) when:14d',
  '(Finep OR CNPq OR EMBRAPII OR BNDES) (edital OR chamada) inovação when:14d',
  '(FAPESQ OR "Fundação de Apoio à Pesquisa") edital when:30d',
  '"computação quântica" (edital OR chamada) when:60d',
];
const FEEDS = [
  ['EMBRAPII', 'https://embrapii.org.br/feed/'],
  ['Agência FAPESP', 'https://agencia.fapesp.br/rss/'],
];

const TEMA = /qu[aâ]ntic|quantum|p[oó]s-qu[aâ]ntic|criptografia|deep ?tech|supercomput|intelig[eê]ncia artificial|semicondutor|P&D|PD&I|inova[cç][aã]o/i;
const EDITAL = /\b(chamada|edital|editais|sele[cç][aã]o p[uú]blica|inscri[cç][oõ]es abertas|programa .{0,40}inscri)/i;
// Chamada aberta e ligada a pesquisa, inovação ou fomento; resultados de seleção ficam de fora
const ABERTA = /\b(lan[cç]a[mr]?|abre[mr]?|abert[ao]s?|inscri[cç][oõ]es|recebe[mr]? propostas|publica[mr]?|prorroga|est[aá] com|nova chamada|novo edital)\b/i;
const RESULTADO = /\b(selecionad|contemplad|aprovad|resultado|vencedor|premiad|classificad|homologa)/i;
const FOMENTO = /qu[aâ]ntic|quantum|inova|pesquis|tecnol[oó]g|cient|startup|deep ?tech|P&D|PD&I|Finep|CNPq|EMBRAPII|BNDES|Sebrae|MCTI|FAP[A-Z]{1,4}\b|FAPESQ|ANEEL|ANP\b|Capes|subven[cç]/i;
// O Google Notícias devolve resultados frouxos: cada tema exige palavras no título para o sinal valer
const QUANT = /qu[aâ]ntic|quantum|qubit/i;
const EXIGE = { quantica: QUANT, ciquanta: /ciquanta|qu[aâ]ntic|quantum/i, seguranca: /p[oó]s-qu[aâ]ntic|post-quantum|qu[aâ]ntic|quantum/i, financeiro: QUANT, saude: QUANT, energia: QUANT, agro: QUANT,
  investimento: /deep ?tech|startup|aporte|rodada|investiment|venture/i, pdi: /Lei do Bem|P&D|PD&I|inova|pesquis|tecnolog|cient/i, edital: /./ };
export const relevante = (tema, texto) => (EXIGE[tema] || /./).test(texto);
export const chamadaAberta = t => EDITAL.test(t) && ABERTA.test(t) && !RESULTADO.test(t) && FOMENTO.test(t);
const MESES = { janeiro: 1, fevereiro: 2, 'março': 3, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };

/** Procura um prazo no texto: "até 15/12/2026", "até 15 de dezembro". Só aceita datas futuras. */
export function prazoDe(texto, base = new Date()) {
  const t = String(texto);
  let m = t.match(/at[eé]\s+(?:o dia\s+)?(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?/i);
  let d = null;
  if (m) d = new Date(+(m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : base.getFullYear()), +m[2] - 1, +m[1]);
  else if ((m = t.match(/at[eé]\s+(?:o dia\s+)?(\d{1,2})\s+de\s+([a-zç]+)(?:\s+de\s+(\d{4}))?/i)) && MESES[norm(m[2])]) d = new Date(+(m[3] || base.getFullYear()), MESES[norm(m[2])] - 1, +m[1]);
  if (!d || isNaN(d)) return '';
  if (!m[3] && d < base) d.setFullYear(d.getFullYear() + 1);
  return d >= base ? d.toISOString().slice(0, 10) : '';
}
const separarFonte = (titulo, fonte) => {
  if (fonte?.nome && titulo.endsWith(' - ' + fonte.nome)) return titulo.slice(0, -(fonte.nome.length + 3));
  return titulo;
};

export async function coletarSinais({ log = console.log } = {}) {
  const orgs = organizacoes(), indice = indiceApelidos(orgs);
  const atual = ler('sinais.json', { itens: [] });
  const porId = new Map(atual.itens.map(i => [i.id, i]));
  const editais = ler('editais-auto.json', { itens: [] });
  const edPorId = new Map(editais.itens.filter(i => chamadaAberta(i.titulo)).map(i => [i.id.replace(/^ed-/, ''), i]));
  let lidos = 0, falhas = [], novos = 0, novosEd = 0;

  const registrar = (it, tema, origem) => {
    const titulo = separarFonte(it.titulo, it.fonte);
    const id = hash(norm(titulo));
    const texto = `${titulo} ${it.resumo}`;
    const ehEdital = chamadaAberta(titulo);
    if (ehEdital) {
      if (!edPorId.has(id)) { novosEd++; edPorId.set(id, { id: 'ed-' + id, titulo, orgao: it.fonte?.nome || origem, link: it.link, publicado: it.data || agora(), prazo: prazoDe(texto), fonte: origem, coletadoEm: agora() }); }
      else { const e = edPorId.get(id); e.prazo ||= prazoDe(texto); }
    }
    if (!ehEdital && !relevante(tema, titulo)) return;
    const cur = porId.get(id);
    if (cur) { cur.edital = ehEdital; if (!cur.temas.includes(tema)) cur.temas.push(tema); return; }
    novos++;
    porId.set(id, { id, titulo, fonte: it.fonte?.nome || origem, link: it.link, data: it.data || agora(), temas: [tema], orgs: citadas(texto, orgs, indice), edital: ehEdital, resumo: it.resumo.slice(0, 280), coletadoEm: agora() });
  };

  for (const [tema, q] of CONSULTAS) {
    try { const itens = lerRSS(await baixar(GN(q))); lidos += itens.length; itens.forEach(i => registrar(i, tema, 'Google Notícias')); }
    catch (e) { falhas.push(`${tema}: ${e.message}`); }
    await sleep(1600);
  }
  for (const q of CONSULTAS_EDITAIS) {
    try { const itens = lerRSS(await baixar(GN(q))); lidos += itens.length; itens.filter(i => chamadaAberta(i.titulo)).forEach(i => registrar(i, 'edital', 'Google Notícias')); }
    catch (e) { falhas.push(`editais: ${e.message}`); }
    await sleep(1600);
  }
  for (const [nome, url] of FEEDS) {
    try {
      const itens = lerRSS(await baixar(url)).filter(i => TEMA.test(i.titulo + ' ' + i.resumo) || EDITAL.test(i.titulo));
      lidos += itens.length; itens.forEach(i => registrar({ ...i, fonte: { nome } }, chamadaAberta(i.titulo) ? 'edital' : 'pdi', nome));
    } catch (e) { falhas.push(`${nome}: ${e.message}`); }
  }
  if (!lidos && falhas.length) throw new Error('Nenhuma fonte de notícias respondeu: ' + falhas.join('; '));

  // Reassocia todos os sinais às organizações (o mapeamento pode ter crescido) e mantém 120 dias
  const limite = new Date(Date.now() - 120 * 864e5).toISOString();
  const itens = [...porId.values()].filter(i => i.data >= limite).map(i => ({ ...i, temas: i.temas.filter(t => i.edital || relevante(t, i.titulo)) })).filter(i => i.temas.length).map(i => ({ ...i, orgs: citadas(`${i.titulo} ${i.resumo}`, orgs, indice) }))
    .sort((a, b) => b.data.localeCompare(a.data)).slice(0, 600);
  gravar('sinais.json', { atualizadoEm: agora(), aviso: 'Títulos e links de notícias públicas; o conteúdo pertence a cada veículo.', itens });
  const limEd = new Date(Date.now() - 180 * 864e5).toISOString();
  const eds = [...edPorId.values()].filter(e => e.publicado >= limEd).sort((a, b) => b.publicado.localeCompare(a.publicado)).slice(0, 300);
  gravar('editais-auto.json', { atualizadoEm: agora(), aviso: 'Chamadas identificadas automaticamente em notícias; confirme prazo e regras na página oficial.', itens: eds });
  const comOrg = itens.filter(i => i.orgs.length).length;
  log(`sinais: ${lidos} lidos, ${novos} novos, ${itens.length} guardados (${comOrg} citam organizações) · editais: ${novosEd} novos, ${eds.length} guardados${falhas.length ? ' · falhas: ' + falhas.join('; ') : ''}`);
  return { n: novos, total: itens.length, editais: novosEd, falhas };
}
