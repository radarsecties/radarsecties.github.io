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
const Resposta = z.object({
  contatos: z.array(z.object({ email: z.string(), setor: z.string(), url: z.string() })),
  pessoas: z.array(z.object({ nome: z.string(), cargo: z.string(), url: z.string() })).optional().default([]),
});

const SISTEMA = `Você ajuda a equipe de relações institucionais do CIQUANTA, centro público de computação quântica da Paraíba, a encontrar os canais oficiais de e-mail de diretorias de organizações brasileiras.

Procure apenas e-mails de setores publicados pela própria organização em páginas oficiais: presidência, gabinete, reitoria, diretorias, superintendências, relações institucionais ou governamentais, inovação e P&D, núcleo de inovação tecnológica, relações com investidores, assessoria de imprensa. Não traga e-mails de pessoas (nome.sobrenome@), de ouvidoria, LGPD, RH, vendas ou suporte.

Procure também as lideranças de P&D e inovação (diretoria de inovação, chefia de laboratório, centro de pesquisa, tecnologia) citadas pelo nome em notícias, relatórios anuais, eventos ou páginas oficiais, com o cargo atual. Traga só nome, cargo e a página, nunca e-mails ou telefones de pessoas.

Use a busca e abra as páginas para confirmar. Para cada item, informe a página exata onde ele está escrito. Se não encontrar nada confiável, devolva as listas vazias.

Termine a resposta com um bloco JSON, e somente ele, no formato:
\`\`\`json
{"contatos": [{"email": "...", "setor": "...", "url": "https://..."}], "pessoas": [{"nome": "...", "cargo": "...", "url": "https://..."}]}
\`\`\``;

function ultimoJSON(texto) {
  const blocos = [...texto.matchAll(/```json\s*([\s\S]*?)```/g)].map(m => m[1]);
  const bruto = blocos.at(-1) || (texto.match(/\{[\s\S]*"contatos"[\s\S]*\}/) || [])[0];
  if (!bruto) return null;
  try { return Resposta.parse(JSON.parse(bruto)); } catch { return null; }
}

async function perguntar(client, org) {
  const dom = dominio(org.site);
  const messages = [{ role: 'user', content: `Organização: ${org.nome}${dom ? ` (site oficial: ${dom})` : ''}. Encontre os e-mails institucionais das diretorias e dos setores estratégicos e as lideranças de P&D e inovação.` }];
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

/** Confere na página citada que a pessoa aparece pelo nome. Só nome, cargo e fonte entram na base. */
async function verificarPessoa(p) {
  if (!/^https?:\/\//.test(p.url) || p.nome.trim().split(/\s+/).length < 2 || p.nome.length > 80) return null;
  let html; try { html = await baixar(p.url, { timeout: 15000, tentativas: 1 }); } catch { return null; }
  const n = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  return n(html).includes(n(p.nome).trim()) ? { nome: p.nome.trim(), cargo: p.cargo.trim().slice(0, 140), url: p.url, fonte: 'busca na web', vistoEm: new Date().toISOString() } : null;
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
  const pesq = ler('pesquisadores.json', { porOrg: {} });
  let novos = 0, sugeridos = 0, recusados = 0, liderancas = 0;
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
    const lp = (pesq.porOrg[o.id] ||= {}).liderancas ||= [];
    for (const p of r?.pessoas || []) {
      const v = await verificarPessoa(p);
      if (v && !lp.some(l => l.nome.toLowerCase() === v.nome.toLowerCase())) { lp.push(v); liderancas++; }
    }
  }
  base.atualizadoEm = agora();
  gravar('canais.json', base);
  pesq.atualizadoEm ||= agora(); gravar('pesquisadores.json', pesq);
  log(`contatos com IA: ${fila.length} organizações pesquisadas, ${sugeridos} e-mails sugeridos, ${novos} confirmados na página-fonte, ${recusados} recusados na verificação, ${liderancas} lideranças de P&D confirmadas`);
  return { n: novos };
}
