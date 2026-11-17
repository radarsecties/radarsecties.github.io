import * as store from '../store.js';
import { esc, norm, debounce, options, fmtDate } from '../util.js';

export async function render(view) {
  const ref = await store.ref('mecanismos');
  const tipos = [...new Set(ref.itens.map(m => m.tipo))].sort();
  const f = { q: '', tipo: '', prio: '' };
  view.innerHTML = `<div class="section-head"><div><h2>Mecanismos e leis de inovação</h2></div></div>
    
    <div class="grid g4" style="margin-bottom:16px" id="kpis"></div>
    <div class="toolbar"><input type="search" class="grow" id="q" placeholder="Lei, setor ou órgão"><select id="tipo">${options(tipos, '', { empty: 'Todos os tipos' })}</select>
      <select id="prio"><option value="">Todas as prioridades</option><option value="1">Prioridade alta</option><option value="2">Média</option><option value="3">Complementar</option></select></div>
    <div class="grid g2" id="list"></div>`;
  const orgs = store.list('orgs');
  const count = id => orgs.filter(o => (o.mecanismos || []).includes(id)).length;
  const k = (l, v, s) => `<div class="card kpi"><span class="label">${l}</span><span class="value">${v}</span><span class="sub">${s}</span></div>`;
  view.querySelector('#kpis').innerHTML = k('Mecanismos mapeados', ref.itens.length, 'leis, programas e fundos') + k('Prioridade alta', ref.itens.filter(m => m.prioridade === 1).length, 'maior volume ou aderência') +
    k('Obrigações de PD&I', ref.itens.filter(m => /Obrigação/.test(m.tipo)).length, 'recurso garantido todo ano') + k('Organizações associadas', orgs.filter(o => (o.mecanismos || []).length).length, 'no seu CRM');
  const PR = { 1: ['alta', 'ok'], 2: ['média', 'info'], 3: ['complementar', 'gray'] };
  const draw = () => {
    const q = norm(f.q);
    const l = ref.itens.filter(m => (!f.tipo || m.tipo === f.tipo) && (!f.prio || String(m.prioridade) === f.prio) && (!q || norm(Object.values(m).join(' ')).includes(q)))
      .sort((a, b) => a.prioridade - b.prioridade);
    view.querySelector('#list').innerHTML = l.map(m => `<article class="card mec" id="m-${esc(m.id)}">
      <header><div><h4>${esc(m.nome)}</h4><div class="muted small">${esc(m.baseLegal)}</div></div>
      <div class="tags" style="justify-content:flex-end"><span class="badge ${PR[m.prioridade][1]}">prioridade ${PR[m.prioridade][0]}</span><span class="badge gray">${esc(m.status)}</span></div></header>
      <div class="tags"><span class="badge">${esc(m.tipo)}</span><span class="badge gray">Gestor: ${esc(m.gestor)}</span></div>
      <dl><dt>Quem usa</dt><dd>${esc(m.quemUsa)}</dd><dt>Benefício</dt><dd>${esc(m.beneficio)}</dd><dt>Contrapartida / obrigação</dt><dd>${esc(m.contrapartida)}</dd></dl>
      <div class="fit"><strong>Papel do CIQUANTA:</strong> ${esc(m.encaixeCiquanta)}</div>
      <div class="small"><strong>Argumento de abordagem:</strong> ${esc(m.argumento)}</div>
      <div class="toolbar" style="margin:4px 0 0"><a class="btn sm" href="${esc(m.link)}" target="_blank" rel="noopener">Fonte oficial</a>
      <a class="btn sm" href="#/organizacoes?mecanismo=${esc(m.id)}">${count(m.id)} organização(ões) no CRM</a>
      ${['lei-do-bem', 'lei-de-tics', 'pdi-aneel', 'pdi-anp'].includes(m.id) ? `<a class="btn sm" href="#/simulador?m=${esc(m.id)}">Simular</a>` : ''}</div></article>`).join('') || '<div class="empty">Nada encontrado.</div>';
  };
  draw();
  view.querySelector('#q').addEventListener('input', debounce(e => { f.q = e.target.value; draw(); }));
  view.querySelector('#tipo').onchange = e => { f.tipo = e.target.value; draw(); };
  view.querySelector('#prio').onchange = e => { f.prio = e.target.value; draw(); };
}
