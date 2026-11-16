// Gráficos (Chart.js) com cores do CIQuanta e suporte a tema claro/escuro
export const PALETTE = ['#6366F1', '#22D3EE', '#A855F7', '#10B981', '#F59E0B', '#F43F5E', '#0EA5E9', '#64748B', '#84CC16', '#EC4899'];

function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }

export function chart(canvas, config) {
  if (!window.Chart) { canvas.parentElement.innerHTML = '<div class="empty">Gráficos indisponíveis (sem conexão com a biblioteca).</div>'; return { destroy() {} }; }
  const text = css('--text-2'), grid = css('--line');
  Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
  Chart.defaults.color = text;
  const base = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, color: text } }, tooltip: { backgroundColor: '#0B1033', padding: 10, cornerRadius: 8 } },
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
