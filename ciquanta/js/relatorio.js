// Relatório executivo de captação, no padrão visual do CIQUANTA, pronto para PDF.
import * as store from './store.js';
import { loadMecanismos, mecCurto } from './email.js';
import { esc, money, num, pct, fmtDate, funilNome, MESES_LONGOS, isoDay, abrirJanela, mostrarDocumento } from './util.js';
import { resumo } from './captacao.js';

const BASE = new URL('../', import.meta.url).href;

export async function gerarRelatorio() {
  const w = abrirJanela(); if (!w) return;
  await loadMecanismos(); await store.loadSetores();
  const r = resumo(), s = store.state(), c = s.config, d = new Date(), hoje = isoDay();
  const emRel = s.orgs.filter(o => o.relacionamento && o.relacionamento !== 'mapeada').length, parceiras = s.orgs.filter(o => o.relacionamento === 'parceira').length;
  const enviados = s.envios.filter(e => e.status === 'enviado'), resp = enviados.filter(e => e.respondido).length;
  const porSetor = Object.entries(s.oportunidades.filter(o => !['perdida', 'contratada'].includes(o.etapa)).reduce((a, o) => (a[o.setor || ''] = (a[o.setor || ''] || 0) + store.pipelineValor(o), a), {})).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const marcos = [...s.eventos.filter(e => e.data >= hoje).map(e => ({ data: e.data, t: e.titulo, conf: e.aConfirmar })), ...s.editais.filter(e => e.prazo && e.prazo >= hoje && ['aberto', 'preparacao'].includes(e.status)).map(e => ({ data: e.prazo, t: 'Prazo de edital: ' + e.titulo }))].sort((a, b) => a.data.localeCompare(b.data)).slice(0, 8);
  const p = s.painel?.totais || {};
  const kpi = (l, v, sub) => `<div><span class="k">${l}</span><div class="val">${v}</div><span class="m">${sub}</span></div>`;
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório executivo de captação · CIQUANTA</title>
<style>@page{size:A4;margin:16mm 16mm 18mm}*{box-sizing:border-box}body{font:10.5pt/1.45 Arial,Helvetica,sans-serif;color:#14224A;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #3056D5;padding-bottom:12px;margin-bottom:18px}header img.l{width:70mm}header img.g{width:46mm}
h1{font-size:19pt;margin:0 0 2px}h2{font-size:12.5pt;margin:20px 0 6px;page-break-after:avoid}.k{font-size:9pt;font-weight:700;color:#C8232C}.m{color:#5B6680;font-size:9.5pt}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:14px 0 4px}.kpis>div{border-top:2px solid #D5DCEA;padding-top:6px}.val{font-size:17pt;font-weight:700;color:#3056D5;line-height:1.2}
table{width:100%;border-collapse:collapse}td,th{padding:6px 7px;border-bottom:1.2px solid #D5DCEA;text-align:left;vertical-align:top}th{font-size:9pt;color:#C8232C}td.n,th.n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}tr{page-break-inside:avoid}
.bar{height:6px;background:#D5DCEA;border-radius:4px;overflow:hidden;display:flex;margin-top:4px}.bar i{background:#12805C}.bar b{background:#7F97E8}.duas{display:grid;grid-template-columns:1fr 1fr;gap:22px}
footer{margin-top:22px;border-top:1.2px solid #D5DCEA;padding-top:8px;font-size:8.5pt;color:#5B6680}footer img{width:112mm;display:block;margin-bottom:6px}
.barra{position:fixed;top:0;left:0;right:0;background:#14224A;color:#fff;padding:10px 16px;font:13px Arial;display:flex;gap:12px;align-items:center}.barra button{font:inherit;padding:6px 14px;border-radius:6px;border:0;background:#3056D5;color:#fff;cursor:pointer;margin-left:auto}@media print{.barra{display:none}}@media screen{body{max-width:210mm;margin:60px auto 40px;padding:0 16mm}}</style></head><body>
<div class="barra">Relatório gerado com os dados do CRM neste momento.<button data-imprimir>Salvar em PDF ou imprimir</button></div>
<header><img class="l" src="${BASE}assets/logo-azul.png" alt="CIQUANTA"><img class="g" src="${BASE}assets/secties-govpb.png" alt="SECTIES, Governo da Paraíba"></header>
<div class="k">Relações institucionais · ${d.getDate()} de ${MESES_LONGOS[d.getMonth()]} de ${d.getFullYear()}</div>
<h1>Relatório executivo de captação</h1>
<div class="m">Centro Internacional de Computação e Tecnologias Quânticas do Estado da Paraíba</div>

<div class="kpis">
${kpi('Meta anual', r.meta ? money(r.meta) : 'não definida', r.meta ? `${pct(r.contratado, r.meta)}% contratado` : 'defina no plano de captação')}
${kpi('Contratado', money(r.contratado), `${r.fechadas} contrato(s)`)}
${kpi('Pipeline ponderado', money(r.ponderado), `${r.abertas} oportunidade(s) em aberto`)}
${kpi(r.meta && !r.lacuna ? 'Cobertura da meta' : 'Falta gerar', r.meta ? (r.lacuna ? money(r.lacuna) : Math.round(r.cobertura * 100) + '%') : '—', 'contratado mais ponderado, contra a meta')}
</div>
<div class="kpis">
${kpi('Organizações mapeadas', num(s.orgs.length), `${num(emRel)} em relacionamento · ${num(parceiras)} parceira(s)`)}
${kpi('Contatos', num(s.contatos.length), `${num(s.contatos.filter(x => x.email).length)} com e-mail`)}
${kpi('E-mails enviados', num(enviados.length), enviados.length ? `${pct(resp, enviados.length)}% com resposta` : 'sem envios registrados')}
${kpi('Visitas à réplica', p.visitas ?? '—', p.visitas === undefined ? 'Painel CIQUANTA não sincronizado' : `${num(p.pessoas)} visitantes · ${num(p.cadastros)} cadastros`)}
</div>

<h2>Frentes de captação</h2>
<table><thead><tr><th>Frente</th><th class="n">Meta</th><th class="n">Contratado</th><th class="n">Ponderado</th><th class="n">Oportunidades</th><th class="n">Organizações abordadas</th></tr></thead><tbody>
${r.frentes.map(f => `<tr><td><b>${esc(f.nome)}</b><div class="bar"><i style="width:${f.contratado / Math.max(f.meta, f.contratado + f.ponderado, 1) * 100}%"></i><b style="width:${f.ponderado / Math.max(f.meta, f.contratado + f.ponderado, 1) * 100}%"></b></div></td><td class="n">${f.meta ? money(f.meta) : '—'}</td><td class="n">${money(f.contratado)}</td><td class="n">${money(f.ponderado)}</td><td class="n">${f.nOpp}</td><td class="n">${f.mecs.length ? `${num(f.abordadas)} de ${num(f.orgs)}` : '—'}</td></tr>`).join('')}
</tbody></table>

<h2>Maiores oportunidades em aberto</h2>
${r.top.length ? `<table><thead><tr><th>Oportunidade</th><th>Organização</th><th>Etapa</th><th>Mecanismo</th><th>Previsão</th><th class="n">Valor</th><th class="n">Ponderado</th></tr></thead><tbody>
${r.top.map(o => `<tr><td><b>${esc(o.titulo)}</b></td><td>${esc(store.get('orgs', o.orgId)?.nome || '')}</td><td>${esc(funilNome(o.etapa))}</td><td>${o.mecanismo ? esc(mecCurto(o.mecanismo)) : '—'}</td><td>${o.previsao ? fmtDate(o.previsao) : '—'}</td><td class="n">${money(o.valor)}</td><td class="n">${money(store.pipelineValor(o))}</td></tr>`).join('')}</tbody></table>` : '<p class="m">Nenhuma oportunidade em aberto registrada.</p>'}

<div class="duas"><div><h2>Previsão por trimestre</h2>
<table><thead><tr><th>Trimestre</th><th class="n">Contratado</th><th class="n">Ponderado</th></tr></thead><tbody>${r.tri.map(t => `<tr><td>${t.rotulo}</td><td class="n">${money(t.contratado)}</td><td class="n">${money(t.ponderado)}</td></tr>`).join('')}</tbody></table>
${r.semData ? `<p class="m">${money(r.semData)} ponderados ainda sem data de previsão.</p>` : ''}</div>
<div><h2>Pipeline por setor</h2>
${porSetor.length ? `<table><thead><tr><th>Setor</th><th class="n">Ponderado</th></tr></thead><tbody>${porSetor.map(([k, v]) => `<tr><td>${esc(k ? store.setorNome(k) : 'Sem setor')}</td><td class="n">${money(v)}</td></tr>`).join('')}</tbody></table>` : '<p class="m">Sem oportunidades em aberto.</p>'}</div></div>

<h2>Próximos marcos</h2>
${marcos.length ? `<table><tbody>${marcos.map(m => `<tr><td style="width:28mm;white-space:nowrap">${fmtDate(m.data)}</td><td>${esc(m.t)}${m.conf ? ' <span class="m">(a confirmar)</span>' : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="m">Sem marcos futuros na agenda.</p>'}

<footer><img src="${BASE}assets/parceiros-marinho.png" alt="CETC, Ministério da Ciência, Tecnologia e Inovação, Governo do Brasil, SECTIES e Governo da Paraíba">
Contratado: soma das oportunidades na etapa "Contratada". Ponderado: valor das oportunidades em aberto multiplicado pela probabilidade da etapa. ${esc(c.replyTo || 'ciquanta@secties.pb.gov.br')} · ciquanta.secties.pb.gov.br</footer></body></html>`;
  mostrarDocumento(w, html);
}
