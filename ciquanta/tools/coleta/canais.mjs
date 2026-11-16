// Canais institucionais: visita o site oficial de cada organização e guarda e-mails de setores (contato, inovação,
// imprensa, relações com investidores...), o CNPJ publicado no rodapé e o perfil institucional no LinkedIn.
// Endereços pessoais (nome.sobrenome@) são descartados: o CRM só cria contatos institucionais automaticamente.
import { baixar, ler, gravar, agora, dominio, cnpjValido, organizacoes, sleep } from './lib.mjs';

// Parte local de e-mails institucionais aceitos, com o rótulo que o contato recebe no CRM
const PAPEIS = [
  [/^(inova(cao|c|tion)?|innovation|pdi|ped|p&d|pesquisa|research|nit|parcerias?|partnerships?|tecnologia|cti)\b/, 'Inovação e P&D'],
  [/^(ri|investidores|investor(s)?|relacoes(\.|-)?com(\.|-)?investidores|ir)$/, 'Relações com investidores'],
  [/^(imprensa|press|comunicacao|comunica|midia|media|assessoria)\b/, 'Comunicação e imprensa'],
  [/^(institucional|relacoes(\.|-)?institucionais|rig|governamentais|gabinete|presidencia|diretoria)\b/, 'Relações institucionais'],
  [/^(contato|contact|faleconosco|fale(\.|-)?conosco|atendimento|info|informacoes|comercial|negocios|sac|hello|ola)\b/, 'Contato geral'],
  [/^(sustentabilidade|esg|responsabilidade)\b/, 'Sustentabilidade'],
];
const DESCARTE = /^(no-?reply|naoresponda|nao-responda|privacidade|privacy|dpo|lgpd|encarregado|ouvidoria|denuncia|etica|compliance|rh|vagas|curriculo|trabalhe|jobs|careers|webmaster|suporte|support|financeiro|cobranca|nfe|fiscal|postmaster|abuse)/;
const CAMINHOS = ['', 'contato', 'fale-conosco', 'contact', 'imprensa', 'sala-de-imprensa', 'inovacao'];
const LOTE = Number(process.env.CIQUANTA_LOTE_CANAIS || 70), REVISAO_DIAS = 45;

export function papel(local) {
  if (DESCARTE.test(local)) return '';
  for (const [re, r] of PAPEIS) if (re.test(local)) return r;
  return '';
}
const mesmoDominio = (email, site) => { const d = email.split('@')[1], s = dominio(site); return !!s && (d === s || d.endsWith('.' + s) || s.endsWith('.' + d)); };

/** Extrai canais de uma página HTML do próprio site da organização. */
export function extrair(html, site, url) {
  const out = { emails: new Map(), cnpj: '', linkedin: '' };
  const limpo = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ');
  const achados = new Set([...limpo.matchAll(/mailto:([^"'?>\s]+)/gi)].map(m => decodeURIComponent(m[1])).concat([...limpo.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)].map(m => m[0])));
  for (const e of achados) {
    const email = e.toLowerCase().replace(/[.,;]+$/, '');
    if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email) || /\.(png|jpe?g|gif|svg|webp)$/.test(email) || !mesmoDominio(email, site)) continue;
    const r = papel(email.split('@')[0]);
    if (r && !out.emails.has(email)) out.emails.set(email, { email, papel: r, url });
  }
  const c = (limpo.match(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g) || []).map(x => x.replace(/\D/g, '')).find(cnpjValido);
  if (c) out.cnpj = c;
  const li = limpo.match(/https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/company\/[A-Za-z0-9_%-]+/i);
  if (li) out.linkedin = li[0];
  return out;
}

export async function coletarCanais({ log = console.log } = {}) {
  const orgs = organizacoes().filter(o => /^https?:\/\//.test(o.site || ''));
  const base = ler('canais.json', { porOrg: {} });
  const limite = new Date(Date.now() - REVISAO_DIAS * 864e5).toISOString(), limErro = new Date(Date.now() - 3 * 864e5).toISOString();
  // Fila: nunca verificadas primeiro, depois as mais antigas; sites que falharam voltam em 3 dias
  const fila = orgs.filter(o => { const x = base.porOrg[o.id]; return !x || x.verificadoEm < (x.status === 'erro' ? limErro : limite); })
    .sort((a, b) => (base.porOrg[a.id]?.verificadoEm || '').localeCompare(base.porOrg[b.id]?.verificadoEm || '')).slice(0, LOTE);
  let comEmail = 0, comCnpj = 0, erros = 0;
  const trabalhar = async o => {
    const acc = { emails: new Map(), cnpj: '', linkedin: '' }; let ok = false, erro = '';
    const raiz = o.site.replace(/\/+$/, '');
    for (const c of CAMINHOS) {
      if (c && acc.emails.size >= 3 && acc.cnpj) break;
      const url = c ? `${raiz}/${c}` : raiz;
      try {
        const html = await baixar(url, { timeout: 15000, tentativas: c ? 1 : 2 });
        ok = true;
        const r = extrair(html, o.site, url);
        r.emails.forEach((v, k) => { if (!acc.emails.has(k)) acc.emails.set(k, v); });
        acc.cnpj ||= r.cnpj; acc.linkedin ||= r.linkedin;
      } catch (e) { if (!c) { erro = e.message; break; } }
      await sleep(400);
    }
    if (!ok) erros++;
    const ant = base.porOrg[o.id] || {};
    base.porOrg[o.id] = { verificadoEm: agora(), status: ok ? 'ok' : 'erro', erro: ok ? undefined : erro,
      emails: ok ? [...acc.emails.values()].slice(0, 6) : (ant.emails || []), cnpj: acc.cnpj || ant.cnpj || '', linkedin: acc.linkedin || ant.linkedin || '' };
    if (base.porOrg[o.id].emails.length) comEmail++;
    if (base.porOrg[o.id].cnpj) comCnpj++;
  };
  // Até 6 sites em paralelo, sempre com pausa entre páginas do mesmo site
  const fila2 = [...fila];
  await Promise.all(Array.from({ length: 6 }, async () => { while (fila2.length) await trabalhar(fila2.shift()); }));
  base.atualizadoEm = agora();
  base.aviso = 'Somente canais institucionais publicados nos sites oficiais. E-mails pessoais são descartados.';
  gravar('canais.json', base);
  const tot = Object.values(base.porOrg);
  log(`canais: ${fila.length} sites visitados (${comEmail} com e-mail institucional, ${comCnpj} com CNPJ, ${erros} sem resposta) · base: ${tot.filter(x => x.emails?.length).length} organizações com canal, ${tot.filter(x => x.cnpj).length} com CNPJ`);
  return { n: fila.length, comEmail, comCnpj, erros };
}
