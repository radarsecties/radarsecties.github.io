// Regras de negócio: sugestão de mecanismos por perfil e links de busca ativa
import { REGIAO } from './util.js';
import * as store from './store.js';

/** Sugere mecanismos aplicáveis a uma organização: padrão do setor, regras regionais e de porte. */
export function sugerirMecanismos(org) {
  const out = new Set();
  const setor = store.setoresLista().find(s => s.id === org.setor);
  (setor?.mecanismos || []).forEach(m => out.add(m));
  const seg = org.segmento || 'Empresa';
  if (seg === 'Empresa' || seg === 'Startup') {
    out.add('lei-do-bem'); out.add('embrapii'); out.add('marco-legal-cti');
    if (REGIAO[org.uf] === 'Nordeste') out.add('fne-bnb');
    if (seg === 'Startup' || /micro|pequen|^ME$|^EPP$/i.test(org.porte || '')) { out.add('sebrae'); out.add('faps'); out.add('marco-startups'); }
  } else if (seg === 'Fomentador') ['finep', 'bndes', 'embrapii', 'faps'].forEach(i => out.add(i));
  else if (seg === 'Autoridade') ['ibquantica', 'etec', 'nib'].forEach(i => out.add(i));
  return [...out];
}

const enc = encodeURIComponent;
/** Links prontos para busca ativa de contatos institucionais e de P&D de uma organização. */
export function linksBusca(nome, extra = {}) {
  const n = `"${nome}"`;
  return [
    { grupo: 'Pessoas-chave', titulo: 'LinkedIn: gestores de P&D e Inovação', url: `https://www.linkedin.com/search/results/people/?keywords=${enc(`${nome} (P&D OR inovação OR "pesquisa e desenvolvimento")`)}` },
    { grupo: 'Pessoas-chave', titulo: 'LinkedIn: Relações Governamentais / Institucionais', url: `https://www.linkedin.com/search/results/people/?keywords=${enc(`${nome} "relações governamentais" OR "relações institucionais"`)}` },
    { grupo: 'Pessoas-chave', titulo: 'Google: diretor(a) de inovação ou CTO', url: `https://www.google.com/search?q=${enc(`${n} ("diretor de inovação" OR "diretora de inovação" OR CTO OR "head de P&D")`)}` },
    { grupo: 'Canais oficiais', titulo: 'Google: e-mail institucional e "fale conosco"', url: `https://www.google.com/search?q=${enc(`${n} (contato OR "fale conosco" OR "relações com investidores") email`)}` },
    { grupo: 'Canais oficiais', titulo: 'Site oficial: páginas de inovação', url: extra.site ? `https://www.google.com/search?q=${enc(`site:${extra.site.replace(/^https?:\/\//, '').replace(/\/.*$/, '')} inovação OR P&D OR pesquisa`)}` : `https://www.google.com/search?q=${enc(`${n} site oficial inovação`)}` },
    { grupo: 'Canais oficiais', titulo: 'Relatório anual / de sustentabilidade (investimento em P&D)', url: `https://www.google.com/search?q=${enc(`${n} relatório anual investimento "P&D" filetype:pdf`)}` },
    { grupo: 'Fomento usado', titulo: 'Lei do Bem: aparece nas listas do MCTI?', url: `https://www.google.com/search?q=${enc(`site:gov.br/mcti ${n} "Lei do Bem"`)}` },
    { grupo: 'Fomento usado', titulo: 'Lei de TICs: empresa habilitada?', url: `https://www.google.com/search?q=${enc(`site:gov.br ${n} "Lei de Informática" OR "Lei de TICs" habilitação`)}` },
    { grupo: 'Fomento usado', titulo: 'Projetos Finep / BNDES / EMBRAPII', url: `https://www.google.com/search?q=${enc(`${n} (Finep OR BNDES OR EMBRAPII) projeto inovação`)}` },
    { grupo: 'Fomento usado', titulo: 'Projetos de PD&I ANEEL / ANP', url: `https://www.google.com/search?q=${enc(`${n} ("P&D ANEEL" OR "PD&I ANEEL" OR "cláusula de PD&I" ANP)`)}` },
    { grupo: 'Notícias', titulo: 'Notícias: quântica, IA e inovação', url: `https://news.google.com/search?q=${enc(`${nome} (quântica OR quantum OR inovação OR "inteligência artificial")`)}&hl=pt-BR&gl=BR&ceid=BR:pt-419` },
    { grupo: 'Dados cadastrais', titulo: 'Encontrar CNPJ pelo nome', url: `https://www.google.com/search?q=${enc(`${n} CNPJ matriz`)}` },
  ];
}

/** Buscas de prospecção por setor/mecanismo/UF (para descobrir novas empresas). */
export function linksProspeccao({ setor = '', mecanismo = '', uf = '' }) {
  const loc = uf ? ` ${uf}` : '';
  const s = setor || 'indústria';
  return [
    { titulo: `Empresas de ${s} que investem em P&D${loc}`, url: `https://www.google.com/search?q=${enc(`empresas ${s} investimento "P&D" inovação${loc}`)}` },
    { titulo: `Gestores de P&D em ${s}${loc} (LinkedIn)`, url: `https://www.linkedin.com/search/results/people/?keywords=${enc(`gerente P&D ${s}${loc}`)}` },
    { titulo: `Empresas de ${s} no LinkedIn${loc}`, url: `https://www.linkedin.com/search/results/companies/?keywords=${enc(`${s}${loc}`)}` },
    mecanismo && { titulo: `Beneficiárias de ${mecanismo}`, url: `https://www.google.com/search?q=${enc(`"${mecanismo}" empresas beneficiárias lista ${s}${loc}`)}` },
    { titulo: 'Listas oficiais da Lei do Bem (MCTI)', url: 'https://www.gov.br/mcti/pt-br/acompanhe-o-mcti/lei-do-bem' },
    { titulo: 'Empresas habilitadas na Lei de TICs (MCTI)', url: 'https://www.gov.br/mcti/pt-br/acompanhe-o-mcti/lei-de-tics' },
    { titulo: 'Projetos de PD&I ANEEL', url: 'https://www.gov.br/aneel/pt-br/assuntos/pesquisa-desenvolvimento-e-eficiencia-energetica' },
    { titulo: 'Projetos de PD&I ANP', url: 'https://www.gov.br/anp/pt-br/assuntos/tecnologia-meio-ambiente/pesquisa-desenvolvimento-e-inovacao' },
    { titulo: 'Unidades e projetos EMBRAPII', url: 'https://embrapii.org.br/' },
    { titulo: 'Notícias de investimento em quântica no Brasil', url: `https://news.google.com/search?q=${enc('computação quântica empresa Brasil investimento')}&hl=pt-BR&gl=BR&ceid=BR:pt-419` },
  ].filter(Boolean);
}
