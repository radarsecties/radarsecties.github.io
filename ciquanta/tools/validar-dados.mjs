// Verifica a integridade das bases de referência em data/.
// Uso: node tools/validar-dados.mjs   (código de saída 1 se houver erro)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const ler = n => JSON.parse(readFileSync(`${raiz}data/${n}.json`, 'utf8'));
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const erros = [], avisos = [];
const erro = (base, msg) => erros.push(`[${base}] ${msg}`);
const aviso = (base, msg) => avisos.push(`[${base}] ${msg}`);
const unicos = (base, itens, campo = 'id') => {
  const visto = new Set();
  for (const x of itens) { if (!x[campo]) erro(base, `item sem ${campo}: ${JSON.stringify(x).slice(0, 80)}`); else if (visto.has(x[campo])) erro(base, `${campo} repetido: ${x[campo]}`); visto.add(x[campo]); }
  return visto;
};
const url = (base, id, v) => { if (v && !/^https?:\/\/[^\s]+\.[^\s]+$/.test(v)) erro(base, `${id}: endereço inválido "${v}"`); };

const setores = ler('setores'), empresas = ler('empresas'), fontes = ler('fontes'), mecanismos = ler('mecanismos'), modelos = ler('modelos'), agenda = ler('agenda'), inst = ler('institucional');

const idSetor = unicos('setores', setores.itens);
const idFonte = unicos('fontes', fontes.itens);
const idMec = unicos('mecanismos', mecanismos.itens);
const idModelo = unicos('modelos', modelos.itens);
unicos('agenda', agenda.itens);

for (const s of setores.itens) {
  for (const c of ['nome', 'curto']) if (!s[c]) erro('setores', `${s.id}: falta ${c}`);
  if (s.deckId && s.deckId !== 'institucional' && !idSetor.has(s.deckId)) erro('setores', `${s.id}: deckId inexistente (${s.deckId})`);
  if (s.deck && !(s.linhas || []).length) erro('setores', `${s.id}: tem apresentação, mas não tem linhas de pesquisa`);
  for (const m of s.mecanismos || []) if (!idMec.has(m)) erro('setores', `${s.id}: mecanismo inexistente (${m})`);
  unicos(`setores/${s.id}/linhas`, s.linhas || []);
}

const UFS = new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));
const SEG = new Set(['Empresa', 'Startup', 'Investidor', 'Fomentador', 'Autoridade', 'Academia/ICT', 'Associação/Rede']);
const EV = new Set(['confirmada', 'indicios', 'potencial']);
const nomes = new Map();
for (const e of empresas.itens) {
  const id = e.nome || '(sem nome)';
  if (!e.nome) erro('empresas', 'organização sem nome');
  const k = norm(e.nome); if (nomes.has(k)) erro('empresas', `nome repetido: ${e.nome}`); nomes.set(k, 1);
  if (!SEG.has(e.segmento)) erro('empresas', `${id}: segmento inválido (${e.segmento})`);
  if (!EV.has(e.evidencia)) erro('empresas', `${id}: evidência inválida (${e.evidencia})`);
  if (e.setor && !idSetor.has(e.setor)) erro('empresas', `${id}: setor inexistente (${e.setor})`);
  if (!e.setor) aviso('empresas', `${id}: sem setor`);
  if (e.uf && !UFS.has(e.uf)) erro('empresas', `${id}: UF inválida (${e.uf})`);
  for (const m of e.mecanismos || []) if (!idMec.has(m)) erro('empresas', `${id}: mecanismo inexistente (${m})`);
  for (const f of e.fontes || []) if (!idFonte.has(f)) erro('empresas', `${id}: fonte inexistente (${f})`);
  // Empresas cujo negócio é a própria tecnologia quântica usam o perfil público (site) como referência
  if (e.evidencia !== 'potencial' && !(e.fontes || []).length && !((e.tags || []).includes('quântica') && e.site)) erro('empresas', `${id}: evidência "${e.evidencia}" sem fonte`);
  url('empresas', id, e.site);
  if (/@/.test(JSON.stringify(e))) erro('empresas', `${id}: contém endereço de e-mail (a base não deve ter dados de pessoas)`);
}

