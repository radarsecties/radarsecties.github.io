import { money } from '../util.js';
import { chart } from '../charts.js';

const SIMS = {
  'lei-do-bem': 'Lei do Bem',
  'lei-de-tics': 'Lei de TICs',
  'pdi-aneel': 'PD&I ANEEL',
  'pdi-anp': 'PD&I ANP',
};

export async function render(view, { params }) {
  let cur = SIMS[params.get('m')] ? params.get('m') : 'lei-do-bem';
  let ch = null;
  view.innerHTML = `<div class="section-head"><div><h2>Simulador de incentivos</h2><p>Estimativas rápidas para usar em reuniões com empresas: quanto custa, de fato, um projeto de PD&I com o CIQUANTA e quanto recurso obrigatório de P&D a empresa precisa aplicar.</p></div></div>
    <div class="callout warn" style="margin-bottom:14px">Valores aproximados, apenas para conversa inicial. A apuração real depende do regime tributário, do enquadramento do projeto e da regulamentação vigente: a empresa deve validar com a área tributária.</div>
    <div class="tabs">${Object.entries(SIMS).map(([k, l]) => `<button data-s="${k}" class="${k === cur ? 'active' : ''}">${l}</button>`).join('')}</div>
    <div class="grid g2"><div class="card" id="form"></div><div class="card"><h3>Resultado</h3><div id="out"></div><div class="chart-box" style="height:220px;margin-top:12px"><canvas id="c"></canvas></div></div></div>`;
  const F = view.querySelector('#form'), O = view.querySelector('#out');
  const num = id => Number(F.querySelector('#' + id)?.value) || 0;
  const field = (id, label, val, extra = '') => `<label class="field">${label}<input type="number" id="${id}" value="${val}" min="0" ${extra}></label>`;
  const row = (l, v, strong) => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line)"><span>${l}</span>${strong ? `<strong style="font-size:18px">${v}</strong>` : `<span>${v}</span>`}</div>`;

  const forms = {
    'lei-do-bem': () => `<h3>Lei do Bem (Lei 11.196/2005)</h3><div class="form-grid">
      ${field('d', 'Dispêndio em P&D interno no ano (R$)', 2000000, 'step="10000"')}
      <label class="field">Aumento do nº de pesquisadores<select id="inc"><option value="0.6">Sem aumento (exclusão de 60%)</option><option value="0.7">Aumento de até 5% (70%)</option><option value="0.8">Aumento acima de 5% (80%)</option></select></label>
      ${field('pat', 'Parte com patente concedida (R$)', 0, 'step="10000"')}
      ${field('ict', 'Projeto executado pelo CIQUANTA/ICT, art. 19-A (R$)', 1000000, 'step="10000"')}
      <label class="field">Fator do art. 19-A (definido pelo comitê)<select id="fat"><option value="0.5">50%</option><option value="1">100%</option><option value="1.5">150%</option><option value="2">200%</option><option value="2.5" selected>250% (máximo)</option></select></label>
      ${field('lucro', 'Lucro real antes das exclusões (R$)', 20000000, 'step="100000"')}
      ${field('aliq', 'Alíquota IRPJ + CSLL (%)', 34, 'step="1" max="40"')}</div>
      <p class="muted small">Exclusões não podem gerar prejuízo fiscal. O art. 19-A não se acumula com o art. 19 para o mesmo dispêndio.</p>`,
    'lei-de-tics': () => `<h3>Lei de TICs (Lei 8.248/1991)</h3><div class="form-grid">
      ${field('fat', 'Faturamento anual com bens incentivados (R$)', 500000000, 'step="1000000"')}
      ${field('perc', 'Percentual de PD&I exigido (%)', 4, 'step="0.1"')}
      ${field('ext', 'Parcela a aplicar fora da empresa (ICTs, PPIs, FNDCT) (%)', 50, 'step="1" max="100"')}
      ${field('reg', 'Parcela destinada a N/NE/CO (%)', 30, 'step="1" max="100"')}
      ${field('share', 'Fatia que o CIQUANTA pode captar (%)', 10, 'step="1" max="100"')}</div>
      <p class="muted small">As proporções exatas estão no Decreto 10.356/2020 e variam por produto e região. Ajuste os campos ao caso real.</p>`,
    'pdi-aneel': () => `<h3>PD&I ANEEL (Lei 9.991/2000)</h3><div class="form-grid">
      ${field('rol', 'Receita operacional líquida da concessionária (R$)', 3000000000, 'step="10000000"')}
      ${field('perc', 'Percentual aplicado em projetos de PD&I regulados (%)', 0.4, 'step="0.05"')}
      ${field('share', 'Fatia que o CIQUANTA pode captar (%)', 5, 'step="1" max="100"')}</div>
      <p class="muted small">Confira o percentual e a divisão entre FNDCT, MME e projetos próprios no regulamento vigente da ANEEL (PROPDI).</p>`,
    'pdi-anp': () => `<h3>Cláusula de PD&I ANP</h3><div class="form-grid">
      ${field('rb', 'Receita bruta dos campos com obrigação (R$)', 20000000000, 'step="100000000"')}
      <label class="field">Regime<select id="perc"><option value="1">Concessão (1%)</option><option value="0.5">Partilha / cessão onerosa (0,5%)</option></select></label>
      ${field('ict', 'Parcela mínima em ICTs credenciadas (%)', 50, 'step="1" max="100"')}
      ${field('share', 'Fatia que o CIQUANTA pode captar (%)', 2, 'step="0.5" max="100"')}</div>
      <p class="muted small">Percentuais conforme o contrato de cada campo e a Resolução ANP nº 918/2023. Exige credenciamento da unidade de pesquisa na ANP.</p>`,
  };

  const calc = {
    'lei-do-bem': () => {
      const al = num('aliq') / 100, lucro = num('lucro');
      let ex19 = num('d') * Number(F.querySelector('#inc').value) + Math.min(num('pat'), num('d')) * 0.2;
      let ex19a = num('ict') * Number(F.querySelector('#fat').value);
      const tot = Math.min(ex19 + ex19a, lucro);
      const k = ex19 + ex19a ? tot / (ex19 + ex19a) : 0;
      const ec19 = ex19 * k * al, ec19a = ex19a * k * al;
      const custoICT = num('ict') - ec19a;
      O.innerHTML = row('Exclusão art. 19 (P&D interno)', money(ex19 * k)) + row('Exclusão art. 19-A (projeto com ICT)', money(ex19a * k)) +
        row('Economia de IRPJ/CSLL: P&D interno', money(ec19)) + row('Economia de IRPJ/CSLL: projeto com o CIQUANTA', money(ec19a)) +
        row('Economia total estimada', money(ec19 + ec19a), true) +
        (num('ict') ? row('Custo líquido do projeto com o CIQUANTA', `${money(custoICT)} <span class="muted small">(R$ ${(custoICT / num('ict')).toFixed(2).replace('.', ',')} por R$ 1)</span>`) : '') +
        (k < 1 ? '<p class="small" style="color:var(--warn)">As exclusões foram limitadas pelo lucro real informado.</p>' : '');
      return { labels: ['Projeto com o CIQUANTA'], data: [[Math.max(0, custoICT), 'Custo líquido'], [ec19a, 'Economia fiscal']] };
    },
    'lei-de-tics': () => {
      const ob = num('fat') * num('perc') / 100, ext = ob * num('ext') / 100, reg = ext * num('reg') / 100, ciq = reg * num('share') / 100;
      O.innerHTML = row('Obrigação anual estimada de PD&I', money(ob)) + row('Aplicação externa (ICTs, PPIs, FNDCT)', money(ext)) + row('Reserva N/NE/CO', money(reg)) + row('Potencial para o CIQUANTA', money(ciq), true);
      return { labels: ['Obrigação'], data: [[ob - ext, 'Interna'], [ext - reg, 'Externa (outras regiões)'], [reg - ciq, 'N/NE/CO (outras ICTs)'], [ciq, 'CIQUANTA']] };
    },
    'pdi-aneel': () => {
      const ob = num('rol') * num('perc') / 100, ciq = ob * num('share') / 100;
      O.innerHTML = row('Recurso anual em projetos de PD&I', money(ob)) + row('Potencial para o CIQUANTA', money(ciq), true);
      return { labels: ['PD&I ANEEL'], data: [[ob - ciq, 'Demais projetos'], [ciq, 'CIQUANTA']] };
    },
    'pdi-anp': () => {
      const ob = num('rb') * Number(F.querySelector('#perc').value) / 100, ict = ob * num('ict') / 100, ciq = ict * num('share') / 100;
      O.innerHTML = row('Obrigação anual de PD&I', money(ob)) + row('Mínimo em ICTs credenciadas', money(ict)) + row('Potencial para o CIQUANTA', money(ciq), true);
      return { labels: ['PD&I ANP'], data: [[ob - ict, 'Empresa / fornecedores'], [ict - ciq, 'Outras ICTs'], [ciq, 'CIQUANTA']] };
    },
  };

  const update = () => {
    const r = calc[cur]();
    ch?.destroy();
    ch = chart(view.querySelector('#c'), {
      type: 'bar',
      data: { labels: r.labels, datasets: r.data.map(([v, l], i) => ({ label: l, data: [Math.max(0, v)], backgroundColor: i === r.data.length - 1 ? '#3056D5' : ['#9AA3C0', '#5B7BE3', '#172A68', '#A9B8EE'][i], borderRadius: 4 })) },
      options: { indexAxis: 'y', scales: { x: { stacked: true, ticks: { callback: v => money(v).replace(/\s/g, ' ') } }, y: { stacked: true } }, plugins: { tooltip: { callbacks: { label: c => `${c.dataset.label}: ${money(c.raw)}` } } } },
    });
  };
  const load = () => { F.innerHTML = forms[cur](); update(); };
  F.addEventListener('input', update); F.addEventListener('change', update);
  view.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { cur = b.dataset.s; view.querySelectorAll('[data-s]').forEach(x => x.classList.toggle('active', x === b)); load(); });
  load();
  const onTheme = () => update(); window.addEventListener('themechange', onTheme);
  return () => { ch?.destroy(); window.removeEventListener('themechange', onTheme); };
}
