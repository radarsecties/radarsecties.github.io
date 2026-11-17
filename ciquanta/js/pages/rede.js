// Rede de relacionamento: grafo interativo de setores, organizações e mecanismos
import * as store from '../store.js';
import { esc, RELACIONAMENTO, options } from '../util.js';
import { pontuar, contexto } from '../score.js';
import { loadMecanismos, mecCurto } from '../email.js';

export async function render(view) {
  await loadMecanismos();
  const f = { modo: 'setor', filtro: 'relevantes', setor: '' };
  view.innerHTML = `<div class="section-head"><div><h2>Rede de relacionamento</h2></div></div>
    <div class="toolbar"><select id="modo"><option value="setor">Agrupar por setor</option><option value="mecanismo">Agrupar por mecanismo de fomento</option></select>
      <select id="filtro"><option value="relevantes">Potencial alto ou já em contato</option><option value="contato">Com contato cadastrado</option><option value="ativas">Em contato, engajadas e parceiras</option><option value="todas">Todas</option></select>
      <select id="setor">${options(store.setoresLista().map(s => ({ id: s.id, nome: s.nome })), '', { empty: 'Todos os setores' })}</select>
      <span class="tags" style="margin-left:auto">${RELACIONAMENTO.map(r => `<span class="marca" style="--c:${r.cor}"><i></i>${r.nome}</span>`).join('')}</span></div>
    <div class="card" style="padding:0;overflow:hidden;position:relative"><canvas id="cv" style="display:block;width:100%;height:640px;cursor:grab"></canvas><div id="tip" class="toast" style="position:absolute;display:none;pointer-events:none;max-width:300px"></div><div id="vazio" class="empty" style="position:absolute;inset:0;display:none;place-items:center"></div></div>
    <p class="muted small" id="leg"></p>`;
  const cv = view.querySelector('#cv'), ctx = cv.getContext('2d'), tip = view.querySelector('#tip');
  let nodes = [], edges = [], cam = { x: 0, y: 0, k: 1 }, hover = null, raf = 0, ticks = 0;
  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

  const montar = () => {
    const c = contexto();
    let orgs = store.list('orgs').filter(o => !f.setor || o.setor === f.setor).map(o => ({ o, p: pontuar(o, c).total }));
    if (f.filtro === 'relevantes') orgs = orgs.filter(x => x.p >= 50 || (x.o.relacionamento && x.o.relacionamento !== 'mapeada'));
    if (f.filtro === 'contato') orgs = orgs.filter(x => c.comEmail.has(x.o.id));
    if (f.filtro === 'ativas') orgs = orgs.filter(x => ['contato', 'engajada', 'parceira'].includes(x.o.relacionamento));
    orgs = orgs.sort((a, b) => b.p - a.p).slice(0, 320);
    const hubs = new Map(); nodes = []; edges = [];
    const hub = (id, nome) => { if (!hubs.has(id)) { const h = { id: 'h:' + id, hub: true, nome, r: 16, n: 0, x: 0, y: 0, vx: 0, vy: 0 }; hubs.set(id, h); nodes.push(h); } return hubs.get(id); };
    for (const { o, p } of orgs) {
      const cor = (RELACIONAMENTO.find(r => r.id === (o.relacionamento || 'mapeada')) || RELACIONAMENTO[0]).cor;
      const n = { id: o.id, nome: o.nomeFantasia || o.nome, p, cor, r: 3.5 + p / 12, org: o, x: 0, y: 0, vx: 0, vy: 0 }; nodes.push(n);
      const ks = f.modo === 'setor' ? [[o.setor || 'sem', o.setor ? store.setorCurto(o.setor) : 'Sem setor']] : (o.mecanismos || []).slice(0, 3).map(m => [m, mecCurto(m)]);
      ks.forEach(([k, nome]) => { const h = hub(k, nome); h.n++; edges.push([n, h]); });
    }
    const H = [...hubs.values()];
    H.forEach((h, i) => { const a = 2 * Math.PI * i / H.length, R = 120 + 26 * H.length; h.x = Math.cos(a) * R; h.y = Math.sin(a) * R; h.r = 12 + Math.min(16, h.n / 3); });
    nodes.filter(n => !n.hub).forEach(n => { const hs = edges.filter(e => e[0] === n).map(e => e[1]); const a = Math.random() * 6.28, d = 30 + Math.random() * 70; n.x = (hs[0]?.x || 0) + Math.cos(a) * d; n.y = (hs[0]?.y || 0) + Math.sin(a) * d; });
    view.querySelector('#leg').textContent = `${orgs.length} organizações e ${H.length} ${f.modo === 'setor' ? 'setores' : 'mecanismos'}.`;
    const vz = view.querySelector('#vazio'); vz.style.display = orgs.length ? 'none' : 'grid'; vz.innerHTML = orgs.length ? '' : 'Nenhuma organização neste recorte. <a href="#/busca?aba=referencia" style="margin-left:6px">Importe o mapeamento setorial</a>';
    ticks = 0; cam = { x: 0, y: 0, k: Math.min(1, 620 / (2 * (160 + 26 * H.length) + 200)) };
    cancelAnimationFrame(raf); loop();
  };

  const passo = () => {
    const al = Math.max(0.02, 1 - ticks / 260);
    for (let i = 0; i < nodes.length; i++) { const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) { const b = nodes[j]; let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy || 0.01; const min = a.r + b.r + (a.hub || b.hub ? 26 : 5);
        if (d2 < min * min * 9) { const d = Math.sqrt(d2), fo = (a.hub && b.hub ? 900 : 60) / d2 * al + (d < min ? (min - d) * 0.08 : 0); dx /= d; dy /= d; a.vx += dx * fo; a.vy += dy * fo; b.vx -= dx * fo; b.vy -= dy * fo; } } }
    for (const [n, h] of edges) { const dx = h.x - n.x, dy = h.y - n.y, d = Math.hypot(dx, dy) || 1, alvo = h.r + 34 + n.r; const fo = (d - alvo) * 0.012 * al; n.vx += dx / d * fo; n.vy += dy / d * fo; h.vx -= dx / d * fo * 0.04; h.vy -= dy / d * fo * 0.04; }
    for (const n of nodes) { n.vx -= n.x * 0.0006 * al; n.vy -= n.y * 0.0006 * al; n.x += n.vx; n.y += n.vy; n.vx *= 0.82; n.vy *= 0.82; }
  };
  const desenhar = () => {
    const dpr = devicePixelRatio || 1, W = cv.clientWidth, Hh = cv.clientHeight;
    if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = Hh * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, Hh);
    ctx.translate(W / 2 + cam.x, Hh / 2 + cam.y); ctx.scale(cam.k, cam.k);
    ctx.strokeStyle = css('--line'); ctx.lineWidth = 1 / cam.k; ctx.beginPath();
    for (const [a, b] of edges) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); } ctx.stroke();
    for (const n of nodes) { if (n.hub) continue; ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, 6.3); ctx.fillStyle = n.cor; ctx.globalAlpha = hover && hover !== n ? 0.55 : 1; ctx.fill(); if (n === hover) { ctx.lineWidth = 2 / cam.k; ctx.strokeStyle = css('--text'); ctx.stroke(); } }
    ctx.globalAlpha = 1; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const n of nodes) { if (!n.hub) continue; ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, 6.3); ctx.fillStyle = css('--surface'); ctx.fill(); ctx.lineWidth = 2 / cam.k; ctx.strokeStyle = css('--primary'); ctx.stroke();
      ctx.fillStyle = css('--text'); ctx.font = `700 ${12 / Math.min(1, cam.k)}px Arial`; ctx.fillText(n.nome, n.x, n.y + n.r + 12 / Math.min(1, cam.k)); ctx.fillStyle = css('--primary'); ctx.font = `700 ${11}px Arial`; ctx.fillText(n.n, n.x, n.y); }
    if (cam.k > 1.5) { ctx.fillStyle = css('--text-2'); ctx.font = '10px Arial'; for (const n of nodes) if (!n.hub && n.p >= 45) ctx.fillText(n.nome.slice(0, 22), n.x, n.y + n.r + 7); }
  };
  const loop = () => { if (ticks < 320) { passo(); passo(); ticks += 2; } desenhar(); if (ticks < 320) raf = requestAnimationFrame(loop); };
  const pos = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left - r.width / 2 - cam.x) / cam.k, y: (e.clientY - r.top - r.height / 2 - cam.y) / cam.k, sx: e.clientX - r.left, sy: e.clientY - r.top }; };
  const achar = p => nodes.filter(n => !n.hub).find(n => Math.hypot(n.x - p.x, n.y - p.y) <= n.r + 3 / cam.k);
  let drag = null, moved = false;
  cv.onpointerdown = e => { drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y }; moved = false; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; };
  cv.onpointermove = e => {
    if (drag) { cam.x = drag.cx + e.clientX - drag.x; cam.y = drag.cy + e.clientY - drag.y; if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 4) moved = true; desenhar(); return; }
    const p = pos(e), n = achar(p);
    if (n !== hover) { hover = n; cv.style.cursor = n ? 'pointer' : 'grab'; desenhar(); }
    if (n) { tip.style.display = 'block'; tip.style.left = Math.min(p.sx + 14, cv.clientWidth - 310) + 'px'; tip.style.top = p.sy + 14 + 'px'; tip.innerHTML = `<b>${esc(n.org.nome)}</b><br>${esc(store.setorNome(n.org.setor))} · potencial ${n.p}<br>${esc((RELACIONAMENTO.find(r => r.id === (n.org.relacionamento || 'mapeada')) || {}).nome || '')}`; } else tip.style.display = 'none';
  };
  cv.onpointerup = e => { cv.style.cursor = 'grab'; if (!moved) { const n = achar(pos(e)); if (n) location.hash = `#/org/${n.id}`; } drag = null; };
  cv.onpointerleave = () => { tip.style.display = 'none'; };
  cv.addEventListener('wheel', e => { e.preventDefault(); const k = Math.min(4, Math.max(0.25, cam.k * (e.deltaY < 0 ? 1.12 : 0.89))); cam.k = k; desenhar(); }, { passive: false });
  ['modo', 'filtro', 'setor'].forEach(k => view.querySelector('#' + k).onchange = e => { f[k] = e.target.value; montar(); });
  const onR = () => desenhar(); window.addEventListener('resize', onR); window.addEventListener('themechange', onR);
  montar();
  return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onR); window.removeEventListener('themechange', onR); };
}
