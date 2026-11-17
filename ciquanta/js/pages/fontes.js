import * as store from '../store.js';
import { esc, fmtDate } from '../util.js';
import { icon } from '../icons.js';

export async function render(view) {
  const [fontes, emp, mec] = await Promise.all([store.ref('fontes'), store.ref('empresas'), store.ref('mecanismos')]);
  const citam = id => emp.itens.filter(e => e.fontes.includes(id));
  const grupos = [...new Set(fontes.itens.map(f => f.tipo))];
  view.innerHTML = `<div class="section-head"><div><h2>Fontes e referências</h2></div></div>
    <div class="grid g3" style="margin-bottom:16px">
      <div class="card acento"><h3>Atuação quântica confirmada</h3><p class="small" style="margin:0">Há registro público, em fonte identificada, de projeto, equipe, programa ou parceria em computação ou tecnologias quânticas. Para empresas cujo negócio é a própria tecnologia quântica, a referência é o perfil público da empresa.</p></div>
      <div class="card acento"><h3>Indícios públicos</h3><p class="small" style="margin:0">Há sinal público relacionado (declaração, participação em evento, infraestrutura de computação de alto desempenho), sem projeto quântico documentado.</p></div>
      <div class="card acento"><h3>Perfil compatível</h3><p class="small" style="margin:0">Sem atuação quântica documentada; a organização investe em P&D, tem obrigação regulatória de PD&I ou atua em setor com aplicação identificada.</p></div>
    </div>
    ${grupos.map(g => `<div class="card" style="margin-bottom:16px"><h3>${esc(g)}</h3><div class="list">${fontes.itens.filter(f => f.tipo === g).map(f => { const c = citam(f.id); return `<div class="list-item"><div style="flex:1">
      <div class="title">${f.url ? `<a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.titulo)} ${icon('externo', 12)}</a>` : esc(f.titulo)}</div>
      ${c.length ? `<div class="meta">Citada em: ${c.map(e => esc(e.nome)).join(', ')}</div>` : ''}</div></div>`; }).join('')}</div></div>`).join('')}
    <div class="card"><h3>Legislação e páginas oficiais dos mecanismos <span class="muted">revisado em ${fmtDate(mec.verificadoEm)}</span></h3><div class="list">${mec.itens.map(m => `<div class="list-item"><div style="flex:1"><div class="title"><a href="${esc(m.link)}" target="_blank" rel="noopener">${esc(m.nome)} ${icon('externo', 12)}</a></div><div class="meta">${esc(m.baseLegal)} · ${esc(m.gestor)}</div></div></div>`).join('')}</div></div>`;
}
