// Rotinas automáticas do CRM. Aplicam ao CRM o que a coleta diária publica em data/ (mapeamento, descobertas,
// canais institucionais, Receita Federal, Painel CIQUANTA) e conduzem o piloto automático de abordagem.
// Todas são idempotentes: rodar de novo não duplica nada, e os identificadores são estáveis entre computadores.
import * as store from './store.js';
import { norm, isEmail, isoDay, toast } from './util.js';
import { pontuar, contexto } from './score.js';
import { inscrever } from './cadencia.js';
import { podeAutomatizar } from './sync.js';
import { carregarSinais } from './sinais.js';

const K_LOG = 'ciquanta:automacao:log', K_ULT = 'ciquanta:automacao:ultima';
const INTERVALO = 3 * 3600e3;
export const PAINEL_PUBLICO = 'https://script.google.com/macros/s/AKfycbx1oLvENMRgjLYaUYICnUrHA-iP2R3B4yoIdeW7kID331zwaDR5dIVFC2RrC9xH4CJZCg/exec?painel=1';

export const ROTINAS = [
  { id: 'mapeamento', chave: 'autoMapeamento', nome: 'Mapeamento de organizações', desc: 'Leva ao CRM as organizações novas do mapeamento e as descobertas nas notícias. As que a equipe exclui não voltam.' },
  { id: 'canais', chave: 'autoCanais', nome: 'Contatos institucionais', desc: 'Cria contatos com os e-mails de setores (inovação, relações institucionais, contato geral) publicados nos sites oficiais.' },
  { id: 'receita', chave: 'autoReceita', nome: 'Dados da Receita Federal', desc: 'Completa CNPJ, razão social, situação cadastral, porte e atividade econômica.' },
  { id: 'painel', chave: 'autoPainel', nome: 'Painel CIQUANTA', desc: 'Atualiza os totais de cadastros e visitas à réplica a cada abertura e a cada três horas, sem login.' },
  { id: 'gmail', chave: 'autoGmailContatos', nome: 'Contatos vindos do Gmail', desc: 'Quem responde de um domínio de organização mapeada vira contato automaticamente.' },
  { id: 'piloto', chave: 'pilotoAutomatico', nome: 'Piloto automático de abordagem', desc: 'Todo dia, inscreve nas cadências os contatos das organizações de maior potencial que ainda não foram abordadas.' },
];

// ---- Registro de execução (por navegador)
const lerLog = () => { try { return JSON.parse(localStorage.getItem(K_LOG)) || []; } catch { return []; } };
export const registro = lerLog;
function anotar(rotina, n, msg, ok = true) {
  const l = [{ em: new Date().toISOString(), rotina, n, msg, ok }, ...lerLog()].slice(0, 300);
  try { localStorage.setItem(K_LOG, JSON.stringify(l)); } catch {}
}
export const ultimaExecucao = () => { try { return localStorage.getItem(K_ULT) || ''; } catch { return ''; } };

const idOrg = refId => 'org-' + String(refId).replace(/^(ref|auto)-/, '');
const hashCurto = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
const ler = async n => { try { return await store.ref(n); } catch { return null; } };

/** Converte um item do mapeamento (ou das descobertas) em organização do CRM. */
export function paraOrg(r) {
  const setor = store.setoresLista().find(x => x.id === r.setor);
  return { id: idOrg(r.id), nome: r.nome, segmento: r.segmento, setor: r.setor, uf: r.uf || '', cidade: r.cidade || '', site: r.site || '', evidencia: r.evidencia, atuacao: r.atuacao || '',
    fontes: r.fontes || [], links: r.links || [], bloco: r.bloco, prioridade: r.prioridade || 'C', notas: r.notas || '', tags: [...(r.tags || [])], mecanismos: [...(setor?.mecanismos || [])],
    relacionamento: 'mapeada', origem: String(r.id).startsWith('auto-') ? 'Descoberta automática em notícias' : 'Mapeamento setorial', criadoEm: new Date().toISOString(), auto: true };
}

