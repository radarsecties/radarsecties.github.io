// Descoberta de novas organizações e oportunidades nas notícias do dia, com o Claude (opcional: só roda com ANTHROPIC_API_KEY).
// Cada organização sugerida precisa estar escrita no texto da notícia de onde veio; o resto é descartado.
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod/v4';
import { ler, gravar, agora, norm, organizacoes } from './lib.mjs';

const MODELO = process.env.CIQUANTA_MODELO || 'claude-opus-5-5';
const LOTE = 60;
const SETORES = ['financeiro', 'saude', 'agro', 'clima', 'energia', 'oleo-gas', 'logistica', 'industria', 'telecom', 'governo-defesa', 'seguros', 'mineracao', 'quimica', 'semicondutores', 'automotivo', 'aeroespacial', 'tic', 'varejo', 'ecossistema', 'deeptech', 'investidores', 'consultoria'];
const SEGMENTOS = ['Empresa', 'Startup', 'Investidor', 'Fomentador', 'Autoridade', 'Academia/ICT', 'Associação/Rede'];
const UFS = ['', 'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

export const Resultado = z.object({
  organizacoes: z.array(z.object({
    nome: z.string().describe('Nome como aparece na notícia'),
    segmento: z.enum(SEGMENTOS),
    setor: z.enum(SETORES),
    uf: z.enum(UFS).describe('Estado da sede no Brasil, ou vazio se não for possível saber pelo texto'),
    atuacao: z.string().describe('Uma frase, em português, sobre o que a notícia mostra dessa organização'),
    evidencia: z.enum(['indicios', 'potencial']).describe('indicios quando a notícia liga a organização a computação ou tecnologias quânticas; potencial nos demais casos'),
    sinais: z.array(z.string()).describe('ids das notícias em que a organização aparece'),
  })),
  oportunidades: z.array(z.object({
    sinal: z.string().describe('id da notícia'),
    tipo: z.enum(['edital', 'investimento', 'parceria', 'evento', 'politica_publica']),
    organizacao: z.string().describe('Nome da organização envolvida, como aparece no texto, ou vazio'),
    resumo: z.string().describe('Uma frase, em português, com a ação concreta que o CIQUANTA pode tomar'),
  })),
});

const SISTEMA = `Você apoia a equipe de relações institucionais do CIQUANTA, o Centro Internacional de Computação e Tecnologias Quânticas do Estado da Paraíba (120 qubits, financiado pelo Governo da Paraíba e pelo MCTI). O centro busca empresas e instituições que invistam em pesquisa e desenvolvimento e possam financiar projetos de pesquisa aplicada com computação quântica, inclusive por mecanismos como a Lei do Bem, os programas de PD&I da ANEEL e da ANP, a Finep, o BNDES e a EMBRAPII.

Você recebe notícias recentes (título, veículo e resumo). Identifique:
1. Organizações que atuam no Brasil e seriam parceiras plausíveis: empresas com P&D relevante, startups de base tecnológica, investidores, agências de fomento, universidades e institutos de pesquisa, órgãos públicos de ciência e tecnologia. Deixe de fora veículos de imprensa, pessoas, países, organizações sem atuação no Brasil e as que já constam da lista "já mapeadas".
2. Oportunidades concretas: editais e chamadas abertas, rodadas de investimento, anúncios de parceria ou de programas, eventos, políticas públicas que abram espaço para o CIQUANTA.

Use apenas o que está escrito nas notícias. Não complete com conhecimento externo: se o estado não aparecer, deixe vazio. Escreva o nome da organização exatamente como aparece no texto. Se nada for relevante, devolva listas vazias.`;

export async function descobrir({ log = console.log } = {}) {
  if (!process.env.ANTHROPIC_API_KEY) { log('descoberta: sem ANTHROPIC_API_KEY, etapa ignorada'); return { n: 0, ignorada: true }; }
  const sinais = ler('sinais.json', { itens: [] }).itens;
  const desc = ler('descobertas.json', { itens: [], oportunidades: [], analisados: [] });
  const feitos = new Set(desc.analisados || []);
  const fila = sinais.filter(s => !feitos.has(s.id)).slice(0, LOTE);
  if (!fila.length) { log('descoberta: nenhuma notícia nova para analisar'); return { n: 0 }; }
  const mapeadas = organizacoes();
  const conhecidas = new Set(mapeadas.map(o => norm(o.nome)));

  const client = new Anthropic();
  const texto = fila.map(s => `[${s.id}] ${s.titulo} (${s.fonte})${s.resumo ? '\n' + s.resumo : ''}`).join('\n\n');
  const resp = await client.beta.messages.parse({
    model: MODELO,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: zodOutputFormat(Resultado) },
    system: SISTEMA,
    messages: [{ role: 'user', content: `Já mapeadas (não repita): ${mapeadas.map(o => o.nome).join('; ')}\n\nNotícias:\n\n${texto}` }],
  });
  if (resp.stop_reason === 'refusal') throw new Error('o modelo recusou a análise' + (resp.stop_details?.category ? ` (${resp.stop_details.category})` : ''));
  if (resp.stop_reason === 'max_tokens') throw new Error('resposta truncada; reduza o lote');
  const r = resp.parsed_output;
  if (!r) throw new Error('resposta fora do formato esperado');

  // Verificação contra o texto-fonte: o nome precisa estar escrito em alguma das notícias citadas
  const porId = new Map(fila.map(s => [s.id, norm(`${s.titulo} ${s.resumo}`)]));
  let novas = 0, descartadas = 0;
  for (const o of r.organizacoes) {
    const n = norm(o.nome), ids = o.sinais.filter(id => porId.has(id));
    if (n.length < 3 || conhecidas.has(n) || !ids.length || !ids.some(id => porId.get(id).includes(n))) { descartadas++; continue; }
    conhecidas.add(n); novas++;
    desc.itens.push({ id: 'auto-' + n.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50), nome: o.nome, segmento: o.segmento, setor: o.setor, uf: o.uf, cidade: '', site: '',
      evidencia: o.evidencia, atuacao: o.atuacao, fontes: [], sinais: ids, links: ids.map(id => fila.find(s => s.id === id)?.link).filter(Boolean),
      bloco: ['Academia/ICT'].includes(o.segmento) ? 'academico' : ['Autoridade', 'Fomentador'].includes(o.segmento) ? 'institucional' : 'industrial',
      prioridade: 'C', tags: ['descoberta automática'], notas: 'Identificada automaticamente em notícia; confirme os dados antes da abordagem.', descobertaEm: agora() });
  }
  for (const op of r.oportunidades) if (porId.has(op.sinal)) {
    const s = fila.find(x => x.id === op.sinal);
    desc.oportunidades.push({ id: 'op-' + op.sinal, sinal: op.sinal, tipo: op.tipo, organizacao: op.organizacao, resumo: op.resumo, titulo: s.titulo, link: s.link, data: s.data, identificadaEm: agora() });
  }
  const vistos = new Set(); desc.oportunidades = desc.oportunidades.filter(o => !vistos.has(o.id) && vistos.add(o.id)).slice(-300);
  desc.analisados = [...feitos, ...fila.map(s => s.id)].slice(-3000);
  desc.atualizadoEm = agora(); desc.modelo = resp.model;
  desc.aviso = 'Organizações e oportunidades identificadas automaticamente em notícias. Confirme os dados antes da abordagem.';
  gravar('descobertas.json', desc);
  log(`descoberta: ${fila.length} notícias analisadas, ${novas} organizações novas (${descartadas} descartadas na verificação), ${r.oportunidades.length} oportunidades`);
  return { n: novas, oportunidades: r.oportunidades.length };
}
