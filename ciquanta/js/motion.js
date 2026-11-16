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
