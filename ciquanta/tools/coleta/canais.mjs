// Canais institucionais: e-mails de diretorias e setores publicados pelas próprias organizações.
// Para cada site oficial, descobre as páginas de diretoria, governança, estrutura, contato e imprensa (pelos links
// da página inicial e pelo mapa do site), lê os e-mails com o texto ao redor e guarda só caixas institucionais:
// diretoria, presidência, gabinete, reitoria, superintendência, relações institucionais, inovação, imprensa, contato.
// E-mails pessoais (nome.sobrenome@) são descartados: a LGPD protege dados de pessoas, não caixas de setores.
import { baixar, ler, gravar, agora, dominio, cnpjValido, organizacoes, sleep, norm, semTags } from './lib.mjs';

const LOTE = Number(process.env.CIQUANTA_LOTE_CANAIS || 70), REVISAO_DIAS = 45, PAGINAS_POR_SITE = 8;

// Rótulos de setores, do mais ao menos estratégico para relações institucionais
export const PAPEIS = [
  // [rótulo, palavras exatas, prefixos, expressão no texto ao redor]
  ['Presidência', ['ceo', 'pres'], ['presid'], /presid[eê]ncia|gabinete d[ao] presid|chief executive/i],
  ['Gabinete', ['gab', 'gabin'], ['gabinete'], /gabinete|chefia de gabinete/i],
  ['Reitoria', ['gr', 'reitor'], ['reitoria', 'vicereit'], /reitoria|vice-reitoria/i],
  ['Diretoria', ['dir', 'sup', 'secex', 'board', 'directors'], ['diretori', 'diretor', 'superint', 'secretaria', 'conselho'], /diretoria|superintend[eê]ncia|secretaria[- ]executiva|vice-presid[eê]ncia|conselho/i],
  ['Relações institucionais', ['rig', 'ari', 'rel'], ['institucion', 'relacoes', 'governamenta', 'parceria', 'partnership', 'cooperac', 'internaciona', 'assuntos'], /rela[cç][oõ]es (institucionais|governamentais|internacionais)|assuntos (institucionais|corporativos|regulat)|coopera[cç][aã]o|parcerias/i],
  ['Inovação e P&D', ['nit', 'pdi', 'ped', 'dpi', 'cti', 'dinov', 'prpg', 'agir'], ['inova', 'innovat', 'pesquisa', 'research', 'tecnolog', 'propesq'], /inova[cç][aã]o|pesquisa e desenvolvimento|p&d|pd&i|n[uú]cleo de inova|ag[eê]ncia de inova|pr[oó]-reitoria de pesquisa|transfer[eê]ncia de tecnologia/i],
  ['Relações com investidores', ['ri', 'ir'], ['investidor', 'investor'], /rela[cç][oõ]es com investidores|investor relations/i],
  ['Comunicação e imprensa', ['ascom', 'press', 'midia', 'media'], ['imprensa', 'comunica', 'assessoria'], /imprensa|assessoria de comunica|comunica[cç][aã]o (social|corporativa)/i],
  ['Sustentabilidade', ['esg'], ['sustentab', 'responsabilidade'], /sustentabilidade|\besg\b/i],
  ['Contato geral', ['sac', 'info', 'fale', 'hello', 'ola', 'geral', 'contact'], ['contato', 'faleconosco', 'atendimento', 'informac', 'comercial', 'negocios'], /fale conosco|contato|atendimento/i],
];
const tokenPapel = t => PAPEIS.find(([, exatas, prefixos]) => exatas.includes(t) || prefixos.some(p => t.startsWith(p)));
const DESCARTE = /(^|[._-])(no-?reply|naoresponda|nao-?responda|privacidade|privacy|dpo|lgpd|encarregado|ouvidoria|denuncia|etica|compliance|rh|recrutamento|vagas|curriculo|trabalhe|jobs|careers|webmaster|suporte|support|financeiro|cobranca|nfe|fiscal|postmaster|abuse|licitac|compras|pregao|protocolo|sic|esic)([._-]|$)/;
// Nomes próprios comuns: um e-mail como "maria@" ou "joao.silva@" é de uma pessoa
const SOBRENOMES = new Set('silva santos oliveira souza sousa lima pereira costa ferreira rodrigues almeida nascimento carvalho gomes martins araujo melo barbosa ribeiro alves cardoso rocha dias moreira nunes mendes freitas vieira cavalcanti monteiro andrade batista teixeira correia campos lopes machado medeiros farias fernandes marques pinto ramos reis soares azevedo bezerra brito castro coelho duarte guimaraes leite macedo maia miranda moura nogueira queiroz sales siqueira tavares xavier'.split(' '));
const NOMES = new Set('ana maria jose joao antonio francisco carlos paulo pedro lucas luiz luis marcos gabriel rafael daniel marcelo bruno eduardo felipe rodrigo fernando fernanda juliana patricia aline sandra camila amanda bruna jessica leticia julia luciana vanessa mariana beatriz larissa gabriela renata tatiana roberto ricardo andre alexandre sergio fabio thiago tiago diego leonardo gustavo vinicius victor vitor henrique marcio claudio cesar adriana cristina simone priscila carla debora elaine helena raquel sonia vera lucia rosa regina silvia monica rita joana clara alice laura sofia isabela isabel livia manuela valentina heloisa luana carolina natalia paula cintia cristiane denise eliane fatima flavia gisele ingrid karina katia lais lorena marta michele milena nadia neide olga rebeca rosana sabrina silvana sueli tania tereza viviane yara zilda arthur bernardo caio davi enzo heitor igor joaquim juan julio kaique leandro mateus matheus miguel murilo nicolas otavio raul samuel tomas wagner william wilson alberto alvaro antonio augusto benedito celso domingos edson elias emerson fabricio geraldo gilberto helio hugo ivan jair jorge julio luciano manoel mauricio milton nelson osvaldo raimundo reinaldo renato rogerio ronaldo sebastiao severino valter wellington'.split(' '));

