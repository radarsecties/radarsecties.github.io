import * as store from '../store.js';
import { esc, money, norm, debounce, options, FUNIL, MODALIDADES, modNome, fmtDate, toCSV, download, toast } from '../util.js';
import { openOportunidadeForm } from '../components.js';
import { loadMecanismos, mecCurto } from '../email.js';
import { chart, PALETTE } from '../charts.js';
import { icon } from '../icons.js';

export async function render(view, { params }) {
  await loadMecanismos();
  const f = { q: params.get('q') || '', setor: params.get('setor') || '', modalidade: '', resp: '', visao: params.get('visao') || 'funil' };
  let ch = null;
  const filtradas = () => {
    const q = norm(f.q);
    return store.list('oportunidades').filter(o => (!f.setor || o.setor === f.setor) && (!f.modalidade || o.modalidade === f.modalidade) && (!f.resp || o.responsavel === f.resp) &&
      (!q || norm([o.titulo, store.get('orgs', o.orgId)?.nome, o.notas, o.proximoPasso].join(' ')).includes(q)));
  };
  const resp = () => [...new Set(store.list('oportunidades').map(o => o.responsavel).filter(Boolean))];
  const draw = () => {
    ch?.destroy(); ch = null;
    const l = filtradas();
    const abertas = l.filter(o => !['contratada', 'perdida'].includes(o.etapa));
    view.innerHTML = `<div class="section-head"><div><h2>Oportunidades de negócio</h2><p>Cada oportunidade liga uma organização a uma linha de pesquisa, uma modalidade de participação e um instrumento de financiamento. O valor ponderado multiplica o valor estimado pela probabilidade da etapa.</p></div>
      <button class="btn primary" id="nova">${icon('mais', 16)} Nova oportunidade</button></div>
      <div class="grid g4" style="margin-bottom:16px">
        <div class="card kpi"><span class="label">Valor ponderado</span><span class="value">${money(abertas.reduce((a, o) => a + store.pipelineValor(o), 0))}</span><span class="sub">${abertas.length} abertas</span></div>
        <div class="card kpi"><span class="label">Valor bruto em aberto</span><span class="value">${money(abertas.reduce((a, o) => a + (Number(o.valor) || 0), 0))}</span><span class="sub">soma dos valores estimados</span></div>
        <div class="card kpi"><span class="label">Contratado</span><span class="value">${money(l.filter(o => o.etapa === 'contratada').reduce((a, o) => a + (Number(o.valor) || 0), 0))}</span><span class="sub">${l.filter(o => o.etapa === 'contratada').length} oportunidades</span></div>
        <div class="card kpi"><span class="label">Taxa de conversão</span><span class="value">${(() => { const fech = l.filter(o => ['contratada', 'perdida'].includes(o.etapa)); return fech.length ? Math.round(100 * fech.filter(o => o.etapa === 'contratada').length / fech.length) + '%' : '—'; })()}</span><span class="sub">entre oportunidades encerradas</span></div>
      </div>
      <div class="toolbar">
        <div class="tabs" style="margin:0;border:0">${[['funil', 'Funil'], ['tabela', 'Tabela'], ['previsao', 'Previsão']].map(([k, t]) => `<button data-visao="${k}" class="${f.visao === k ? 'active' : ''}">${t}</button>`).join('')}</div>
        <input type="search" class="grow" id="q" placeholder="Buscar" value="${esc(f.q)}">
        <select id="setor">${options(store.setoresLista().map(s => ({ id: s.id, nome: s.nome })), f.setor, { empty: 'Todos os setores' })}</select>
        <select id="modalidade">${options(MODALIDADES, f.modalidade, { empty: 'Todas as modalidades' })}</select>
        <select id="resp">${options(resp(), f.resp, { empty: 'Todos os responsáveis' })}</select>
      </div><div id="corpo"></div>`;
    const C = view.querySelector('#corpo');
    if (!store.list('oportunidades').length) C.innerHTML = `<div class="card"><div class="empty">Nenhuma oportunidade cadastrada. Crie a partir de uma organização ou pelo botão acima.<br><span class="small">Sugestão: comece pelas organizações com atuação quântica confirmada, no <a href="#/organizacoes?evidencia=confirmada">filtro de organizações</a>.</span></div></div>`;
    else if (f.visao === 'funil') funil(C, l);
    else if (f.visao === 'tabela') tabela(C, l);
    else ch = previsao(C, l);
    view.querySelector('#nova').onclick = () => openOportunidadeForm({}, draw);
    view.querySelectorAll('[data-visao]').forEach(b => b.onclick = () => { f.visao = b.dataset.visao; draw(); });
    view.querySelector('#q').addEventListener('input', debounce(e => { f.q = e.target.value; draw(); const q = view.querySelector('#q'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 300));
    ['setor', 'modalidade', 'resp'].forEach(k => view.querySelector('#' + k).onchange = e => { f[k] = e.target.value; draw(); });
  };

  const funil = (C, l) => {
    C.innerHTML = `<div class="kanban" id="kb">${FUNIL.map(e => {
      const col = l.filter(o => (o.etapa || 'qualificacao') === e.id);
      return `<section class="kcol" data-et="${e.id}"><header><div class="h"><span><span class="dot-i" style="background:${e.cor};margin-right:6px"></span>${esc(e.nome)}</span><span class="badge gray">${col.length}</span></div>
        <div class="s">${money(col.reduce((a, o) => a + (Number(o.valor) || 0), 0))} · ${e.prob}%</div></header>
        <div class="kbody">${col.map(o => { const org = store.get('orgs', o.orgId); return `<article class="kcard" draggable="true" data-id="${esc(o.id)}" style="border-left-color:${e.cor}">
          <div class="t">${esc(o.titulo)}</div><div class="s">${esc(org?.nomeFantasia || org?.nome || '—')} · ${esc(store.setorCurto(o.setor))}</div>
          <div class="v">${money(o.valor)} <span class="s">· ${o.probabilidade ?? e.prob}%</span></div>
          ${o.proximoEm ? `<div class="s">Próximo passo: ${fmtDate(o.proximoEm)}</div>` : ''}</article>`; }).join('')}</div></section>`;
    }).join('')}</div>`;
    const kb = C.querySelector('#kb'); let drag = null;
    kb.addEventListener('dragstart', e => { const c = e.target.closest('.kcard'); if (c) { drag = c.dataset.id; e.dataTransfer.setData('text/plain', drag); } });
    kb.addEventListener('dragover', e => { const col = e.target.closest('.kcol'); if (col) { e.preventDefault(); kb.querySelectorAll('.kcol').forEach(k => k.classList.toggle('drop', k === col)); } });
    kb.addEventListener('drop', e => {
      e.preventDefault(); const col = e.target.closest('.kcol'); kb.querySelectorAll('.kcol').forEach(k => k.classList.remove('drop'));
      const o = store.get('oportunidades', drag || e.dataTransfer.getData('text/plain'));
      if (o && col && o.etapa !== col.dataset.et) {
        const et = FUNIL.find(x => x.id === col.dataset.et);
        o.etapa = et.id; o.probabilidade = et.prob; store.touch('oportunidades');
        store.logInteracao({ orgId: o.orgId, tipo: 'nota', titulo: `Oportunidade "${o.titulo}": ${et.nome}` });
        const org = store.get('orgs', o.orgId); if (org && et.id === 'contratada') { org.relacionamento = 'parceira'; store.touch('orgs'); }
        toast(`${o.titulo}: ${et.nome}.`, 'ok'); draw();
      }
    });
    kb.addEventListener('click', e => { const c = e.target.closest('.kcard'); if (c) openOportunidadeForm(store.get('oportunidades', c.dataset.id), draw); });
  };

  const tabela = (C, l) => {
    const rows = [...l].sort((a, b) => store.pipelineValor(b) - store.pipelineValor(a));
    C.innerHTML = `<div class="toolbar"><button class="btn sm" id="exp">Exportar CSV</button></div><div class="table-wrap"><table><thead><tr><th>Oportunidade</th><th>Organização</th><th>Setor</th><th>Modalidade</th><th>Mecanismo</th><th>Etapa</th><th class="num">Valor</th><th class="num">Prob.</th><th class="num">Ponderado</th><th>Previsão</th><th></th></tr></thead><tbody>
      ${rows.map(o => { const org = store.get('orgs', o.orgId); const et = FUNIL.find(x => x.id === o.etapa) || FUNIL[0]; return `<tr class="row-link" data-id="${esc(o.id)}"><td class="title">${esc(o.titulo)}</td><td>${org ? `<a href="#/org/${esc(org.id)}">${esc(org.nomeFantasia || org.nome)}</a>` : '—'}</td><td>${esc(store.setorCurto(o.setor))}</td><td class="small">${esc(modNome(o.modalidade))}</td><td class="small">${o.mecanismo ? esc(mecCurto(o.mecanismo)) : '—'}</td>
        <td><span class="badge gray"><span class="dot-i" style="background:${et.cor}"></span>${esc(et.nome)}</span></td><td class="num">${money(o.valor)}</td><td class="num">${o.probabilidade ?? 0}%</td><td class="num title">${money(store.pipelineValor(o))}</td><td class="small">${o.previsao ? fmtDate(o.previsao) : '—'}</td>
        <td><button class="btn sm ghost danger" data-del="${esc(o.id)}" aria-label="Excluir">${icon('x', 14)}</button></td></tr>`; }).join('')}</tbody></table></div>`;
    C.querySelector('tbody').onclick = async e => {
      const d = e.target.closest('[data-del]');
      if (d) { e.stopPropagation(); store.removerComDesfazer('oportunidades', d.dataset.del, 'Oportunidade', draw); draw(); return; }
      if (e.target.closest('a')) return;
      const tr = e.target.closest('tr[data-id]'); if (tr) openOportunidadeForm(store.get('oportunidades', tr.dataset.id), draw);
    };
    C.querySelector('#exp').onclick = () => download(`ciquanta-oportunidades-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows, [
      { label: 'oportunidade', key: 'titulo' }, { label: 'organizacao', get: o => store.get('orgs', o.orgId)?.nome }, { label: 'setor', get: o => store.setorNome(o.setor) },
      { label: 'modalidade', get: o => modNome(o.modalidade) }, { label: 'mecanismo', get: o => o.mecanismo ? mecCurto(o.mecanismo) : '' }, { label: 'etapa', get: o => (FUNIL.find(x => x.id === o.etapa) || FUNIL[0]).nome },
      { label: 'valor', key: 'valor' }, { label: 'probabilidade', key: 'probabilidade' }, { label: 'ponderado', get: o => store.pipelineValor(o) }, { label: 'previsao', key: 'previsao' }, { label: 'responsavel', key: 'responsavel' }, { label: 'proximo_passo', key: 'proximoPasso' },
    ]), 'text/csv;charset=utf-8');
  };

  const previsao = (C, l) => {
    const abertas = l.filter(o => !['perdida'].includes(o.etapa));
    const tri = d => { if (!d) return 'Sem previsão'; const x = new Date(d + 'T12:00:00'); return `${Math.floor(x.getMonth() / 3) + 1}º tri ${x.getFullYear()}`; };
    const ordem = k => k === 'Sem previsão' ? '9999' : k.slice(-4) + k[0];
    const g = {}; abertas.forEach(o => { const k = tri(o.previsao); (g[k] ||= { pond: 0, contr: 0, bruto: 0 }); if (o.etapa === 'contratada') g[k].contr += Number(o.valor) || 0; else { g[k].pond += store.pipelineValor(o); g[k].bruto += Number(o.valor) || 0; } });
    const ks = Object.keys(g).sort((a, b) => ordem(a).localeCompare(ordem(b)));
    C.innerHTML = `<div class="grid split-21"><div class="card"><h3>Previsão por trimestre</h3><div class="chart-box tall"><canvas id="c-prev"></canvas></div></div>
      <div class="card"><h3>Resumo</h3><div class="table-wrap"><table><thead><tr><th>Trimestre</th><th class="num">Contratado</th><th class="num">Ponderado</th></tr></thead><tbody>${ks.map(k => `<tr><td>${esc(k)}</td><td class="num">${money(g[k].contr)}</td><td class="num">${money(g[k].pond)}</td></tr>`).join('') || '<tr><td colspan="3" class="empty">Sem dados</td></tr>'}</tbody></table></div></div></div>`;
    return chart(C.querySelector('#c-prev'), {
      type: 'bar', data: { labels: ks, datasets: [{ label: 'Contratado', data: ks.map(k => g[k].contr), backgroundColor: '#12805C', borderRadius: 4 }, { label: 'Ponderado em aberto', data: ks.map(k => g[k].pond), backgroundColor: PALETTE[0], borderRadius: 4 }] },
      options: { scales: { x: { stacked: true }, y: { stacked: true, ticks: { callback: v => money(v) } } }, plugins: { tooltip: { callbacks: { label: c => `${c.dataset.label}: ${money(c.raw)}` } } } },
    });
  };

  draw();
  const onTheme = () => draw(); window.addEventListener('themechange', onTheme);
  return () => { ch?.destroy(); window.removeEventListener('themechange', onTheme); };
}
