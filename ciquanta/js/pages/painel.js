import * as store from '../store.js';
import * as G from '../google.js';
import * as monitor from '../monitor.js';
import { esc, num, money, pct, dayChip, relTime, FUNIL, RELACIONAMENTO, isoDay, fmtDate, fmtDateTime, isEmail } from '../util.js';
import { chart, PALETTE } from '../charts.js';
import { brMap } from '../components.js';
import { loadMecanismos, mecCurto } from '../email.js';
import { icon } from '../icons.js';

export async function render(view) {
  await loadMecanismos();
  const s = store.state();
  const charts = [];
  const abertas = s.oportunidades.filter(o => !['contratada', 'perdida'].includes(o.etapa));
  const ponderado = abertas.reduce((a, o) => a + store.pipelineValor(o), 0);
  const bruto = abertas.reduce((a, o) => a + (Number(o.valor) || 0), 0);
  const contratado = s.oportunidades.filter(o => o.etapa === 'contratada').reduce((a, o) => a + (Number(o.valor) || 0), 0);
  const enviados = s.envios.filter(e => e.status === 'enviado');
  const resp = enviados.filter(e => e.respondido).length;
  const d7 = Date.now() - 7 * 864e5;
  const inter7 = s.interacoes.filter(i => new Date(i.data) >= d7).length;
  const recebidos7 = s.recebidos.filter(r => r.direcao === 'entrada' && new Date(r.data) >= d7).length;
  const hoje = isoDay();
  const eventos = s.eventos.filter(e => e.data >= hoje).sort((a, b) => a.data.localeCompare(b.data)).slice(0, 5);
  const comEmail = s.contatos.filter(c => isEmail(c.email) && !c.optout).length;
  const live = monitor.estado();

  view.innerHTML = `
  <section class="hero"><div class="tx">
    <img class="logo l-light" src="assets/logo-azul.png" alt="CIQUANTA"><img class="logo l-dark" src="assets/logo-branco.png" alt="CIQUANTA">
    <h2>Centro Internacional de Computação e Tecnologias Quânticas do Estado da Paraíba</h2>
    <p>Relações institucionais: empresas que investem em P&D, fomentadores e autoridades, oportunidades de negócio, cadências de contato pela conta Google do centro e apresentações.</p>
    <div class="hero-actions">
      ${s.orgs.length ? '' : '<a class="btn primary" href="#/busca?aba=referencia">Importar mapeamento setorial</a>'}
      <a class="btn primary" href="#/oportunidades">${icon('oportunidades', 16)} Oportunidades</a>
      <a class="btn" href="#/cadencias">${icon('campanhas', 16)} Cadências</a>
      <a class="btn" href="#/apresentacoes/institucional">${icon('apresentacoes', 16)} Apresentação institucional</a>
    </div></div><div class="foto" role="img" aria-label="Criostato do computador quântico"></div>
  </section>

  <div class="grid g4" style="margin-bottom:16px">
    ${kpi('Pipeline ponderado', money(ponderado), `${abertas.length} oportunidades abertas · ${money(bruto)} em valor bruto`)}
    ${kpi('Contratado', money(contratado), `${s.oportunidades.filter(o => o.etapa === 'contratada').length} oportunidades contratadas`)}
    ${kpi('Organizações', num(s.orgs.length), `${s.orgs.filter(o => o.relacionamento === 'parceira').length} parceiras · ${s.orgs.filter(o => o.evidencia === 'confirmada').length} com atuação quântica confirmada`)}
    ${kpi('Interações (7 dias)', num(inter7), `${recebidos7} e-mails recebidos · ${pct(resp, enviados.length)}% de resposta às campanhas`)}
  </div>

  <div class="grid g3" style="margin-bottom:16px">
    <div class="card span2"><h3>Pipeline por setor <span class="muted">valor ponderado pela probabilidade</span></h3><div class="chart-box"><canvas id="c-setor"></canvas></div></div>
    <div class="card"><h3>Organizações no Brasil <span class="muted">clique num estado</span></h3><div id="map"></div></div>
  </div>

  <div class="grid g3" style="margin-bottom:16px">
    <div class="card"><h3>Funil de oportunidades <a class="small" href="#/oportunidades">abrir</a></h3><div class="chart-box"><canvas id="c-funil"></canvas></div></div>
    <div class="card"><h3>Relacionamento</h3><div class="chart-box"><canvas id="c-rel"></canvas></div></div>
    <div class="card"><h3>Mecanismos nas oportunidades</h3><div class="chart-box"><canvas id="c-mec"></canvas></div></div>
  </div>

  <div class="grid g3" style="margin-bottom:16px">
    <div class="card"><h3>Interações recentes <a class="small" href="#/interacoes">${live.ativo ? '<span class="badge ok">ao vivo</span>' : 'abrir'}</a></h3><div class="list" id="feed"></div></div>
    <div class="card"><h3>Próximos passos</h3><div class="list" id="tarefas"></div></div>
    <div class="card"><h3>Agenda <a class="small" href="#/agenda">abrir</a></h3><div class="list">
      ${eventos.length ? eventos.map(e => `<div class="list-item">${dayChip(e.data)}<div><div class="title">${esc(e.titulo)}</div><div class="meta">${esc(e.hora || '')} ${esc(e.local || '')} · ${relTime(e.data)} ${e.aConfirmar ? '<span class="badge warn">a confirmar</span>' : ''}</div></div></div>`).join('') : '<div class="empty">Sem eventos futuros.</div>'}
    </div></div>
  </div>
  ${!G.status().conectado ? `<div class="callout info">${icon('mail')} Conecte a conta Google do CIQUANTA em <a href="#/config">Configurações</a> para enviar campanhas, acompanhar respostas em tempo real e agendar reuniões no Google Agenda. Contatos com e-mail válido: ${comEmail}.</div>` : ''}`;

  const ufCount = {}; s.orgs.forEach(o => { if (o.uf) ufCount[o.uf] = (ufCount[o.uf] || 0) + 1; });
  view.querySelector('#map').appendChild(brMap(ufCount, { onClick: uf => location.hash = `#/organizacoes?uf=${uf}` }));

  const drawFeed = () => {
    const el = view.querySelector('#feed'); if (!el) return;
    const l = [...store.list('interacoes')].sort((a, b) => (b.data || '').localeCompare(a.data || '')).slice(0, 7);
    el.innerHTML = l.length ? l.map(i => { const o = store.get('orgs', i.orgId); return `<div class="list-item"><span class="badge ${i.tipo === 'recebido' ? 'ok' : i.tipo === 'reuniao' ? 'marinho' : 'gray'}">${esc(i.tipo === 'recebido' ? 'recebido' : i.tipo === 'email' ? 'enviado' : i.tipo)}</span><div style="min-width:0"><div class="title" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(i.titulo)}</div><div class="meta">${o ? `<a href="#/org/${esc(o.id)}">${esc(o.nomeFantasia || o.nome)}</a> · ` : ''}${fmtDateTime(i.data)}</div></div></div>`; }).join('') : '<div class="empty">Nenhuma interação registrada.</div>';
  };
  drawFeed();
  const off = store.onChange(w => { if (['interacoes', 'recebidos'].includes(w)) drawFeed(); });

  const tEl = view.querySelector('#tarefas');
  const drawTarefas = () => {
    const a = store.list('interacoes').filter(i => i.venc && !i.concluida).map(i => ({ id: i.id, t: i.titulo, d: i.venc, org: i.orgId, k: 'int' }));
    const b = store.list('oportunidades').filter(o => o.proximoEm && !['contratada', 'perdida'].includes(o.etapa)).map(o => ({ id: o.id, t: o.proximoPasso || o.titulo, d: o.proximoEm, org: o.orgId, k: 'opp' }));
    const l = [...a, ...b].sort((x, y) => x.d.localeCompare(y.d)).slice(0, 7);
    tEl.innerHTML = l.length ? l.map(t => { const o = store.get('orgs', t.org); return `<div class="list-item">${t.k === 'int' ? `<input type="checkbox" data-done="${esc(t.id)}" aria-label="Concluir">` : `<span class="badge">${icon('oportunidades', 12)}</span>`}
      <div style="flex:1"><div class="title">${esc(t.t)}</div><div class="meta">${o ? `<a href="#/org/${esc(o.id)}">${esc(o.nomeFantasia || o.nome)}</a> · ` : ''}<span style="color:${t.d < hoje ? 'var(--bad)' : 'inherit'}">${fmtDate(t.d)} (${relTime(t.d)})</span></div></div></div>`; }).join('')
      : '<div class="empty">Nenhum próximo passo pendente.</div>';
  };
  drawTarefas();
  tEl.addEventListener('change', e => { const id = e.target.dataset.done; if (id) { store.get('interacoes', id).concluida = true; store.touch('interacoes'); drawTarefas(); } });

  const draw = () => {
    charts.splice(0).forEach(c => c.destroy());
    const porSetor = {}; abertas.forEach(o => { const k = o.setor || 'sem-setor'; porSetor[k] = (porSetor[k] || 0) + store.pipelineValor(o); });
    const top = Object.entries(porSetor).sort((a, b) => b[1] - a[1]).slice(0, 10);
    charts.push(chart(view.querySelector('#c-setor'), {
      type: 'bar',
      data: { labels: top.length ? top.map(([k]) => k === 'sem-setor' ? 'Sem setor' : store.setorCurto(k)) : ['Sem oportunidades'], datasets: [{ data: top.length ? top.map(([, v]) => Math.round(v)) : [0], backgroundColor: '#3056D5', borderRadius: 6, barThickness: 22 }] },
      options: { indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => money(c.raw) } } }, scales: { x: { ticks: { callback: v => money(v) } } } },
    }));
    const byE = FUNIL.map(f => s.oportunidades.filter(o => (o.etapa || 'qualificacao') === f.id).length);
    charts.push(chart(view.querySelector('#c-funil'), {
      type: 'bar', data: { labels: FUNIL.map(f => f.nome.split(' ')[0]), datasets: [{ data: byE, backgroundColor: FUNIL.map(f => f.cor), borderRadius: 6 }] },
      options: { plugins: { legend: { display: false } }, onClick: () => location.hash = '#/oportunidades' },
    }));
    const byR = RELACIONAMENTO.map(r => s.orgs.filter(o => (o.relacionamento || 'mapeada') === r.id).length);
    charts.push(chart(view.querySelector('#c-rel'), {
      type: 'doughnut', data: { labels: RELACIONAMENTO.map(r => r.nome), datasets: [{ data: byR.some(Boolean) ? byR : [1], backgroundColor: byR.some(Boolean) ? RELACIONAMENTO.map(r => r.cor) : ['#DCE1EF'], borderWidth: 0 }] },
      options: { cutout: '62%', plugins: { legend: { position: 'bottom' } } },
    }));
    const mc = {}; s.oportunidades.forEach(o => { if (o.mecanismo) mc[o.mecanismo] = (mc[o.mecanismo] || 0) + (Number(o.valor) || 0); });
    const tm = Object.entries(mc).sort((a, b) => b[1] - a[1]).slice(0, 6);
    charts.push(chart(view.querySelector('#c-mec'), {
      type: 'bar', data: { labels: tm.length ? tm.map(([k]) => mecCurto(k)) : ['Sem dados'], datasets: [{ data: tm.length ? tm.map(([, v]) => v) : [0], backgroundColor: PALETTE[0], borderRadius: 6 }] },
      options: { indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => money(c.raw) } } }, scales: { x: { ticks: { callback: v => money(v) } } } },
    }));
  };
  draw();
  const onTheme = () => draw();
  window.addEventListener('themechange', onTheme);
  return () => { charts.forEach(c => c.destroy()); window.removeEventListener('themechange', onTheme); off(); };
}

function kpi(label, value, sub) {
  return `<div class="card kpi"><span class="label">${esc(label)}</span><span class="value">${value}</span><span class="sub">${sub}</span></div>`;
}