/** Classifica a parte local do e-mail e o texto ao redor. Devolve o rótulo do setor ou '' para descartar. */
export function classificar(email, contexto = '') {
  const local = email.split('@')[0].toLowerCase();
  if (DESCARTE.test(local)) return '';
  const tokens = local.split(/[._+-]+/).filter(Boolean);
  const pessoa = tokens.some(t => NOMES.has(t) || SOBRENOMES.has(t) || SOBRENOMES.has(t.slice(1)) || SOBRENOMES.has(t.slice(2)));
  const papelLocal = tokens.map(tokenPapel).find(Boolean);
  if (papelLocal && !pessoa) return papelLocal[0];
  // Sem palavra de setor na parte local: só aceita sigla curta citada como setor no texto ao redor (ex.: "Diretoria de Inovação: dinov@")
  if (pessoa || tokens.filter(t => /^[a-z]{2,}$/.test(t)).length >= 2 || /\d{2,}/.test(local) || local.length > 8) return '';
  const papelCtx = PAPEIS.find(([, , , re]) => re.test(contexto));
  return papelCtx ? papelCtx[0] : '';
}

const mesmoDominio = (email, site) => { const d = email.split('@')[1], s = dominio(site); return !!s && (d === s || d.endsWith('.' + s) || s.endsWith('.' + d)); };

