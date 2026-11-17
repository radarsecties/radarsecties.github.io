// Revisão de design do CRM: captura as telas (computador e celular, claro e escuro) com dados de exemplo
// e verifica, na página renderizada, os anti-padrões que o sistema visual proíbe.
//
//   node tools/design/revisar.mjs                      todas as telas, tema claro, computador e celular
//   node tools/design/revisar.mjs --telas painel,org/org-itau-unibanco --escuro
//   node tools/design/revisar.mjs --so-verificar        só a verificação, sem gravar imagens
//
// Requer o Playwright com Chromium (npx playwright install chromium, se ainda não houver).
// As imagens vão para tools/design/saida/ (fora do controle de versão).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SAIDA = path.join(RAIZ, 'tools/design/saida');
const arg = n => { const i = process.argv.indexOf('--' + n); return i < 0 ? null : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const TELAS = (arg('telas') || 'painel,interacoes,agenda,organizacoes,org/org-itau-unibanco,contatos,oportunidades,parceiros,captacao,editais,mecanismos,campanhas,cadencias,sinais,busca,setores,setores/financeiro,visitas,automacao,config').split(',');
const SO_VERIFICAR = !!arg('so-verificar'), ESCURO = !!arg('escuro');

// Fontes permitidas e regras do sistema visual (ver .claude/skills/design-ciquanta/SKILL.md)
const FONTES = ['Hanken Grotesk', 'Newsreader', 'ui-monospace', 'Arial'];

const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.pdf': 'application/pdf', '.gs': 'text/plain' };
function servidor() {
  return new Promise(res => {
    const s = http.createServer((req, r) => {
      const p = path.join(RAIZ, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
      if (!p.startsWith(RAIZ) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); }
      r.writeHead(200, { 'content-type': TIPOS[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
    }).listen(0, () => res(s));
  });
}

/** Verificação na página: devolve a lista de problemas encontrados na tela aberta. */
function verificar(FONTES) {
  const prob = [], vistos = new Set();
  const add = (regra, el) => { const k = regra + '|' + (el.className || el.tagName); if (vistos.has(k)) return; vistos.add(k); prob.push(`${regra}: <${el.tagName.toLowerCase()} class="${String(el.className).slice(0, 60)}"> "${(el.textContent || '').trim().slice(0, 40)}"`); };
  for (const el of document.querySelectorAll('#view *, .sidebar *, .topbar *')) {
    const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const raio = parseFloat(cs.borderTopLeftRadius) || 0, fundo = cs.backgroundColor, temFundo = fundo && !/rgba\(0, 0, 0, 0\)|transparent/.test(fundo);
    const texto = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    // Pílula: texto curto com fundo próprio ou contorno e cantos muito arredondados
    if (texto && r.height < 30 && raio >= r.height / 2 - 1 && (temFundo || parseFloat(cs.borderTopWidth) > 0) && !['INPUT', 'BUTTON', 'SELECT'].includes(el.tagName) && !el.closest('.chave, .toast, .deck-stage, .slide, kbd')) add('pílula', el);
    if (/gradient/.test(cs.backgroundImage) && !el.closest('.esqueleto, .slide, .deck-stage, .cover, select') && el.tagName !== 'SELECT') add('degradê', el);
    if (cs.boxShadow !== 'none' && !el.closest('.modal, .paleta, .toast, .sidebar.open, .slide, .deck-stage') && !/inset/.test(cs.boxShadow) && !/0px 0px 0px/.test(cs.boxShadow)) add('sombra fora de janela', el);
    if (texto && !FONTES.some(f => cs.fontFamily.includes(f)) && !el.closest('.slide, .deck-stage, svg, canvas')) add('fonte fora do sistema', el);
    if (texto && parseFloat(cs.fontSize) < 11 && !el.closest('svg, .slide, .deck-stage, .cal')) add('texto menor que 11 px', el);
  }
  if (document.documentElement.scrollWidth > innerWidth + 1) prob.push(`rolagem horizontal da página: ${document.documentElement.scrollWidth}px em ${innerWidth}px`);
  return prob;
}

const { chromium } = await import('playwright').catch(() => createRequire(import.meta.url)('playwright'));
const srv = await servidor(), U = `http://localhost:${srv.address().port}/`;
fs.mkdirSync(SAIDA, { recursive: true });
const b = await chromium.launch();
let total = 0;
for (const [nome, vp] of [['computador', { width: 1440, height: 900 }], ['celular', { width: 390, height: 844 }]]) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: SO_VERIFICAR ? 1 : 2, serviceWorkers: 'block', colorScheme: ESCURO ? 'dark' : 'light' });
  await ctx.route('https://script.google.com/**', r => r.abort());
  const p = await ctx.newPage(); const erros = [];
  p.on('pageerror', e => erros.push(e.message));
  await p.goto(U); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.evaluate(async () => {
    const st = await import('./js/store.js');
    for (let i = 0; i < 80 && st.list('orgs').length < 400; i++) await new Promise(r => setTimeout(r, 250));
    const orgs = st.list('orgs'), pega = n => orgs.find(o => o.nome === n);
    st.setConfig({ metaAnual: 12000000 });
    ['Itaú Unibanco', 'Banco do Brasil', 'Petrobras', 'Embrapa', 'Neoenergia'].forEach((n, i) => { const o = pega(n); if (o) st.upsert('contatos', { nome: ['Ana Souza', 'Bruno Lima', 'Carla Mendes', 'Diego Rocha', 'Elisa Prado'][i], email: `pessoa${i}@exemplo.com.br`, cargo: 'Gerente de P&D', orgId: o.id }, 'ct'); });
    const opp = (n, t, et, v, prob) => { const o = pega(n); if (o) st.upsert('oportunidades', { orgId: o.id, setor: o.setor, titulo: t, etapa: et, valor: v, probabilidade: prob, previsao: '2027-03-20' }, 'opp'); };
    opp('Itaú Unibanco', 'Otimização de carteiras', 'proposta', 1200000, 45); opp('Petrobras', 'Simulação de reservatórios', 'reuniao', 4000000, 25); opp('Banco do Brasil', 'Segurança pós-quântica', 'negociacao', 2500000, 70);
    const o = pega('Neoenergia'); if (o) st.upsert('adesoes', { orgId: o.id, cota: 'estrategico', valor: 750000, status: 'ativa', inicio: '2026-01-15', renovacao: '2027-01-15' }, 'ade');
    st.touch('orgs'); st.flush();
  });
  for (const t of TELAS) {
    await p.goto(U + '#/fontes'); await p.waitForTimeout(150);
    await p.goto(U + '#/' + t); await p.waitForTimeout(1600);
    const prob = await p.evaluate(verificar, FONTES);
    if (prob.length) { total += prob.length; console.log(`\n${t} (${nome}):\n  ` + prob.join('\n  ')); }
    if (!SO_VERIFICAR) await p.screenshot({ path: path.join(SAIDA, `${t.replace(/[/?=]/g, '_')}-${nome}${ESCURO ? '-escuro' : ''}.png`), fullPage: nome === 'celular' });
  }
  if (erros.length) { total += erros.length; console.log(`\nerros de página (${nome}):\n  ` + [...new Set(erros)].join('\n  ')); }
  await ctx.close();
}
await b.close(); srv.close();
console.log(total ? `\n${total} problema(s) encontrado(s).` : 'Nenhum anti-padrão encontrado.');
if (!SO_VERIFICAR) console.log('Imagens em ' + path.relative(RAIZ, SAIDA));
process.exitCode = total ? 1 : 0;
