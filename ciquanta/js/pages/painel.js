import * as store from '../store.js';
import { esc, num, money, pct, dayChip, relTime, ESTAGIOS, SEGMENTOS, isoDay, fmtDate, isEmail } from '../util.js';
import { chart, PALETTE } from '../charts.js';
import { brMap, openInteracaoForm } from '../components.js';
import { loadMecanismos, mecCurto } from '../email.js';
import { loadRadar } from './radar.js';

const ORBIT = `<svg class="orbit" viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="og" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22D3EE"/><stop offset="1" stop-color="#A855F7"/></linearGradient></defs>
<circle cx="60" cy="60" r="44" fill="none" stroke="url(#og)" stroke-width="2"/><ellipse cx="60" cy="60" rx="44" ry="16" fill="none" stroke="#6366F1" stroke-width="1.5" opacity=".8"><animateTransform attributeName="transform" type="rotate" from="0 60 60" to="360 60 60" dur="18s" repeatCount="indefinite"/></ellipse>
<ellipse cx="60" cy="60" rx="16" ry="44" fill="none" stroke="#22D3EE" stroke-width="1" opacity=".6"><animateTransform attributeName="transform" type="rotate" from="0 60 60" to="-360 60 60" dur="24s" repeatCount="indefinite"/></ellipse>
<line x1="60" y1="60" x2="88" y2="28" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><circle cx="88" cy="28" r="5" fill="#22D3EE"/><circle cx="60" cy="60" r="3.5" fill="#fff"/></svg>`;

