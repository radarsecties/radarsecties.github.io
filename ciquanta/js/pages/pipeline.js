import * as store from '../store.js';
import { esc, ESTAGIOS, money, options, SEGMENTOS, norm, debounce, estagioNome } from '../util.js';
import { segBadge } from '../components.js';

export async function render(view) {
  const f = { segmento: '', q: '' };
  view.innerHTML = `
  <div class="section-head"><div><h2>Funil de parcerias</h2><p>Arraste os cartões entre as colunas para atualizar o estágio. Cada mudança fica registrada no histórico da organização.</p></div></div>
  <div class="toolbar"><input type="search" class="grow" id="q" placeholder="Filtrar organizações…"><select id="seg">${options(SEGMENTOS, '', { empty: 'Todos os segmentos' })}</select></div>
  <div class="kanban" id="kb"></div>`;
  const kb = view.querySelector('#kb');
  const draw = () => {
    const q = norm(f.q);
    const orgs = store.list('orgs').filter(o => (!f.segmento || o.segmento === f.segmento) && (!q || norm(o.nome + ' ' + (o.setor || '')).includes(q)));
    const ct = {}; store.list('contatos').forEach(c => ct[c.orgId] = (ct[c.orgId] || 0) + 1);
    kb.innerHTML = ESTAGIOS.map(e => {
      const l = orgs.filter(o => (o.estagio || 'prospeccao') === e.id);
      const tot = l.reduce((a, o) => a + (Number(o.potencial) || 0), 0);
      return `<section class="kcol" data-est="${e.id}"><header><span><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${e.cor};margin-right:6px"></span>${esc(e.nome)}</span><span class="badge gray">${l.length}</span></header>
        ${tot ? `<div class="muted small" style="padding:6px 12px 0">${money(tot)}</div>` : ''}
        <div class="kbody">${l.slice(0, 150).map(o => `<article class="kcard" draggable="true" data-id="${esc(o.id)}">
          <div class="t">${esc(o.nomeFantasia || o.nome)}</div>
          <div class="s">${esc(o.setor || '')}${o.uf ? ' · ' + esc(o.uf) : ''}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">${segBadge(o.segmento)}<span class="s">${ct[o.id] || 0} contato(s)${o.potencial ? ' · ' + money(o.potencial) : ''}</span></div>
        </article>`).join('')}${l.length > 150 ? `<div class="muted small">+${l.length - 150} (use o filtro)</div>` : ''}</div></section>`;
    }).join('');
  };
  draw();
  let dragId = null;
  kb.addEventListener('dragstart', e => { const c = e.target.closest('.kcard'); if (c) { dragId = c.dataset.id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId); } });
  kb.addEventListener('dragover', e => { const col = e.target.closest('.kcol'); if (col) { e.preventDefault(); kb.querySelectorAll('.kcol').forEach(k => k.classList.toggle('drop', k === col)); } });
  kb.addEventListener('dragleave', e => { if (!kb.contains(e.relatedTarget)) kb.querySelectorAll('.kcol').forEach(k => k.classList.remove('drop')); });
  kb.addEventListener('drop', e => {
    e.preventDefault(); const col = e.target.closest('.kcol'); kb.querySelectorAll('.kcol').forEach(k => k.classList.remove('drop'));
    const o = store.get('orgs', dragId || e.dataTransfer.getData('text/plain'));
    if (o && col && o.estagio !== col.dataset.est) {
      o.estagio = col.dataset.est; store.touch('orgs');
      store.logInteracao({ orgId: o.id, tipo: 'nota', titulo: `Estágio alterado para ${estagioNome(o.estagio)}` });
      draw();
    }
    dragId = null;
  });
  kb.addEventListener('click', e => { const c = e.target.closest('.kcard'); if (c) location.hash = `#/org/${c.dataset.id}`; });
  view.querySelector('#q').addEventListener('input', debounce(e => { f.q = e.target.value; draw(); }));
  view.querySelector('#seg').onchange = e => { f.segmento = e.target.value; draw(); };
}