/** Extrai canais de uma página HTML do próprio site da organização. */
export function extrair(html, site, url) {
  const out = { emails: new Map(), cnpj: '', linkedin: '' };
  const limpo = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ');
  const texto = semTags(limpo.replace(/<a\b[^>]*href="mailto:([^"?]+)[^"]*"[^>]*>/gi, ' $1 '));
  const achados = new Set([...limpo.matchAll(/mailto:([^"'?>\s]+)/gi)].map(m => { try { return decodeURIComponent(m[1]); } catch { return m[1]; } })
    .concat([...texto.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)].map(m => m[0])));
  for (const e of achados) {
    const email = e.toLowerCase().trim().replace(/[.,;:]+$/, '');
    if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email) || /\.(png|jpe?g|gif|svg|webp)$/.test(email) || !mesmoDominio(email, site) || out.emails.has(email)) continue;
    const i = texto.toLowerCase().indexOf(email);
    const ctx = i >= 0 ? texto.slice(Math.max(0, i - 160), i + email.length + 60) : '';
    const papel = classificar(email, ctx);
    if (papel) out.emails.set(email, { email, papel, url });
  }
  const c = (limpo.match(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g) || []).map(x => x.replace(/\D/g, '')).find(cnpjValido);
  if (c) out.cnpj = c;
  const li = limpo.match(/https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/company\/[A-Za-z0-9_%-]+/i);
  if (li) out.linkedin = li[0];
  return out;
}

// Páginas que costumam publicar contatos de diretoria, com peso para ordenar a visita
const ALVO = [
  [/diretori|governan|quem-somos|quem_somos|sobre|institucional|estrutura|organograma|lideran|administra|composicao|quem-e-quem|equipe-dirigente/i, 3],
  [/contato|fale|contact|atendimento/i, 3],
  [/imprensa|press|comunica|noticias\/contato/i, 2],
  [/inova|pesquisa|nit\b|parceri|cooperac/i, 2],
  [/investidores|\bri\b|investor/i, 1],
];
const peso = u => ALVO.reduce((s, [re, p]) => s + (re.test(u) ? p : 0), 0);

