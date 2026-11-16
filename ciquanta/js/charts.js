// Gráficos (Chart.js) com cores do CIQUANTA e suporte a tema claro/escuro
export const PALETTE = ['#3056D5', '#14224A', '#C8232C', '#7F97E8', '#12805C', '#9AA3C0', '#0B7A99', '#C9D3F3', '#5B6680', '#F0A3A7'];

function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }

export function chart(canvas, config) {
  if (!window.Chart) { canvas.parentElement.innerHTML = '<div class="empty">Gráficos indisponíveis (sem conexão com a biblioteca).</div>'; return { destroy() {} }; }
  const text = css('--text-2'), grid = css('--line');
  Chart.defaults.font.family = "Arial, 'Helvetica Neue', Helvetica, sans-serif";
  Chart.defaults.color = text;
  const base = {
    responsive: true, maintainAspectRatio: false,
    animation: matchMedia('(prefers-reduced-motion: reduce)').matches ? false : { duration: 900, easing: 'easeOutQuart', delay: c => c.type === 'data' && c.mode === 'default' ? c.dataIndex * 35 : 0 },
    plugins: { legend: { labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, color: text } }, tooltip: { backgroundColor: '#14224A', padding: 10, cornerRadius: 8 } },
  };
  const isCart = !['doughnut', 'pie', 'polarArea', 'radar'].includes(config.type);
  if (isCart) base.scales = {
    x: { grid: { color: grid, drawTicks: false }, border: { display: false }, ticks: { color: text } },
    y: { grid: { color: grid, drawTicks: false }, border: { display: false }, ticks: { color: text, precision: 0 }, beginAtZero: true },
  };
  const merged = { ...config, options: deepMerge(base, config.options || {}) };
  return new Chart(canvas, merged);
}

function deepMerge(a, b) {
  const o = { ...a };
  for (const [k, v] of Object.entries(b)) o[k] = v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' ? deepMerge(a[k], v) : v;
  return o;
}