for (const f of fontes.itens) { if (!f.titulo) erro('fontes', `${f.id}: sem título`); url('fontes', f.id, f.url); }
for (const m of mecanismos.itens) {
  for (const c of ['nome', 'curto', 'baseLegal', 'gestor', 'link']) if (!m[c]) erro('mecanismos', `${m.id}: falta ${c}`);
  url('mecanismos', m.id, m.link);
}
const email = readFileSync(`${raiz}js/email.js`, 'utf8');
const validas = new Set([...email.slice(email.indexOf('VARIAVEIS'), email.indexOf('VARIAVEIS') + 3000).matchAll(/\['([a-z_]+)'/g)].map(x => x[1]));
for (const m of modelos.itens) {
  for (const c of ['nome', 'assunto', 'corpo']) if (!m[c]) erro('modelos', `${m.id}: falta ${c}`);
  const vars = [...`${m.assunto} ${m.corpo}`.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map(x => x[1]);
  for (const v of vars) if (!validas.has(v)) aviso('modelos', `${m.id}: variável não reconhecida {{${v}}}`);
}
for (const a of agenda.itens) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a.data || '')) erro('agenda', `${a.id}: data inválida (${a.data})`);
  if (a.tipo === 'potencial' && !a.aConfirmar) aviso('agenda', `${a.id}: evento potencial sem marca "a confirmar"`);
}
if (!Array.isArray(inst.paginas) || !inst.paginas.length) erro('institucional', 'sem páginas');

// Bases da coleta diária (quando existem)
import { existsSync } from 'node:fs';
const opcional = n => existsSync(`${raiz}data/${n}.json`) ? ler(n) : null;
const sin = opcional('sinais');
if (sin) { if (!Array.isArray(sin.itens)) erro('sinais', 'sem lista de itens'); else for (const x of sin.itens) if (!x.id || !x.titulo || !/^https?:\/\//.test(x.link || '')) erro('sinais', `item inválido: ${x.id || x.titulo}`); }
const can = opcional('canais');
if (can) for (const [id, v] of Object.entries(can.porOrg || {})) for (const e of v.emails || []) {
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(e.email)) erro('canais', `${id}: e-mail inválido ${e.email}`);
  if (!e.papel) erro('canais', `${id}: e-mail sem papel institucional (${e.email})`);
}
const rec = opcional('receita');
if (rec) for (const [id, v] of Object.entries(rec.porOrg || {})) if (!/^\d{14}$/.test(v.cnpj || '')) erro('receita', `${id}: CNPJ inválido`);
const desc = opcional('descobertas');
if (desc) for (const d of desc.itens || []) { if (!SEG.has(d.segmento)) erro('descobertas', `${d.nome}: segmento inválido`); if (d.setor && !idSetor.has(d.setor)) erro('descobertas', `${d.nome}: setor inexistente`); if (nomes.has(norm(d.nome))) aviso('descobertas', `${d.nome}: já está no mapeamento curado`); }

// Referências a modelos nas cadências iniciais (definidas em js/store.js)
const store = readFileSync(`${raiz}js/store.js`, 'utf8');
for (const m of store.matchAll(/modeloId: '([\w-]+)'/g)) if (!idModelo.has(m[1])) erro('cadências', `modelo inexistente (${m[1]})`);

const cont = (l, c) => l.reduce((a, x) => (a[x[c]] = (a[x[c]] || 0) + 1, a), {});
console.log(`Setores: ${setores.itens.length} · Organizações: ${empresas.itens.length} · Fontes: ${fontes.itens.length} · Mecanismos: ${mecanismos.itens.length} · Modelos: ${modelos.itens.length} · Agenda: ${agenda.itens.length}`);
console.log('Por evidência:', cont(empresas.itens, 'evidencia'));
console.log('Por segmento:', cont(empresas.itens, 'segmento'));
const semUso = fontes.itens.filter(f => !empresas.itens.some(e => (e.fontes || []).includes(f.id)) && f.tipo !== 'Documentos oficiais do CIQUANTA').length;
if (semUso) aviso('fontes', `${semUso} fonte(s) sem organização associada (podem ser usadas só nas apresentações)`);
if (avisos.length) console.log(`\n${avisos.length} aviso(s):\n` + avisos.slice(0, 40).join('\n') + (avisos.length > 40 ? `\n… e mais ${avisos.length - 40}` : ''));
if (erros.length) { console.error(`\n${erros.length} erro(s):\n` + erros.join('\n')); process.exit(1); }
console.log('\nBases íntegras.');
