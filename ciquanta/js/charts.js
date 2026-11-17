// Gráficos (Chart.js) com cores do CIQUANTA e suporte a tema claro/escuro
export const PALETTE = ['#2F55D4', '#101934', '#8EA0E6', '#2B7A57', '#C2C3BA', '#2C6C97', '#9C620F', '#4B5470', '#D6DCF4', '#B02F46'];

function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }

export function chart(canvas, config) {
  if (!window.Chart) { canvas.parentElement.innerHTML = '<div class="empty">Gráficos indisponíveis (sem conexão com a biblioteca).</div>'; return { destroy() {} }; }
  const text = css('--text-2'), grid = css('--line');
  Chart.defaults.font.family = "'Libre Franklin', 'Helvetica Neue', Arial, sans-serif"; Chart.defaults.font.size = 12;
  Chart.defaults.color = text;
  const base = {
    responsive: true, maintainAspectRatio: false,
    animation: matchMedia('(prefers-reduced-motion: reduce)').matches ? false : { duration: 900, easing: 'easeOutQuart', delay: c => c.type === 'data' && c.mode === 'default' ? c.dataIndex * 35 : 0 },
    plugins: { legend: { labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, color: text } }, tooltip: { backgroundColor: css('--tinta'), titleColor: css('--papel'), bodyColor: css('--papel'), padding: 10, cornerRadius: 6, displayColors: false } },
  };
  const isCart = !['doughnut', 'pie', 'polarArea', 'radar'].includes(config.type);
  if (isCart) base.scales = {
    x: { grid: { display: false }, border: { color: css('--line-strong') }, ticks: { color: text } },
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