export async function mapeamento() {
  const [ref, desc] = await Promise.all([ler('empresas'), ler('descobertas')]);
  const itens = [...(ref?.itens || []), ...(desc?.itens || [])];
  const s = store.state(), descartadas = new Set(s.descartadas || []);
  const ids = new Set(s.orgs.map(o => o.id)), nomes = new Set(s.orgs.flatMap(o => [norm(o.nome), norm(o.nomeFantasia)]).filter(Boolean));
  let novas = 0, completadas = 0;
  for (const r of itens) {
    const id = idOrg(r.id);
    const atual = s.orgs.find(o => o.id === id);
    if (atual) { // completa campos vazios sem mexer no que a equipe editou
      let mudou = false;
      for (const k of ['site', 'uf', 'cidade', 'atuacao']) if (!atual[k] && r[k]) { atual[k] = r[k]; mudou = true; }
      if (mudou) completadas++;
      continue;
    }
    if (ids.has(id) || descartadas.has(id) || nomes.has(norm(r.nome))) continue;
    s.orgs.push(paraOrg(r)); ids.add(id); nomes.add(norm(r.nome)); novas++;
  }
  if (novas || completadas) store.touch('orgs');
  return { n: novas, msg: novas ? `${novas} organização(ões) nova(s) no CRM${completadas ? `, ${completadas} completada(s)` : ''}` : completadas ? `${completadas} organização(ões) completada(s)` : 'mapeamento em dia' };
}

const ORDEM_PAPEL = ['Inovação e P&D', 'Relações institucionais', 'Relações com investidores', 'Contato geral', 'Sustentabilidade', 'Comunicação e imprensa'];
export async function canais() {
  const c = await ler('canais'); if (!c?.porOrg) return { n: 0, msg: 'a coleta ainda não publicou canais' };
  const s = store.state();
  const emails = new Set(s.contatos.map(x => norm(x.email)).filter(Boolean));
  let novos = 0, cnpj = 0;
  for (const [refId, v] of Object.entries(c.porOrg)) {
    const org = store.get('orgs', idOrg(refId)); if (!org) continue;
    if (v.cnpj && !org.cnpj) { org.cnpj = v.cnpj; cnpj++; }
    if (v.linkedin && !org.linkedin) org.linkedin = v.linkedin;
    for (const e of v.emails || []) {
      const email = norm(e.email);
      if (!isEmail(email) || emails.has(email) || store.suprimido(email)) continue;
      s.contatos.push({ id: 'ct-auto-' + hashCurto(email), nome: `${e.papel} · ${org.nomeFantasia || org.nome}`, email, orgId: org.id, cargo: 'Canal institucional', area: e.papel,
        canal: true, tratamento: 'Prezado(a)', fonte: e.url, tags: ['automático', 'canal institucional'], auto: true, criadoEm: new Date().toISOString() });
      emails.add(email); novos++;
    }
  }
  if (novos || cnpj) { store.touch('contatos'); store.touch('orgs'); }
  return { n: novos, msg: `${novos} contato(s) institucional(is) novo(s)${cnpj ? `, ${cnpj} CNPJ encontrados nos sites` : ''}` };
}

export async function receita() {
  const r = await ler('receita'); if (!r?.porOrg) return { n: 0, msg: 'a coleta ainda não publicou dados da Receita' };
  let n = 0;
  for (const [refId, v] of Object.entries(r.porOrg)) {
    const org = store.get('orgs', idOrg(refId)); if (!org) continue;
    if ((org.receita?.consultadoEm || '') >= v.atualizadoEm) continue;
    // Mesmo formato da consulta manual (cnpj.js); a consulta manual, mais completa, preserva endereço e administradores
    org.receita = { ...(org.receita || {}), situacao: v.situacao, abertura: v.abertura, capital: v.capital, consultadoEm: v.atualizadoEm, fonte: 'Coleta diária (bases públicas da Receita Federal)' };
    org.cnpj ||= v.cnpj; org.razaoSocial ||= v.razao; org.porte ||= v.porte; org.cnae ||= [v.cnae, v.cnaeDesc].filter(Boolean).join(' ');
    if (/baixada|inapta|suspensa|nula/i.test(v.situacao) && !(org.tags || []).includes('CNPJ irregular')) org.tags = [...(org.tags || []), 'CNPJ irregular'];
    n++;
  }
  if (n) store.touch('orgs');
  return { n, msg: n ? `${n} organização(ões) com dados cadastrais atualizados` : 'dados cadastrais em dia' };
}