export async function render(view) {
  const s = store.state();
  await loadMecanismos();
  const charts = [];
  const orgs = s.orgs, contatos = s.contatos, envios = s.envios;
  const enviados = envios.filter(e => e.status === 'enviado');
  const d30 = Date.now() - 30 * 864e5;
  const env30 = enviados.filter(e => new Date(e.data) >= d30).length;
  const resp = enviados.filter(e => e.respondido).length;
  const bySeg = Object.fromEntries(SEGMENTOS.map(x => [x, 0])); orgs.forEach(o => { const k = SEGMENTOS.includes(o.segmento) ? o.segmento : 'Outro'; bySeg[k]++; });
  const byEst = Object.fromEntries(ESTAGIOS.map(e => [e.id, 0])); orgs.forEach(o => { const k = o.estagio in byEst ? o.estagio : 'prospeccao'; byEst[k]++; });
  const ativos = ['reuniao', 'proposta', 'negociacao'];
  const potencial = orgs.filter(o => ativos.includes(o.estagio)).reduce((a, o) => a + (Number(o.potencial) || 0), 0);
  const parcerias = byEst.parceria || 0;
  const hoje = isoDay();
  const tarefas = s.interacoes.filter(i => i.venc && !i.concluida).sort((a, b) => a.venc.localeCompare(b.venc));
  const atrasadas = tarefas.filter(t => t.venc < hoje).length;
  const eventos = s.eventos.filter(e => e.data >= hoje).sort((a, b) => a.data.localeCompare(b.data)).slice(0, 6);
  const comEmail = contatos.filter(c => isEmail(c.email) && !c.optout).length;

  view.innerHTML = `
  <section class="hero">
    ${ORBIT}
    <h2>Central de Relações Institucionais</h2>
    <p>Empresas que investem em P&D, fomentadores e autoridades em um só lugar: mecanismos de incentivo, campanhas pelo Gmail, agenda setorial e o funil de parcerias do CIQuanta-PB.</p>
    <div class="hero-actions">
      ${orgs.length ? '' : '<a class="btn grad" href="#/busca?aba=referencia">Importar base de referência</a>'}
      <a class="btn" href="#/campanhas">Nova campanha</a>
      <a class="btn" href="#/busca">Busca ativa</a>
      <a class="btn" href="#/mecanismos">Mecanismos de fomento</a>
    </div>
  </section>

  <div class="grid g4" style="margin-bottom:16px">
    ${kpi('Organizações', num(orgs.length), `${bySeg.Empresa + bySeg.Startup} empresas · ${bySeg.Fomentador} fomentadores · ${bySeg.Autoridade} autoridades`)}
    ${kpi('Contatos acionáveis', num(comEmail), `${num(contatos.length)} contatos cadastrados`, pct(comEmail, contatos.length))}
    ${kpi('E-mails (30 dias)', num(env30), `${num(enviados.length)} no total · ${pct(resp, enviados.length)}% com resposta`, pct(resp, enviados.length))}
    ${kpi('Parcerias firmadas', num(parcerias), `${money(potencial)} em negociação`)}
  </div>

  <div class="grid g3" style="margin-bottom:16px">
    <div class="card span2"><h3>Funil de parcerias <a class="small" href="#/pipeline">abrir funil →</a></h3><div class="chart-box"><canvas id="c-funil"></canvas></div></div>
    <div class="card"><h3>Distribuição no Brasil <span class="muted">clique num estado</span></h3><div id="map"></div></div>
  </div>

  <div class="grid g3" style="margin-bottom:16px">
    <div class="card span2"><h3>Envios e respostas <span class="muted">últimas 12 semanas</span></h3><div class="chart-box"><canvas id="c-envios"></canvas></div></div>
    <div class="card"><h3>Perfil da carteira</h3><div class="chart-box"><canvas id="c-seg"></canvas></div></div>
  </div>

  <div class="grid g3" style="margin-bottom:16px">
    <div class="card"><h3>Mecanismos mais associados</h3><div class="chart-box tall"><canvas id="c-mec"></canvas></div></div>
    <div class="card"><h3>Follow-ups ${atrasadas ? `<span class="badge bad">${atrasadas} atrasado(s)</span>` : ''}</h3><div class="list" id="tarefas"></div></div>
    <div class="card"><h3>Próximas agendas <a class="small" href="#/agenda">agenda →</a></h3><div class="list">
      ${eventos.length ? eventos.map(e => `<div class="list-item">${dayChip(e.data)}<div><div class="title">${esc(e.titulo)}</div><div class="meta">${esc(e.local || '')} · ${relTime(e.data)} ${e.aConfirmar ? '<span class="badge warn">a confirmar</span>' : ''}</div></div></div>`).join('') : '<div class="empty">Sem eventos futuros.</div>'}
    </div></div>
  </div>

  <div class="card"><h3>Radar quântico <a class="small" href="#/radar">ver tudo →</a></h3><div id="radar-mini"><div class="empty">Carregando notícias…</div></div></div>`;

  // Mapa
  const ufCount = {}; orgs.forEach(o => { if (o.uf) ufCount[o.uf] = (ufCount[o.uf] || 0) + 1; });
  view.querySelector('#map').appendChild(brMap(ufCount, { onClick: uf => location.hash = `#/organizacoes?uf=${uf}` }));

  // Tarefas
  const tEl = view.querySelector('#tarefas');
  const drawTarefas = () => {
    const list = store.list('interacoes').filter(i => i.venc && !i.concluida).sort((a, b) => a.venc.localeCompare(b.venc)).slice(0, 7);
    tEl.innerHTML = list.length ? list.map(t => { const o = store.get('orgs', t.orgId); return `<div class="list-item">
      <input type="checkbox" data-done="${esc(t.id)}" aria-label="Concluir">
      <div style="flex:1"><div class="title">${esc(t.titulo)}</div><div class="meta">${o ? `<a href="#/org/${esc(o.id)}">${esc(o.nome)}</a> · ` : ''}<span style="color:${t.venc < hoje ? 'var(--bad)' : 'inherit'}">${fmtDate(t.venc)} (${relTime(t.venc)})</span></div></div></div>`; }).join('')
      : '<div class="empty">Nenhum follow-up pendente.<br><span class="small">Registre próximos passos nas organizações.</span></div>';
  };
  drawTarefas();
  tEl.addEventListener('change', e => { const id = e.target.dataset.done; if (id) { const i = store.get('interacoes', id); i.concluida = true; store.touch('interacoes'); drawTarefas(); } });

  const draw = () => {
    charts.splice(0).forEach(c => c.destroy());
    charts.push(chart(view.querySelector('#c-funil'), {
      type: 'bar',
      data: { labels: ESTAGIOS.map(e => e.nome), datasets: [{ data: ESTAGIOS.map(e => byEst[e.id]), backgroundColor: ESTAGIOS.map(e => e.cor), borderRadius: 6, barThickness: 22 }] },
      options: { indexAxis: 'y', plugins: { legend: { display: false } }, onClick: (_, el) => { if (el[0]) location.hash = `#/organizacoes?estagio=${ESTAGIOS[el[0].index].id}`; } },
    }));
    // semanas
    const weeks = []; const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - start.getDay() - 7 * 11);
    for (let i = 0; i < 12; i++) { const a = new Date(start.getTime() + i * 7 * 864e5); weeks.push(a); }
    const bucket = d => { const t = new Date(d).getTime(); for (let i = 11; i >= 0; i--) if (t >= weeks[i].getTime()) return i; return -1; };
    const sent = Array(12).fill(0), replied = Array(12).fill(0);
    enviados.forEach(e => { const b = bucket(e.data); if (b >= 0) { sent[b]++; if (e.respondido) replied[b]++; } });
    charts.push(chart(view.querySelector('#c-envios'), {
      type: 'line',
      data: { labels: weeks.map(w => w.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })), datasets: [
        { label: 'Enviados', data: sent, borderColor: PALETTE[0], backgroundColor: 'rgba(99,102,241,.15)', fill: true, tension: .3, cubicInterpolationMode: 'monotone', pointRadius: 3 },
        { label: 'Respondidos', data: replied, borderColor: PALETTE[1], backgroundColor: 'rgba(34,211,238,.1)', fill: true, tension: .3, cubicInterpolationMode: 'monotone', pointRadius: 3 },
      ] },
    }));
    const segs = SEGMENTOS.filter(x => bySeg[x]);
    charts.push(chart(view.querySelector('#c-seg'), {
      type: 'doughnut',
      data: { labels: segs.length ? segs : ['Sem dados'], datasets: [{ data: segs.length ? segs.map(x => bySeg[x]) : [1], backgroundColor: segs.length ? PALETTE : ['#CBD5E1'], borderWidth: 0 }] },
      options: { cutout: '62%', plugins: { legend: { position: 'bottom' } } },
    }));
    const mc = {}; orgs.forEach(o => (o.mecanismos || []).forEach(m => mc[m] = (mc[m] || 0) + 1));
    const top = Object.entries(mc).sort((a, b) => b[1] - a[1]).slice(0, 8);
    charts.push(chart(view.querySelector('#c-mec'), {
      type: 'bar',
      data: { labels: top.map(([k]) => mecCurto(k)), datasets: [{ data: top.map(([, v]) => v), backgroundColor: PALETTE[2], borderRadius: 6 }] },
      options: { indexAxis: 'y', plugins: { legend: { display: false } } },
    }));
  };
  draw();
  const onTheme = () => draw();
  window.addEventListener('themechange', onTheme);

  loadRadar().then(items => {
    const el = view.querySelector('#radar-mini'); if (!el) return;
    el.innerHTML = items.slice(0, 5).map(n => `<div class="list-item"><div style="flex:1"><a href="${esc(n.url)}" target="_blank" rel="noopener" class="title" style="color:var(--text);text-decoration:none">${esc(n.titulo)}</a><div class="meta">${esc(n.fonte)} · ${fmtDate(n.dataPub)}</div></div></div>`).join('') || '<div class="empty">Sem notícias.</div>';
  }).catch(() => { const el = view.querySelector('#radar-mini'); if (el) el.innerHTML = '<div class="empty">Radar indisponível.</div>'; });

  return () => { charts.forEach(c => c.destroy()); window.removeEventListener('themechange', onTheme); };
}

function kpi(label, value, sub, bar) {
  return `<div class="card kpi"><span class="label">${esc(label)}</span><span class="value">${value}</span><span class="sub">${sub}</span>${bar !== undefined ? `<div class="bar"><span style="width:${Math.min(100, bar)}%"></span></div>` : ''}</div>`;
}
