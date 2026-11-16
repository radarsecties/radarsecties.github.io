// Radar quântico: notícias de computação e tecnologias quânticas coletadas pelo Radar SECTIES
import { esc, fmtDate, norm, debounce, safeUrl } from '../util.js';

let cache = null;
export function loadRadar() {
  if (!cache) cache = fetch('../data/noticias.json', { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error('Radar indisponível'); return r.json(); }).then(d => {
    const itens = Object.values(d.itens || d);
    return itens.filter(n => (n.programas || []).includes('ciquanta') || /quantum|quântic|qubit/i.test(n.titulo || ''))
      .sort((a, b) => (b.dataPub || '').localeCompare(a.dataPub || ''));
  });
  cache.catch(() => { cache = null; });
  return cache;
}

export async function render(view) {
  view.innerHTML = `<div class="section-head"><div><h2>Radar quântico</h2><p>Notícias sobre computação e tecnologias quânticas no Brasil e no mundo, coletadas diariamente pelo <a href="../">Radar SECTIES</a>. Use para pautar contatos, boletins e argumentos de prospecção.</p></div></div>
  <div class="toolbar"><input type="search" class="grow" id="q" placeholder="Filtrar por empresa, tema, país…"><select id="fonte"><option value="">Todas as fontes</option></select><select id="escopo"><option value="">Todos os escopos</option></select></div>
  <div class="card" id="list"><div class="empty">Carregando…</div></div>`;
  let items;
  try { items = await loadRadar(); } catch (e) { view.querySelector('#list').innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
  const fontes = [...new Set(items.map(i => i.fonte).filter(Boolean))].sort();
  const escopos = [...new Set(items.map(i => i.escopo).filter(Boolean))].sort();
  view.querySelector('#fonte').insertAdjacentHTML('beforeend', fontes.map(f => `<option>${esc(f)}</option>`).join(''));
  view.querySelector('#escopo').insertAdjacentHTML('beforeend', escopos.map(f => `<option>${esc(f)}</option>`).join(''));
  const draw = () => {
    const q = norm(view.querySelector('#q').value), f = view.querySelector('#fonte').value, sc = view.querySelector('#escopo').value;
    const list = items.filter(n => (!f || n.fonte === f) && (!sc || n.escopo === sc) && (!q || norm(n.titulo + ' ' + n.resumo).includes(q))).slice(0, 120);
    view.querySelector('#list').innerHTML = `<div class="muted small" style="margin-bottom:6px">${list.length} de ${items.length} notícias</div>` + (list.map(n => {
      const img = safeUrl(n.imagem);
      return `<article class="news">${img ? `<img src="${esc(img)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : '<div></div>'}
      <div><a href="${esc(safeUrl(n.url))}" target="_blank" rel="noopener">${esc(n.titulo)}</a>
      <div class="muted small">${esc(n.fonte)} · ${fmtDate(n.dataPub)} ${n.escopo ? `· ${esc(n.escopo)}` : ''}</div>
      <div class="small" style="color:var(--text-2);margin-top:4px">${esc(n.resumo || '')}</div></div></article>`;
    }).join('') || '<div class="empty">Nada encontrado.</div>');
  };
  draw();
  view.querySelector('#q').addEventListener('input', debounce(draw));
  view.querySelector('#fonte').onchange = draw;
  view.querySelector('#escopo').onchange = draw;
}
