// Busca rápida (Ctrl K): páginas, organizações, contatos, oportunidades, setores e mecanismos
import * as store from './store.js';
import { esc, norm } from './util.js';

export function abrirPaleta(paginas, acoes = []) {
  if (document.querySelector('.paleta')) return;
  const ov = document.createElement('div'); ov.className = 'paleta';
  ov.innerHTML = '<div class="cx"><input type="text" placeholder="Buscar páginas, organizações, contatos, oportunidades, setores e leis" aria-label="Busca rápida"><div class="rs"></div><div class="hint">↑ ↓ para navegar · Enter para abrir · Esc para fechar</div></div>';
  document.body.appendChild(ov);
  const inp = ov.querySelector('input'), rs = ov.querySelector('.rs'); let res = [], sel = 0;
  const base = () => [
    ...paginas.map(p => ({ t: 'Página', n: p.titulo, h: `#/${p.id}` })),
    ...acoes.map(a => ({ t: 'Ação', n: a.n, f: a.f })),
    ...store.list('orgs').map(o => ({ t: 'Organização', n: o.nome, d: `${store.setorCurto(o.setor)}${o.uf ? ' · ' + o.uf : ''}`, h: `#/org/${o.id}` })),
    ...store.list('contatos').map(c => ({ t: 'Contato', n: c.nome, d: `${c.cargo || ''} ${store.orgOf(c)?.nome || ''}`, h: `#/org/${c.orgId}?aba=contatos` })),
    ...store.list('oportunidades').map(o => ({ t: 'Oportunidade', n: o.titulo, d: store.get('orgs', o.orgId)?.nome || '', h: `#/org/${o.orgId}?aba=oportunidades` })),
    ...store.setoresLista().map(s => ({ t: 'Setor', n: s.nome, h: `#/setores/${s.id}` })),
    ...store.list('editais').map(e => ({ t: 'Edital', n: e.titulo, d: e.orgao || '', h: '#/editais' })),
  ];
  const all = base();
  const draw = () => {
    const q = norm(inp.value);
    res = (q ? all.filter(x => norm(x.n + ' ' + (x.d || '')).includes(q)) : all.filter(x => x.t === 'Ação' || x.t === 'Página')).slice(0, 40);
    sel = Math.min(sel, Math.max(0, res.length - 1));
    rs.innerHTML = res.map((r, i) => `<div class="r ${i === sel ? 'sel' : ''}" data-i="${i}"><span class="badge ${r.t === 'Página' ? 'gray' : r.t === 'Ação' ? 'ok' : ''}" style="justify-content:center">${r.t}</span><span><b>${esc(r.n)}</b>${r.d ? `<small>${esc(r.d)}</small>` : ''}</span></div>`).join('') || '<div class="empty">Nada encontrado.</div>';
    rs.querySelector('.sel')?.scrollIntoView({ block: 'nearest' });
  };
  const close = () => ov.remove();
  const go = i => { const r = res[i]; if (!r) return; close(); if (r.f) r.f(); else location.hash = r.h; };
  inp.addEventListener('input', () => { sel = 0; draw(); });
  inp.addEventListener('keydown', e => {
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(res.length - 1, sel + 1); draw(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); }
    if (e.key === 'Enter') go(sel);
  });
  rs.addEventListener('click', e => { const r = e.target.closest('[data-i]'); if (r) go(+r.dataset.i); });
  ov.addEventListener('mousedown', e => { if (e.target === ov) close(); });
  draw(); inp.focus();
}
