// Sinais do mercado: notícias do dia sobre computação quântica, P&D e fomento, ligadas às organizações do CRM,
// e oportunidades identificadas automaticamente.
import * as store from '../store.js';
import { esc, fmtDate, relTime, norm, debounce } from '../util.js';
import { icon } from '../icons.js';
import { carregarSinais, sinais, TEMAS } from '../sinais.js';
import { revelar } from '../motion.js';

const TIPO_OP = { edital: 'Edital', investimento: 'Investimento', parceria: 'Parceria', evento: 'Evento', politica_publica: 'Política pública' };

export async function render(view, { params } = {}) {
  await carregarSinais();
  const desc = await store.ref('descobertas').catch(() => null);
  const f = { tema: params?.get('tema') || '', q: '', soOrg: false };
  const draw = () => {
    const { itens, atualizadoEm } = sinais();
    const q = norm(f.q);
    const l = itens.filter(s => (!f.tema || s.temas.includes(f.tema)) && (!f.soOrg || s.orgs.length) && (!q || norm(s.titulo + ' ' + s.fonte).includes(q)));
    const orgsDe = s => (s.orgs || []).map(id => store.get('orgs', 'org-' + id.replace(/^(ref|auto)-/, ''))).filter(Boolean);
    const contagem = Object.fromEntries(Object.keys(TEMAS).map(k => [k, itens.filter(s => s.temas.includes(k)).length]));
    const ops = (desc?.oportunidades || []).slice(-12).reverse();
    view.innerHTML = `<div class="section-head"><div><h2>Sinais do mercado</h2></div>
      <div class="muted small" style="align-self:end">${atualizadoEm ? `Atualizado ${relTime(atualizadoEm)}` : 'A coleta diária ainda não publicou sinais.'}</div></div>
      ${ops.length ? `<div class="card revelar" style="margin-bottom:18px"><h3>${icon('robo', 16)} Oportunidades identificadas com IA <span class="muted">confirme antes de agir</span></h3><div class="ops">${ops.map(o => `<a class="op" href="${esc(o.link)}" target="_blank" rel="noopener"><span class="badge ${o.tipo === 'edital' ? 'warn' : o.tipo === 'investimento' ? 'ok' : ''}">${esc(TIPO_OP[o.tipo] || o.tipo)}</span><b>${esc(o.resumo)}</b><small>${esc(o.titulo)} · ${fmtDate(o.data)}</small></a>`).join('')}</div></div>` : ''}
      <div class="chips" style="margin:0 0 14px"><button class="chip ${!f.tema ? 'on' : ''}" data-tema="">Todos <b>${itens.length}</b></button>${Object.entries(TEMAS).filter(([k]) => contagem[k]).map(([k, t]) => `<button class="chip ${f.tema === k ? 'on' : ''}" data-tema="${k}">${esc(t)} <b>${contagem[k]}</b></button>`).join('')}</div>
      <div class="toolbar"><input type="search" class="grow" id="q" placeholder="Buscar no título ou no veículo" value="${esc(f.q)}"><label class="check"><input type="checkbox" id="so" ${f.soOrg ? 'checked' : ''}> Só notícias que citam organizações do CRM</label></div>
      <div class="sinais">${l.slice(0, 150).map((s, i) => `<article class="sinal revelar" style="--i:${i % 12}"><div class="quando">${fmtDate(s.data)}<small>${esc(s.fonte)}</small></div>
        <div><a class="title" href="${esc(s.link)}" target="_blank" rel="noopener">${esc(s.titulo)} ${icon('externo', 12)}</a>
        <div class="tags">${s.edital ? '<span class="badge warn">Chamada aberta</span>' : ''}${s.temas.map(t => `<span class="badge gray">${esc(TEMAS[t] || t)}</span>`).join('')}${orgsDe(s).map(o => `<a class="badge" href="#/org/${esc(o.id)}">${esc(o.nomeFantasia || o.nome)}</a>`).join('')}</div></div></article>`).join('') || '<div class="card"><div class="empty">Nenhum sinal neste filtro.</div></div>'}</div>`;
    revelar(view);
    view.querySelectorAll('[data-tema]').forEach(b => b.onclick = () => { f.tema = b.dataset.tema; draw(); });
    view.querySelector('#so').onchange = e => { f.soOrg = e.target.checked; draw(); };
    view.querySelector('#q').addEventListener('input', debounce(e => { f.q = e.target.value; draw(); const i = view.querySelector('#q'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250));
  };
  draw();
}
