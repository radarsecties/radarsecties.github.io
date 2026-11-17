// Gera a proposta técnica e comercial de uma oportunidade, no template do CIQUANTA, pronta para PDF.
import * as store from './store.js';
import { loadMecanismos } from './email.js';
import { esc, money, modNome, MESES_LONGOS, abrirJanela, mostrarDocumento } from './util.js';

const BASE = new URL('../', import.meta.url).href;
const hoje = () => { const d = new Date(); return `${d.getDate()} de ${MESES_LONGOS[d.getMonth()]} de ${d.getFullYear()}`; };

export async function gerarProposta(opId) {
  // A janela é aberta antes das leituras assíncronas para não ser barrada pelo bloqueador de pop-ups
  const w = abrirJanela(); if (!w) return;
  const mecs = await loadMecanismos();
  const S = await store.loadSetores();
  const op = store.get('oportunidades', opId); if (!op) { w.close(); return; }
  const org = store.get('orgs', op.orgId) || {};
  const setor = S[op.setor]; const agenda = setor?.deck ? setor : S[setor?.deckId];
  const linha = agenda?.linhas?.find(l => l.id === op.linha);
  const mec = mecs[op.mecanismo]; const c = store.cfg(), comum = S.__comum;
  const valor = Number(op.valor) || 0;
  const num = `CQ-${new Date().getFullYear()}-${String(op.id).slice(-5).toUpperCase()}`;
  // Estimativa de custo líquido pela Lei do Bem (art. 19-A), apenas quando esse é o mecanismo escolhido
  const bem = op.mecanismo === 'lei-do-bem' && valor ? [0.5, 2.5].map(f => ({ f, eco: valor * Math.min(f, 2.5) * 0.34, liq: Math.max(0, valor - valor * f * 0.34) })) : null;
  const prazo = { validacao: '6 a 10 semanas', pesquisa: 'conforme plano de trabalho, em ciclos de 6 a 12 meses', capacitacao: 'conforme programa de formação', acesso: 'conforme pacote de horas contratado', institucional: 'plurianual', patrocinio: 'conforme cota' }[op.modalidade] || 'a definir';
  const li = a => (a || []).map(x => `<li>${esc(x)}</li>`).join('');
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Proposta ${num} · ${esc(org.nome || '')}</title>
<style>@page{size:A4;margin:18mm 18mm 20mm}*{box-sizing:border-box}body{font:11pt/1.5 Arial,Helvetica,sans-serif;color:#14224A;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #3056D5;padding-bottom:14px;margin-bottom:22px}header img.l{width:74mm}header img.g{width:50mm}
h1{font-size:20pt;margin:0 0 4px;line-height:1.2}h2{font-size:13pt;margin:22px 0 8px;page-break-after:avoid}.k{font-size:9.5pt;font-weight:700;color:#C8232C}.m{color:#5B6680}
.box{background:#EEF2FB;border-radius:6px;padding:12px 16px;margin:10px 0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px}.grid div{border-top:1.5px solid #D5DCEA;padding-top:6px}
.tres{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.tres>div{border-top:2px solid #D5DCEA;padding-top:6px}.tres>div:last-child{border-top-color:#3056D5}ul{margin:4px 0;padding-left:18px;color:#5B6680}li{margin-bottom:2px}
table{width:100%;border-collapse:collapse;margin-top:6px}td,th{padding:7px 8px;border-bottom:1.5px solid #D5DCEA;text-align:left;vertical-align:top}th{font-size:9.5pt;color:#C8232C}td.n{text-align:right;font-weight:700;white-space:nowrap}
.val{font-size:22pt;font-weight:700;color:#3056D5}footer{margin-top:26px;border-top:1.5px solid #D5DCEA;padding-top:10px;font-size:9pt;color:#5B6680}footer img{width:120mm;display:block;margin-bottom:8px}
.barra{position:fixed;top:0;left:0;right:0;background:#14224A;color:#fff;padding:10px 16px;font:13px Arial;display:flex;gap:12px;align-items:center}.barra button{font:inherit;padding:6px 14px;border-radius:6px;border:0;background:#3056D5;color:#fff;cursor:pointer}@media print{.barra{display:none}}@media screen{body{max-width:210mm;margin:60px auto 40px;padding:0 18mm}}</style></head><body>
<div class="barra"><span style="flex:1">Proposta ${num}. Revise o texto antes de enviar: valores, prazos e condições são definidos no instrumento jurídico.</span><button data-imprimir>Salvar em PDF ou imprimir</button></div>
<header><img class="l" src="${BASE}assets/logo-azul.png" alt="CIQUANTA"><img class="g" src="${BASE}assets/secties-govpb.png" alt="SECTIES, Governo da Paraíba"></header>
<div class="k">Proposta técnica e comercial · ${num} · ${hoje()}</div>
<h1>${esc(op.titulo)}</h1><div class="m">Para ${esc(org.nome || '')}${org.cidade ? `, ${esc(org.cidade)}${org.uf ? '/' + esc(org.uf) : ''}` : ''}</div>

<h2>1. O CIQUANTA</h2>
<p>O Centro Internacional de Computação e Tecnologias Quânticas do Estado da Paraíba é o primeiro centro com computadores quânticos operacionais da América Latina: 120 qubits supercondutores em duas máquinas (GJQ-100 e GJQ-20), datacenter clássico integrado e acesso por plataforma em nuvem. O projeto reúne o Governo do Estado da Paraíba, por meio da SECTIES, o Ministério da Ciência, Tecnologia e Inovação e a CETC-ICQ, de Suzhou, China.</p>

<h2>2. Objeto</h2>
<div class="grid"><div><span class="k">Modalidade</span><br>${esc(modNome(op.modalidade))}</div><div><span class="k">Setor</span><br>${esc(setor?.nome || '—')}</div><div><span class="k">Linha de pesquisa</span><br>${esc(linha?.nome || 'A definir em conjunto')}</div><div><span class="k">Prazo de referência</span><br>${esc(prazo)}</div></div>
${linha ? `<div class="box"><span class="k">Pergunta central</span><br><b>${esc(linha.pergunta)}</b></div>
<div class="tres"><div><b>Clássico</b><ul>${li(linha.classico)}</ul></div><div><b>Híbrido</b><ul>${li(linha.hibrido)}</ul></div><div><b>Quântico</b><ul>${li(linha.quantico)}</ul></div></div>
<h2>3. Entregas e indicadores</h2><table><tr><th style="width:22%">Entregas</th><td>${esc(linha.entregas)}</td></tr><tr><th>Indicadores</th><td>${esc(linha.indicadores)}</td></tr></table>` : `<h2>3. Entregas e indicadores</h2><p class="m">A definir no plano de trabalho, com métricas fixadas antes do início dos experimentos.</p>`}
${op.notas ? `<p><span class="k">Escopo específico</span><br>${esc(op.notas)}</p>` : ''}

<h2>4. Método</h2>
<p>${esc(comum.metodoLead)}</p><table>${comum.metodo.map(m => `<tr><th style="width:32%">${esc(m.t)}</th><td>${esc(m.d)}</td></tr>`).join('')}</table>
<p class="m" style="margin-top:8px">Etapas: ${comum.medicao.map(m => `${m.t.toLowerCase()} (${m.d.toLowerCase()})`).join('; ')}. ${esc(comum.infraNota)}</p>

<h2>5. Investimento</h2>
<div class="box"><span class="k">Valor estimado do projeto</span><br><span class="val">${valor ? money(valor) : 'A definir'}</span></div>
${mec ? `<p><span class="k">Instrumento de financiamento sugerido</span><br><b>${esc(mec.nome)}</b> (${esc(mec.baseLegal)}). ${esc(mec.encaixeCiquanta)}</p>` : ''}
${bem ? `<table><tr><th>Lei do Bem, art. 19-A: cenários de exclusão</th><th style="text-align:right">Economia de IRPJ e CSLL</th><th style="text-align:right">Custo líquido</th></tr>${bem.map(b => `<tr><td>Exclusão de ${Math.round(b.f * 100)}% do valor do projeto</td><td class="n">${money(b.eco)}</td><td class="n">${money(b.liq)}</td></tr>`).join('')}</table>
<p class="m" style="font-size:9.5pt">Estimativa com alíquota combinada de 34%, para empresa no lucro real com lucro fiscal suficiente. O percentual de exclusão é definido na aprovação do projeto. A empresa deve validar o enquadramento com a sua área tributária.</p>` : ''}

<h2>6. Condições</h2>
<ul><li>Dados tratados sob a LGPD, anonimizados ou sintéticos, com operação em território nacional.</li><li>Propriedade intelectual, confidencialidade e publicação de resultados definidas no instrumento jurídico, conforme a natureza da instituição.</li><li>Esta proposta é uma base de trabalho e não constitui obrigação entre as partes até a assinatura do instrumento.</li><li>Validade: 60 dias.</li></ul>

<footer><img src="${BASE}assets/parceiros-marinho.png" alt="CETC, Ministério da Ciência, Tecnologia e Inovação, Governo do Brasil, SECTIES e Governo da Paraíba">
${esc(c.remetenteNome || 'CIQUANTA')}${c.remetenteCargo ? ' · ' + esc(c.remetenteCargo) : ''} · ${esc(c.replyTo || 'ciquanta@secties.pb.gov.br')} · ciquanta.secties.pb.gov.br<br>Estação das Artes Luciano Agra, Altiplano Cabo Branco, João Pessoa (PB)</footer></body></html>`;
  mostrarDocumento(w, html);
  op.propostaEm = new Date().toISOString(); op.propostaNum = num; store.touch('oportunidades');
  store.logInteracao({ orgId: op.orgId, tipo: 'nota', titulo: `Proposta ${num} gerada: ${op.titulo}` });
}
