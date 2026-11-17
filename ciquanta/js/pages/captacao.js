// Plano de captação: meta, frentes de financiamento, previsão por trimestre e cobertura por mecanismo
import * as store from '../store.js';
import { esc, money, num, pct, modal, toast, fmtDate } from '../util.js';
import { chart } from '../charts.js';
import { icon } from '../icons.js';
import { loadMecanismos, mecCurto } from '../email.js';
import { resumo, FRENTES } from '../captacao.js';
import { gerarRelatorio } from '../relatorio.js';
import { funilBadge } from '../components.js';

export const compacto = v => v >= 1e9 ? `R$ ${(v / 1e9).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} bi` : v >= 1e6 ? `R$ ${(v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi` : v >= 1e3 ? `R$ ${Math.round(v / 1e3)} mil` : money(v);

function abrirMetas(depois) {
  const c = store.cfg(), metas = c.metas || {};
  modal({ title: 'Metas de captação', body: `
    <form id="fm" class="form-grid"><label class="field full">Meta anual de captação (R$)<input type="number" name="metaAnual" min="0" step="50000" value="${esc(c.metaAnual || '')}"></label>
    ${FRENTES.map(f => `<label class="field">${esc(f.nome)}<input type="number" name="f:${f.id}" min="0" step="50000" value="${esc(metas[f.id] || '')}"></label>`).join('')}
    <p class="full muted small" id="soma" style="margin:0"></p></form>`,
    footer: '<button class="btn" data-close>Cancelar</button><button class="btn primary" id="ok">Salvar metas</button>',
    onMount: (m, close) => {
      const soma = () => { const d = new FormData(m.querySelector('#fm')); const t = FRENTES.reduce((a, f) => a + (+d.get('f:' + f.id) || 0), 0), meta = +d.get('metaAnual') || 0; m.querySelector('#soma').textContent = t ? `Soma das frentes: ${money(t)}${meta ? ` (${pct(t, meta)}% da meta anual)` : ''}.` : ''; };
      m.querySelector('#fm').addEventListener('input', soma); soma();
      m.querySelector('#ok').onclick = () => { const d = new FormData(m.querySelector('#fm')); store.setConfig({ metaAnual: Math.max(0, +d.get('metaAnual') || 0), metas: Object.fromEntries(FRENTES.map(f => [f.id, Math.max(0, +d.get('f:' + f.id) || 0)])) }); close(); toast('Metas salvas.', 'ok'); depois(); };
    } });
}

