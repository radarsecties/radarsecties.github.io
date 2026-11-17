// Utilitários comuns da coleta diária: rede com limites, leitura de RSS, arquivos JSON e normalização de texto.
import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

export const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
export const DADOS = RAIZ + 'data/';
export const AGENTE = 'Mozilla/5.0 (compatible; CIQUANTA-CRM/1.0; coleta institucional diaria)';

export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const hoje = () => new Date().toISOString().slice(0, 10);
export const agora = () => new Date().toISOString();
export const hash = s => createHash('sha1').update(String(s)).digest('hex').slice(0, 12);
export const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
export const dominio = u => String(u || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#:]/)[0];

/** Lê um JSON de data/, devolvendo `padrao` se o arquivo não existir ou estiver corrompido. */
export function ler(nome, padrao) {
  const p = DADOS + nome;
  if (!existsSync(p)) return padrao;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch (e) { console.warn(`! ${nome} ilegível, usando padrão: ${e.message}`); return padrao; }
}
/** Grava de forma atômica (arquivo temporário e renomeação), para nunca deixar um JSON pela metade no repositório. */
export function gravar(nome, obj) {
  const p = DADOS + nome, tmp = p + '.tmp';
  writeFileSync(tmp, JSON.stringify(obj, null, 1) + '\n');
  renameSync(tmp, p);
}

/** fetch com tempo limite, novas tentativas para falhas temporárias e identificação do coletor. */
export async function baixar(url, { tipo = 'text', timeout = 20000, tentativas = 3, headers = {} } = {}) {
  let ultimo;
  for (let i = 0; i < tentativas; i++) {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), timeout);
    try {
      const r = await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': AGENTE, 'Accept-Language': 'pt-BR,pt;q=0.9', ...headers } });
      if (r.status === 429 || r.status >= 500) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status, temporario: true });
      if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status });
      return tipo === 'json' ? await r.json() : await r.text();
    } catch (e) {
      ultimo = e;
      if (!(e.temporario || e.name === 'AbortError' || e.cause)) break; // erro definitivo (404, 403): não insiste
      await sleep(1500 * 2 ** i);
    } finally { clearTimeout(t); }
  }
  throw ultimo;
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export const decodificar = s => String(s || '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
export const semTags = s => decodificar(decodificar(s)).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/** Lê RSS 2.0 ou Atom e devolve itens { titulo, link, data, resumo, fonte }. */
export function lerRSS(xml) {
  const blocos = [...xml.matchAll(/<item\b[\s\S]*?<\/item>|<entry\b[\s\S]*?<\/entry>/g)].map(m => m[0]);
  const tag = (b, t) => { const m = b.match(new RegExp(`<${t}\\b[^>]*>([\\s\\S]*?)<\\/${t}>`)); return m ? m[1] : ''; };
  return blocos.map(b => {
    const linkAtom = (b.match(/<link\b[^>]*href="([^"]+)"/) || [])[1];
    const fonte = b.match(/<source\b[^>]*url="([^"]*)"[^>]*>([\s\S]*?)<\/source>/);
    const d = new Date(decodificar(tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date')).trim());
    return {
      titulo: semTags(tag(b, 'title')),
      link: decodificar(tag(b, 'link')).trim() || linkAtom || '',
      guid: semTags(tag(b, 'guid') || tag(b, 'id')),
      data: isNaN(d) ? '' : d.toISOString(),
      resumo: semTags(tag(b, 'description') || tag(b, 'summary')).slice(0, 600),
      fonte: fonte ? { nome: semTags(fonte[2]), url: fonte[1] } : null,
    };
  }).filter(i => i.titulo && i.link);
}

/** Valida CNPJ pelos dígitos verificadores. */
export function cnpjValido(c) {
  const d = String(c).replace(/\D/g, '');
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const dv = n => { let s = 0, p = n - 7; for (let i = 0; i < n; i++) { s += +d[i] * p--; if (p < 2) p = 9; } const r = s % 11; return r < 2 ? 0 : 11 - r; };
  return dv(12) === +d[12] && dv(13) === +d[13];
}

/** Organizações de referência (mapeamento curado mais descobertas automáticas aprovadas pelo filtro). */
export function organizacoes() {
  const ref = ler('empresas.json', { itens: [] }).itens;
  const desc = ler('descobertas.json', { itens: [] }).itens;
  return [...ref, ...desc.filter(d => !ref.some(r => norm(r.nome) === norm(d.nome)))];
}

/**
 * Nomes que identificam uma organização no texto de uma notícia: nome, nome fantasia e siglas entre parênteses.
 * Nomes curtos ou genéricos ficam de fora para não gerar associações falsas.
 */
const GENERICOS = new Set(['banco', 'grupo', 'instituto', 'universidade', 'governo', 'ministerio', 'empresa', 'brasil', 'nordeste', 'secretaria', 'vale', 'oi', 'claro', 'tim', 'globo', 'natura', 'rumo', 'gol']);
export function apelidos(o) {
  const out = new Set();
  const add = s => { const n = norm(s); if (n.length >= 4 && !GENERICOS.has(n)) out.add(n); };
  add(o.nome); add(o.nomeFantasia);
  for (const m of String(o.nome).matchAll(/\(([^)]+)\)/g)) add(m[1]);
  const curto = String(o.nome).split(/[,(]| - | – /)[0]; if (curto.length >= 6) add(curto);
  return [...out];
}
/** Procura organizações citadas em um texto (palavra inteira, sem acentos). */
export function citadas(texto, orgs, indice) {
  const t = ' ' + norm(texto).replace(/[^a-z0-9&.+ -]/g, ' ') + ' ';
  const achadas = [];
  for (const o of orgs) for (const a of indice.get(o.id) || []) {
    if (t.includes(' ' + a + ' ')) { achadas.push(o.id); break; }
  }
  return achadas;
}
export const indiceApelidos = orgs => new Map(orgs.map(o => [o.id, apelidos(o)]));
