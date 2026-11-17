// Movimento da interface: contagens animadas, entrada escalonada, barras que crescem e transição entre telas.
// Tudo respeita a preferência do sistema por menos movimento.

export const reduzMovimento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const easeOut = t => 1 - (1 - t) ** 4;

/**
 * Anima de 0 até o valor final os elementos com `data-contar` (número) dentro de `raiz`.
 * O texto final já está no HTML, então leitores de tela e impressão veem o valor certo.
 */
export function animarNumeros(raiz = document) {
  if (reduzMovimento()) return;
  raiz.querySelectorAll('[data-contar]').forEach(el => {
    if (el.dataset.animado) return; el.dataset.animado = '1';
    const fim = Number(el.dataset.contar); if (!isFinite(fim) || fim <= 0) return;
    const final = el.textContent, fmt = el.dataset.formato;
    const formatar = v => fmt === 'moeda' ? compactoBR(v) : Math.round(v).toLocaleString('pt-BR') + (el.dataset.sufixo || '');
    const dur = Math.min(1400, 500 + Math.log10(fim + 1) * 250), t0 = performance.now();
    const passo = t => {
      const p = Math.min(1, (t - t0) / dur);
      el.textContent = p < 1 ? formatar(fim * easeOut(p)) : final;
      if (p < 1) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  });
}
export const compactoBR = v => v >= 1e9 ? `R$ ${(v / 1e9).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} bi` : v >= 1e6 ? `R$ ${(v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi` : v >= 1e3 ? `R$ ${Math.round(v / 1e3)} mil` : `R$ ${Math.round(v)}`;

/** Troca o conteúdo da tela com a transição nativa do navegador, quando disponível. */
export function transicao(fn) {
  if (reduzMovimento() || !document.startViewTransition) return fn();
  return document.startViewTransition(fn).updateCallbackDone;
}

/** Marca blocos que entram na tela conforme a rolagem (classe `.visivel`). */
let obs;
export function revelar(raiz = document) {
  const alvos = raiz.querySelectorAll('.revelar:not(.visivel)');
  if (reduzMovimento() || !('IntersectionObserver' in window)) { alvos.forEach(e => e.classList.add('visivel')); return; }
  obs ||= new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visivel'); obs.unobserve(e.target); } }), { rootMargin: '0px 0px -40px 0px' });
  alvos.forEach(e => obs.observe(e));
}

/**
 * Campo quântico da barra lateral: pontos que derivam devagar e se ligam quando se aproximam,
 * com alguns "qubits" pulsando. Fica parado quando o sistema pede menos movimento ou a aba está oculta.
 */
export function campo(cv) {
  if (!cv) return;
  const ctx = cv.getContext('2d'); let w = 0, h = 0, dpr = 1, pts = [], raf = 0, ult = 0;
  const medir = () => {
    dpr = Math.min(2, window.devicePixelRatio || 1); w = cv.clientWidth; h = cv.clientHeight;
    cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round((w * h) / 9000);
    pts = Array.from({ length: n }, (_, i) => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - .5) * .12, vy: (Math.random() - .5) * .12, q: i % 9 === 0, f: Math.random() * 6.28 }));
  };
  const desenhar = t => {
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const a = pts[i], b = pts[j], dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
      if (d2 < 9000) { ctx.strokeStyle = `rgba(143,165,236,${(1 - d2 / 9000) * .16})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    }
    for (const p of pts) {
      if (p.q) {
        const r = 2.2 + Math.sin(t / 900 + p.f) * .8;
        ctx.fillStyle = 'rgba(91,124,250,.12)'; ctx.beginPath(); ctx.arc(p.x, p.y, r * 3, 0, 6.29); ctx.fill();
        ctx.fillStyle = 'rgba(159,180,255,.9)'; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.29); ctx.fill();
      } else { ctx.fillStyle = 'rgba(200,212,255,.35)'; ctx.beginPath(); ctx.arc(p.x, p.y, 1.1, 0, 6.29); ctx.fill(); }
    }
  };
  const passo = t => {
    raf = requestAnimationFrame(passo);
    if (t - ult < 33) return; ult = t; // cerca de 30 quadros por segundo bastam
    for (const p of pts) { p.x += p.vx; p.y += p.vy; if (p.x < -10) p.x = w + 10; if (p.x > w + 10) p.x = -10; if (p.y < -10) p.y = h + 10; if (p.y > h + 10) p.y = -10; }
    desenhar(t);
  };
  const iniciar = () => { cancelAnimationFrame(raf); if (reduzMovimento() || document.hidden) { desenhar(0); return; } raf = requestAnimationFrame(passo); };
  medir(); iniciar();
  new ResizeObserver(() => { medir(); desenhar(0); }).observe(cv);
  document.addEventListener('visibilitychange', iniciar);
}

/** Desenho de órbitas para o topo da tela Hoje: anéis girando em velocidades diferentes, como um qubit em superposição. */
export function orbitaSVG() {
  return `<svg class="orbita" viewBox="0 0 420 420" aria-hidden="true">
    <defs><radialGradient id="ob-n" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#9FB4FF" stop-opacity=".9"/><stop offset=".45" stop-color="#5B7CFA" stop-opacity=".35"/><stop offset="1" stop-color="#5B7CFA" stop-opacity="0"/></radialGradient>
    <linearGradient id="ob-a" x1="0" x2="1"><stop offset="0" stop-color="#8FA5EC" stop-opacity="0"/><stop offset=".5" stop-color="#8FA5EC" stop-opacity=".7"/><stop offset="1" stop-color="#2BB6D9" stop-opacity=".9"/></linearGradient></defs>
    <circle cx="210" cy="210" r="70" fill="url(#ob-n)"/>
    <g class="anel" style="--t:38s"><ellipse cx="210" cy="210" rx="190" ry="72" fill="none" stroke="url(#ob-a)" stroke-width="1.2"/><circle cx="400" cy="210" r="4.5" fill="#2BB6D9"/></g>
    <g class="anel r" style="--t:52s"><ellipse cx="210" cy="210" rx="72" ry="190" fill="none" stroke="rgba(143,165,236,.45)" stroke-width="1"/><circle cx="210" cy="20" r="3.5" fill="#9FB4FF"/></g>
    <g class="anel" style="--t:70s"><ellipse cx="210" cy="210" rx="160" ry="160" fill="none" stroke="rgba(143,165,236,.25)" stroke-dasharray="2 8"/><circle cx="370" cy="210" r="3" fill="#fff"/></g>
    <g class="anel r" style="--t:26s"><ellipse cx="210" cy="210" rx="120" ry="44" transform="rotate(35 210 210)" fill="none" stroke="rgba(43,182,217,.55)" stroke-width="1"/><circle cx="310" cy="280" r="3" fill="#2BB6D9"/></g>
    <circle cx="210" cy="210" r="9" fill="#fff"/><circle cx="210" cy="210" r="16" fill="none" stroke="rgba(255,255,255,.4)"/>
  </svg>`;
}