export async function render(view, { arg } = {}) {
  await loadMecanismos();
  const charts = []; let ordem = 'valor';
  const draw = () => {
    charts.splice(0).forEach(c => c.destroy());
    const r = resumo(), ano = new Date().getFullYear();
    const barra = (c, p, m) => { const base = Math.max(m, c + p, 1); return `<div class="meta-bar" style="height:8px" title="Contratado ${money(c)} · ponderado ${money(p)}${m ? ' · meta ' + money(m) : ''}"><i style="width:${c / base * 100}%"></i><b style="width:${p / base * 100}%"></b></div>`; };
    const mecs = [...r.porMec].sort((a, b) => ordem === 'lacuna' ? (b.orgs - b.abordadas) - (a.orgs - a.abordadas) : 0);
    view.innerHTML = `<div class="section-head"><div><h2>Plano de captação ${ano}</h2></div>
      <div class="toolbar" style="margin:0"><button class="btn" id="rel">${icon('modelos', 15)} Relatório executivo</button><button class="btn primary" id="metas">Definir metas</button></div></div>

    <div class="grid g4" style="margin-bottom:18px">
      <div class="card kpi"><span class="label">Meta anual</span><span class="value">${r.meta ? compacto(r.meta) : '—'}</span><span class="sub">${r.meta ? (r.somaMetas ? `${pct(r.somaMetas, r.meta)}% distribuídos nas frentes` : 'distribua a meta entre as frentes') : 'defina a meta para medir o avanço'}</span></div>
      <div class="card kpi"><span class="label">Contratado</span><span class="value" data-contar="${Math.round(r.contratado)}" data-formato="moeda">${compacto(r.contratado)}</span><span class="sub">${r.fechadas} contrato(s)${r.meta ? ` · ${pct(r.contratado, r.meta)}% da meta` : ''}</span>${r.meta ? barra(r.contratado, r.ponderado, r.meta) : ''}</div>
      <div class="card kpi"><span class="label">Pipeline ponderado</span><span class="value" data-contar="${Math.round(r.ponderado)}" data-formato="moeda">${compacto(r.ponderado)}</span><span class="sub">${r.abertas} oportunidade(s) em aberto${r.medio ? ` · valor médio ${compacto(r.medio)}` : ''}</span></div>
      <div class="card kpi"><span class="label">${r.meta && !r.lacuna ? 'Meta coberta' : 'Falta gerar'}</span><span class="value">${r.meta ? (r.lacuna ? compacto(r.lacuna) : Math.round(r.cobertura * 100) + '%') : '—'}</span><span class="sub">${!r.meta ? 'contratado mais ponderado, contra a meta' : r.lacuna ? (r.novas ? `cerca de ${r.novas} nova(s) oportunidade(s) no perfil atual` : 'em novas oportunidades ponderadas') : 'contratado mais ponderado superam a meta'}</span></div>
    </div>

    <div class="card" style="margin-bottom:18px"><h3>Frentes de captação <span class="muted">clique para ver as organizações elegíveis</span></h3>
      <div class="frentes">${r.frentes.map(f => `<a class="frente" href="${f.mecs.length ? '#/captacao/' + f.id : '#/oportunidades?visao=tabela'}">
        <div><b>${esc(f.nome)}</b><small>${esc(f.desc)}</small></div>
        <div class="n"><b>${compacto(f.contratado)}</b><small>contratado</small></div>
        <div class="n"><b>${compacto(f.ponderado)}</b><small>ponderado · ${f.nOpp} oport.</small></div>
        <div class="n"><b>${f.meta ? compacto(f.meta) : '—'}</b><small>meta</small></div>
        <div class="n"><b>${f.mecs.length ? `${num(f.abordadas)}/${num(f.orgs)}` : '—'}</b><small>${f.mecs.length ? 'organizações abordadas' : 'sem mecanismo'}</small></div>
        <div class="b">${barra(f.contratado, f.ponderado, f.meta)}</div></a>`).join('')}</div></div>

    <div class="grid g3" style="margin-bottom:18px">
      <div class="card span2"><h3>Previsão por trimestre <span class="muted">${r.semData ? `${compacto(r.semData)} ponderados sem data de previsão` : 'pela data prevista de cada oportunidade'}</span></h3><div class="chart-box"><canvas id="c-tri"></canvas></div></div>
      <div class="card"><h3>Maiores oportunidades <a class="small" href="#/oportunidades">abrir</a></h3><div class="list">${r.top.map(o => { const org = store.get('orgs', o.orgId); return `<a class="list-item" style="text-decoration:none;color:inherit" href="#/org/${esc(o.orgId)}?aba=oportunidades"><div style="min-width:0;flex:1"><div class="title">${esc(o.titulo)}</div><div class="meta">${esc(org?.nome || '')} · ${funilBadge(o.etapa)}${o.previsao ? ' · ' + fmtDate(o.previsao) : ''}</div></div><strong class="nowrap">${compacto(store.pipelineValor(o))}</strong></a>`; }).join('') || '<div class="empty">Registre oportunidades nas organizações de maior potencial para montar a previsão.</div>'}</div></div>
    </div>

    <div class="card"><h3>Cobertura por mecanismo de fomento <span class="muted">onde há organizações elegíveis ainda sem abordagem</span></h3>
      <div class="tabs" style="margin:0 0 12px;border:0"><button data-ord="valor" class="${ordem === 'valor' ? 'active' : ''}">Por valor em negociação</button><button data-ord="lacuna" class="${ordem === 'lacuna' ? 'active' : ''}">Por organizações sem abordagem</button></div>
      ${mecs.length ? `<div class="table-wrap"><table><thead><tr><th>Mecanismo</th><th>Frente</th><th class="num">Organizações</th><th class="num">Com contato</th><th class="num">Abordadas</th><th>Cobertura</th><th class="num">Oportunidades</th><th class="num">Ponderado</th><th class="num">Contratado</th></tr></thead><tbody>
        ${mecs.map(m => `<tr data-mec="${esc(m.id)}" style="cursor:pointer"><td class="title">${esc(mecCurto(m.id))}</td><td class="small">${esc(FRENTES.find(f => f.id === m.frente)?.nome.split(':')[0] || '')}</td><td class="num">${num(m.orgs)}</td><td class="num">${num(m.comContato)}</td><td class="num">${num(m.abordadas)}</td>
          <td><span class="pot"><i><b style="width:${pct(m.abordadas, m.orgs)}%"></b></i>${pct(m.abordadas, m.orgs)}%</span></td><td class="num">${m.nOpp}</td><td class="num">${m.ponderado ? compacto(m.ponderado) : '—'}</td><td class="num">${m.contratado ? compacto(m.contratado) : '—'}</td></tr>`).join('')}</tbody></table></div>`
        : '<div class="empty">Importe o mapeamento setorial em Busca ativa para ver a cobertura por mecanismo.</div>'}</div>`;

    const txt = getComputedStyle(document.documentElement).getPropertyValue('--text-2').trim();
    charts.push(chart(view.querySelector('#c-tri'), { type: 'bar', data: { labels: r.tri.map(t => t.rotulo), datasets: [
      { label: 'Contratado', data: r.tri.map(t => t.contratado), backgroundColor: '#12805C', borderRadius: 4, stack: 'v' },
      { label: 'Ponderado em aberto', data: r.tri.map(t => t.ponderado), backgroundColor: '#3056D5', borderRadius: 4, stack: 'v' },
      ...(r.meta ? [{ type: 'line', label: 'Meta por trimestre', data: r.tri.map(() => r.meta / 4), borderColor: '#C8232C', borderDash: [6, 4], borderWidth: 2, pointRadius: 0 }] : [])] },
      options: { scales: { x: { stacked: true }, y: { stacked: true, ticks: { color: txt, callback: v => compacto(v) } } }, plugins: { tooltip: { callbacks: { label: c => `${c.dataset.label}: ${money(c.parsed.y)}` } } } } }));
    view.querySelector('#metas').onclick = () => abrirMetas(draw);
    view.querySelector('#rel').onclick = () => gerarRelatorio();
    view.querySelectorAll('[data-ord]').forEach(b => b.onclick = () => { ordem = b.dataset.ord; draw(); });
    view.querySelectorAll('[data-mec]').forEach(tr => tr.onclick = () => { location.hash = `#/organizacoes?mecanismo=${encodeURIComponent(tr.dataset.mec)}`; });
  };

  // #/captacao/<frente>: organizações elegíveis da frente, por mecanismo
  const frente = arg => {
    const f = FRENTES.find(x => x.id === arg), r = resumo().frentes.find(x => x.id === arg);
    const comContato = new Set(store.list('contatos').filter(c => c.email).map(c => c.orgId));
    const orgs = store.list('orgs').filter(o => (o.mecanismos || []).some(m => f.mecs.includes(m)));
    const semAbordagem = orgs.filter(o => !o.relacionamento || o.relacionamento === 'mapeada');
    view.innerHTML = `<a class="btn ghost" href="#/captacao" style="margin-bottom:12px">${icon('esquerda', 16)} Plano de captação</a>
      <div class="section-head"><div><h2>${esc(f.nome)}</h2></div></div>
      <div class="grid g4" style="margin-bottom:18px">
        <div class="card kpi"><span class="label">Organizações elegíveis</span><span class="value">${num(orgs.length)}</span><span class="sub">${num(orgs.filter(o => comContato.has(o.id)).length)} com contato cadastrado</span></div>
        <div class="card kpi"><span class="label">Sem abordagem</span><span class="value">${num(semAbordagem.length)}</span><span class="sub">ainda no estágio "mapeada"</span></div>
        <div class="card kpi"><span class="label">Ponderado</span><span class="value">${compacto(r.ponderado)}</span><span class="sub">${r.nOpp} oportunidade(s)</span></div>
        <div class="card kpi"><span class="label">Contratado</span><span class="value">${compacto(r.contratado)}</span><span class="sub">${r.meta ? `${pct(r.contratado, r.meta)}% da meta de ${compacto(r.meta)}` : 'sem meta definida para a frente'}</span></div>
      </div>
      <div class="card"><h3>Mecanismos desta frente</h3><div class="list">${f.mecs.map(m => { const l = orgs.filter(o => (o.mecanismos || []).includes(m)); return `<a class="list-item" style="text-decoration:none;color:inherit" href="#/organizacoes?mecanismo=${encodeURIComponent(m)}"><div style="flex:1"><div class="title">${esc(mecCurto(m))}</div><div class="meta">${num(l.length)} organização(ões) · ${num(l.filter(o => !o.relacionamento || o.relacionamento === 'mapeada').length)} sem abordagem</div></div>${icon('direita', 15)}</a>`; }).join('')}</div></div>`;
  };

  if (arg && FRENTES.some(f => f.id === arg && f.mecs.length)) frente(arg); else draw();
  const onT = () => { if (!arg) draw(); }; window.addEventListener('themechange', onT);
  return () => { charts.forEach(c => c.destroy()); window.removeEventListener('themechange', onT); };
}