/** Links internos promissores da página inicial e do mapa do site. */
export async function descobrirPaginas(raiz, htmlInicial) {
  const base = new URL(raiz), cand = new Map();
  const add = (href, rotulo = '') => {
    try {
      const u = new URL(href, base); u.hash = '';
      if (dominio(u.href) !== dominio(base.href) || /\.(pdf|jpe?g|png|zip|docx?|xlsx?)$/i.test(u.pathname) || u.href === base.href) return;
      const w = peso(u.pathname + ' ' + norm(rotulo)); if (w > 0) cand.set(u.href, Math.max(cand.get(u.href) || 0, w));
    } catch { /* link malformado */ }
  };
  for (const m of htmlInicial.matchAll(/<a\b[^>]*href="([^"#][^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)) add(m[1], semTags(m[2]));
  try {
    const robots = await baixar(new URL('/robots.txt', base).href, { timeout: 8000, tentativas: 1 });
    const mapas = [...robots.matchAll(/^sitemap:\s*(\S+)/gim)].map(m => m[1]).slice(0, 2);
    for (const mapa of mapas.length ? mapas : [new URL('/sitemap.xml', base).href]) {
      const xml = await baixar(mapa, { timeout: 10000, tentativas: 1 });
      [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].slice(0, 400).forEach(m => add(m[1]));
    }
  } catch { /* sem mapa do site */ }
  for (const c of ['contato', 'fale-conosco', 'institucional', 'quem-somos', 'diretoria', 'governanca', 'imprensa']) if (![...cand.keys()].some(u => u.includes(c))) cand.set(new URL('/' + c, base).href, 0.5);
  return [...cand.entries()].sort((a, b) => b[1] - a[1]).map(([u]) => u).slice(0, PAGINAS_POR_SITE);
}

export async function coletarCanais({ log = console.log } = {}) {
  const orgs = organizacoes().filter(o => /^https?:\/\//.test(o.site || ''));
  const base = ler('canais.json', { porOrg: {} });
  const receita = ler('receita.json', { porOrg: {} }).porOrg;
  const limite = new Date(Date.now() - REVISAO_DIAS * 864e5).toISOString(), limErro = new Date(Date.now() - 3 * 864e5).toISOString();
  // Fila: nunca verificadas e verificadas pelo método antigo primeiro, depois as mais antigas; sites que falharam voltam em 3 dias
  const fila = orgs.filter(o => { const x = base.porOrg[o.id]; return !x || (x.versao || 1) < 2 || x.verificadoEm < (x.status === 'erro' ? limErro : limite); })
    .sort((a, b) => ((base.porOrg[a.id]?.versao || 0) - (base.porOrg[b.id]?.versao || 0)) || (base.porOrg[a.id]?.verificadoEm || '').localeCompare(base.porOrg[b.id]?.verificadoEm || '')).slice(0, LOTE);
  let comEmail = 0, comDiretoria = 0, comCnpj = 0, erros = 0, paginas = 0;
  const trabalhar = async o => {
    const acc = { emails: new Map(), cnpj: '', linkedin: '' }; let ok = false, erro = '';
    const raiz = o.site.replace(/\/+$/, '') + '/';
    const juntar = r => { r.emails.forEach((v, k) => { if (!acc.emails.has(k)) acc.emails.set(k, v); }); acc.cnpj ||= r.cnpj; acc.linkedin ||= r.linkedin; };
    try {
      const html = await baixar(raiz, { timeout: 15000, tentativas: 2 }); ok = true; paginas++;
      juntar(extrair(html, o.site, raiz));
      for (const url of await descobrirPaginas(raiz, html)) {
        try { juntar(extrair(await baixar(url, { timeout: 12000, tentativas: 1 }), o.site, url)); paginas++; } catch { /* página ausente */ }
        await sleep(350);
      }
    } catch (e) { erro = e.message; }
    // E-mail informado no cadastro da Receita Federal, quando é do próprio domínio e não é pessoal
    const er = receita[o.id]?.email;
    if (er && mesmoDominio(er, o.site) && !acc.emails.has(er)) { const p = classificar(er, 'contato'); if (p) acc.emails.set(er, { email: er, papel: p, url: 'Cadastro na Receita Federal' }); }
    if (!ok) erros++;
    const ant = base.porOrg[o.id] || {};
    const ordem = e => PAPEIS.findIndex(p => p[0] === e.papel);
    const emails = ok ? [...acc.emails.values()].sort((a, b) => ordem(a) - ordem(b)).slice(0, 8) : (ant.emails || []);
    // Mantém os achados pela busca na web, que esta visita não substitui
    for (const e of ant.emails || []) if (e.origem === 'busca na web' && !emails.some(x => x.email === e.email)) emails.push(e);
    base.porOrg[o.id] = { verificadoEm: agora(), versao: 2, status: ok ? 'ok' : 'erro', erro: ok ? undefined : erro, emails,
      cnpj: acc.cnpj || ant.cnpj || '', linkedin: acc.linkedin || ant.linkedin || '' };
    if (emails.length) comEmail++;
    if (emails.some(e => ['Presidência', 'Gabinete', 'Reitoria', 'Diretoria', 'Relações institucionais', 'Inovação e P&D'].includes(e.papel))) comDiretoria++;
    if (base.porOrg[o.id].cnpj) comCnpj++;
  };
  const fila2 = [...fila];
  await Promise.all(Array.from({ length: 6 }, async () => { while (fila2.length) await trabalhar(fila2.shift()); }));
  base.atualizadoEm = agora();
  base.aviso = 'Somente caixas institucionais publicadas pelas próprias organizações. E-mails pessoais são descartados.';
  gravar('canais.json', base);
  const tot = Object.values(base.porOrg);
  log(`canais: ${fila.length} sites, ${paginas} páginas lidas (${comEmail} com canal, ${comDiretoria} com diretoria ou setor estratégico, ${comCnpj} com CNPJ, ${erros} sem resposta) · base: ${tot.filter(x => x.emails?.length).length} organizações com canal, ${tot.reduce((s, x) => s + (x.emails?.length || 0), 0)} e-mails`);
  return { n: fila.length, comEmail, comDiretoria, comCnpj, erros };
}