/** Converte os totais públicos do Painel CIQUANTA no resumo usado pelo CRM. */
export function resumoPainel(j, historico = []) {
  const hoje = isoDay();
  const porDia = {};
  for (const x of j.sessoes || []) { const d = (porDia[x.data] ||= { data: x.data, visitas: 0, pessoas: 0, grupos: [] }); d.visitas++; d.pessoas += (x.conf || 0) + (x.pend || 0); }
  const obj = l => Object.fromEntries((l || []).map(x => [x.r, x.n]));
  return {
    atualizadoEm: new Date().toISOString(), fonte: 'publico', painelEm: j.atualizado || '',
    visitas: Object.values(porDia).sort((a, b) => a.data.localeCompare(b.data)),
    cadastros: obj(j.categorias), temas: obj(j.temas),
    totais: { visitas: (j.sessoes || []).length, pessoas: j.prev || 0, recebidos: j.rec || 0, futuras: (j.sessoes || []).filter(s => s.data >= hoje).length, cadastros: j.total || 0,
      pessoasCadastradas: j.pessoas || 0, instituicoes: j.instituicoes || 0, ufs: j.ufs || 0, cidades: j.cidades || 0, comConsentimento: Math.round((j.not || 0) * (j.pessoas || 0)) },
    publico: { porUf: j.porUf || [], regioes: j.regioes || [], ritmo: j.cadRitmo || [], atuantesUf: j.atuantesUf || [], escolaridade: j.escolaridade || [], exp: j.exp || [], fora: j.fora || 0, cad7: j.cad7 || 0, historico },
  };
}
export async function painel() {
  const atual = store.state().painel || {};
  // Leitura pelas planilhas (com login) recente tem precedência: traz o detalhe das visitas de grupos
  if (atual.fonte !== 'publico' && atual.atualizadoEm && atual.totais?.cadastros !== undefined && Date.now() - new Date(atual.atualizadoEm) < 6 * 3600e3) return { n: 0, msg: 'mantidos os dados lidos das planilhas há menos de 6 horas' };
  const snap = await ler('painel'), hist = snap?.historico || [];
  const planilhaRecente = () => { const p = store.state().painel || {}; return p.fonte !== 'publico' && p.atualizadoEm && Date.now() - new Date(p.atualizadoEm) < 6 * 3600e3; };
  const aplicar = (j, origem) => {
    if (planilhaRecente()) return false; // a leitura das planilhas pode ter terminado enquanto esta esperava a rede
    const novo = resumoPainel(j, hist), p = store.state().painel || {};
    if (p.totais?.cadastros === novo.totais.cadastros && p.totais?.pessoas === novo.totais.pessoas && p.painelEm === novo.painelEm) return false;
    novo.origem = origem; store.state().painel = novo; store.touch('painel'); return true;
  };
  // A cópia da coleta diária entra na hora; a leitura ao vivo vem em seguida, se a rede permitir
  let mudou = !atual.totais?.cadastros && snap?.dados ? aplicar(snap.dados, 'coleta diária') : false;
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(store.cfg().painelDados || PAINEL_PUBLICO, { cache: 'no-store', signal: ctrl.signal }); clearTimeout(t);
    const j = r.ok ? await r.json() : null;
    if (j && typeof j.total === 'number') mudou = aplicar(j, 'ao vivo') || mudou;
  } catch { /* sem rede ou fonte fora do ar: fica a cópia da coleta diária */ }
  const t = store.state().painel?.totais;
  if (!t?.cadastros && !snap?.dados) return { n: 0, msg: 'Painel CIQUANTA indisponível no momento' };
  return { n: mudou ? 1 : 0, msg: mudou ? `${t.cadastros} cadastros, ${t.pessoas} visitantes previstos (${store.state().painel.origem})` : 'painel sem novidades' };
}

const CADENCIA_POR_SEGMENTO = { Empresa: 'cad-empresas', Startup: 'cad-empresas', 'Associação/Rede': 'cad-empresas', 'Academia/ICT': 'cad-empresas', Fomentador: 'cad-fomento', Autoridade: 'cad-autoridades', Investidor: 'cad-investidores' };
export const cadenciaPara = o => (o.setor === 'consultoria' ? 'cad-canais' : CADENCIA_POR_SEGMENTO[o.segmento]) || 'cad-empresas';

