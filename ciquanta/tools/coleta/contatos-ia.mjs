// Busca na web, com o Claude, os e-mails de diretorias que as organizações publicam fora da página inicial
// (portais de transparência, páginas de governança, relatórios). Roda só com ANTHROPIC_API_KEY.
// Nada entra sem verificação: o CRM abre a página citada, confere que o e-mail está escrito nela,
// que o domínio é o da organização e que é uma caixa institucional, não um e-mail pessoal.
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod/v4';
import { ler, gravar, agora, dominio, organizacoes, baixar } from './lib.mjs';
import { classificar } from './canais.mjs';

const MODELO = process.env.CIQUANTA_MODELO || 'claude-opus-5-5';
const LOTE = Number(process.env.CIQUANTA_LOTE_IA || 12);
const ESTRATEGICOS = ['Presidência', 'Gabinete', 'Reitoria', 'Diretoria', 'Relações institucionais', 'Inovação e P&D'];
const Resposta = z.object({ contatos: z.array(z.object({ email: z.string(), setor: z.string(), url: z.string() })) });

const SISTEMA = `Você ajuda a equipe de relações institucionais do CIQUANTA, centro público de computação quântica da Paraíba, a encontrar os canais oficiais de e-mail de diretorias de organizações brasileiras.

Procure apenas e-mails de setores publicados pela própria organização em páginas oficiais: presidência, gabinete, reitoria, diretorias, superintendências, relações institucionais ou governamentais, inovação e P&D, núcleo de inovação tecnológica, relações com investidores, assessoria de imprensa. Não traga e-mails de pessoas (nome.sobrenome@), de ouvidoria, LGPD, RH, vendas ou suporte.

Use a busca e abra as páginas para confirmar. Para cada e-mail, informe a página exata onde ele está escrito. Se não encontrar nada confiável, devolva a lista vazia.

Termine a resposta com um bloco JSON, e somente ele, no formato:
\`\`\`json
{"contatos": [{"email": "...", "setor": "...", "url": "https://..."}]}
\`\`\``;

function ultimoJSON(texto) {
  const blocos = [...texto.matchAll(/```json\s*([\s\S]*?)```/g)].map(m => m[1]);
  const bruto = blocos.at(-1) || (texto.match(/\{[\s\S]*"contatos"[\s\S]*\}/) || [])[0];
  if (!bruto) return null;
  try { return Resposta.parse(JSON.parse(bruto)); } catch { return null; }
}

async function perguntar(client, org) {
  const dom = dominio(org.site);
  const messages = [{ role: 'user', content: `Organização: ${org.nome}${dom ? ` (site oficial: ${dom})` : ''}. Encontre os e-mails institucionais das diretorias e dos setores estratégicos.` }];
  let resp;
  for (let i = 0; i < 4; i++) {
    resp = await client.beta.messages.create({
      model: MODELO, max_tokens: 8000, system: SISTEMA, messages,
      betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
      output_config: { effort: 'low' },
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 4, user_location: { type: 'approximate', country: 'BR' } }, { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 4 }],
    });
    if (resp.stop_reason !== 'pause_turn') break;
    // O servidor retoma de onde parou quando recebe a própria resposta de volta
    messages.splice(1, messages.length - 1, { role: 'assistant', content: resp.content });
  }
  if (resp.stop_reason === 'refusal') return null;
  return ultimoJSON(resp.content.filter(b => b.type === 'text').map(b => b.text).join('\n'));
}

/** Confere na própria página que o e-mail está publicado e é da organização. */
async function verificar(c, org) {
  const email = c.email.toLowerCase().trim(), dEmail = email.split('@')[1] || '', dOrg = dominio(org.site), dUrl = dominio(c.url);
  const doMesmoDominio = (a, b) => !!a && !!b && (a === b || a.endsWith('.' + b) || b.endsWith('.' + a));
  if (!/^https?:\/\//.test(c.url) || !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) return null;
  if (dOrg ? !doMesmoDominio(dEmail, dOrg) : !doMesmoDominio(dEmail, dUrl)) return null;
  let html;
  try { html = await baixar(c.url, { timeout: 15000, tentativas: 1 }); } catch { return null; }
  const texto = html.toLowerCase(), i = texto.indexOf(email);
  if (i < 0) return null;
  const papel = classificar(email, `${c.setor} ${html.slice(Math.max(0, i - 300), i).replace(/<[^>]+>/g, ' ')}`);
  return papel ? { email, papel, url: c.url, origem: 'busca na web' } : null;
}

export async function contatosIA({ log = console.log } = {}) {
  if (!process.env.ANTHROPIC_API_KEY) { log('contatos com IA: sem ANTHROPIC_API_KEY, etapa ignorada'); return { n: 0, ignorada: true }; }
  const base = ler('canais.json', { porOrg: {} });
  const limite = new Date(Date.now() - 60 * 864e5).toISOString();
  // Prioridade: organizações mais estratégicas que ainda não têm canal de diretoria
  const ordem = { A: 0, B: 1, C: 2 };
  const fila = organizacoes()
    .filter(o => { const x = base.porOrg[o.id]; return !(x?.emails || []).some(e => ESTRATEGICOS.includes(e.papel)) && !(x?.buscaWebEm > limite); })
    .sort((a, b) => (ordem[a.prioridade] ?? 3) - (ordem[b.prioridade] ?? 3) || ({ confirmada: 0, indicios: 1 }[a.evidencia] ?? 2) - ({ confirmada: 0, indicios: 1 }[b.evidencia] ?? 2))
    .slice(0, LOTE);
  const client = new Anthropic();
  let novos = 0, sugeridos = 0, recusados = 0;
  for (const o of fila) {
    const x = base.porOrg[o.id] ||= { emails: [], status: 'ok' };
    x.buscaWebEm = agora();
    let r;
    try { r = await perguntar(client, o); } catch (e) { log(`contatos com IA: ${o.nome}: ${e.message}`); continue; }
    for (const c of r?.contatos || []) {
      sugeridos++;
      const v = await verificar(c, o);
      if (!v) { recusados++; continue; }
      if (!x.emails.some(e => e.email === v.email)) { x.emails.push(v); novos++; }
    }
  }
  base.atualizadoEm = agora();
  gravar('canais.json', base);
  log(`contatos com IA: ${fila.length} organizações pesquisadas, ${sugeridos} e-mails sugeridos, ${novos} confirmados na página-fonte, ${recusados} recusados na verificação`);
  return { n: novos };
}