/** Quem o piloto automático abordaria agora, em ordem de potencial. */
export function candidatosPiloto(limite) {
  const s = store.state(), c = s.config, ctx = contexto();
  const tocados = new Set([...s.inscricoes.map(i => store.get('contatos', i.contatoId)?.orgId), ...s.envios.map(e => store.get('contatos', e.contatoId)?.orgId)].filter(Boolean));
  const out = [];
  for (const o of s.orgs) {
    if ((o.relacionamento && o.relacionamento !== 'mapeada') || tocados.has(o.id) || (o.tags || []).includes('CNPJ irregular')) continue;
    const cts = s.contatos.filter(x => x.orgId === o.id && isEmail(x.email) && !x.optout && !store.suprimido(x.email));
    if (!cts.length) continue;
    const total = pontuar(o, ctx).total;
    if (total < (Number(c.pilotoMinimo) || 55)) continue;
    const ct = [...cts].sort((a, b) => (a.canal ? 1 : 0) - (b.canal ? 1 : 0) || ORDEM_PAPEL.indexOf(a.area) - ORDEM_PAPEL.indexOf(b.area))[0];
    const cad = store.get('cadencias', cadenciaPara(o));
    if (cad?.ativa) out.push({ org: o, contato: ct, cadencia: cad, pontos: total });
  }
  return out.sort((a, b) => b.pontos - a.pontos).slice(0, limite ?? 50);
}
export async function piloto() {
  const c = store.cfg();
  if (!c.pilotoAutomatico) return { n: 0, msg: 'desligado' };
  if (!podeAutomatizar()) return { n: 0, msg: 'outro computador conduz os envios automáticos' };
  const hoje = isoDay();
  const jaHoje = store.list('inscricoes').filter(i => i.origem === 'piloto' && (i.criadoEm || '').slice(0, 10) === hoje).length;
  const vagas = Math.max(0, (Number(c.pilotoLimite) || 12) - jaHoje);
  if (!vagas) return { n: 0, msg: 'limite diário já atingido' };
  let n = 0;
  for (const x of candidatosPiloto(vagas)) {
    const r = inscrever(x.cadencia.id, [x.contato.id]);
    if (r.novos) { const ins = store.list('inscricoes').find(i => i.contatoId === x.contato.id && i.status === 'ativa'); if (ins) ins.origem = 'piloto'; n++; }
  }
  if (n) store.touch('inscricoes');
  return { n, msg: n ? `${n} organização(ões) inscrita(s) nas cadências` : 'nenhuma organização elegível hoje' };
}

const FUNCOES = { mapeamento, canais, receita, painel, piloto };
const ORDEM = ['painel', 'mapeamento', 'canais', 'receita', 'gmail', 'piloto'];
let rodando = false, timer = null;
const subs = new Set();
export const onAutomacao = fn => (subs.add(fn), () => subs.delete(fn));
const avisar = res => subs.forEach(f => { try { f(res); } catch (e) { console.error(e); } });
export const estado = () => ({ rodando, ultima: ultimaExecucao() });

/** Executa as rotinas ligadas. Ordem importa: organizações antes dos contatos, contatos antes do piloto. */
export async function executar({ manual = false } = {}) {
  if (rodando) return [];
  rodando = true; avisar();
  const res = [];
  try {
    await store.loadSetores(); await carregarSinais();
    const c = store.cfg();
    for (const r of ORDEM.map(id => ROTINAS.find(x => x.id === id))) {
      if (!FUNCOES[r.id] || !c[r.chave]) continue;
      try { const x = await FUNCOES[r.id](); res.push({ ...r, ...x, ok: true }); if (x.n || manual) anotar(r.id, x.n, x.msg); }
      catch (e) { console.error(r.id, e); res.push({ ...r, n: 0, msg: e.message, ok: false }); anotar(r.id, 0, e.message, false); }
    }
    try { localStorage.setItem(K_ULT, new Date().toISOString()); } catch {}
  } finally { rodando = false; avisar(res); }
  if (manual) { const n = res.reduce((a, x) => a + (x.n || 0), 0); toast(n ? `Automação concluída: ${res.filter(x => x.n).map(x => x.msg).join('; ')}.` : 'Automação concluída: tudo em dia.', 'ok'); }
  return res;
}

export function iniciar() {
  if (timer) return;
  setTimeout(() => executar(), 1500);
  timer = setInterval(() => executar(), INTERVALO);
}
