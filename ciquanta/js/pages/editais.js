// Editais e chamadas: acompanhamento de oportunidades de fomento com prazo
import * as store from '../store.js';
import { esc, modal, formData, options, toast, fmtDate, relTime, isoDay, money, safeUrl } from '../util.js';
import { loadMecanismos, mecCurto } from '../email.js';
import { icon } from '../icons.js';

const ST = { aberto: ['Aberto', ''], preparacao: ['Em preparação', 'warn'], submetido: ['Submetido', 'info'], aprovado: ['Aprovado', 'ok'], recusado: ['Não aprovado', 'gray'], encerrado: ['Encerrado', 'gray'] };
const FONTES = [
  ['Finep: chamadas públicas', 'https://www.finep.gov.br/chamadas-publicas', 'Subvenção, cooperativos ICT-empresa e infraestrutura (FNDCT).'],
  ['CNPq: chamadas', 'https://www.gov.br/cnpq/pt-br', 'Bolsas, redes de pesquisa e cooperação internacional.'],
  ['EMBRAPII', 'https://embrapii.org.br/', 'Credenciamento de unidades e centros de competência.'],
  ['BNDES: Funtec e inovação', 'https://www.bndes.gov.br/wps/portal/site/home/financiamento', 'Projetos de ICTs com empresa interveniente e crédito à inovação.'],
  ['MCTI: Lei de TICs e programas prioritários', 'https://www.gov.br/mcti/pt-br/acompanhe-o-mcti/lei-de-tics', 'Credenciamento no CATI e programas prioritários.'],
  ['ANEEL: PD&I e chamadas estratégicas', 'https://www.gov.br/aneel/pt-br/assuntos/pesquisa-desenvolvimento-e-eficiencia-energetica', 'Temas estratégicos do setor elétrico.'],
  ['ANP: PD&I', 'https://www.gov.br/anp/pt-br/assuntos/tecnologia-meio-ambiente/pesquisa-desenvolvimento-e-inovacao', 'Credenciamento de unidades de pesquisa e regulamento da cláusula.'],
  ['CONFAP', 'https://confap.org.br/', 'Chamadas das fundações estaduais e programas conjuntos.'],
  ['Softex', 'https://softex.br/', 'Residências e projetos do PPI.'],
  ['Banco do Nordeste: FUNDECI', 'https://www.bnb.gov.br/', 'Editais de apoio à pesquisa e inovação no Nordeste.'],
];

export async function render(view) {
  const mecs = await loadMecanismos();
  const auto = await store.ref('editais-auto').catch(() => null);
  const draw = () => {
    const hoje = isoDay();
    const l = [...store.list('editais')].sort((a, b) => (a.prazo || '9999').localeCompare(b.prazo || '9999'));
    const ativos = l.filter(e => ['aberto', 'preparacao', 'submetido'].includes(e.status));
    view.innerHTML = `<div class="section-head"><div><h2>Editais e chamadas</h2><p>Acompanhamento das chamadas de fomento em que o CIQUANTA concorre como executor ou coexecutor: prazo, valor pleiteado, parceiros e situação. Prazos próximos aparecem nas próximas ações do painel.</p></div><button class="btn primary" id="novo">${icon('mais', 15)} Novo edital</button></div>
      <div class="grid g4" style="margin-bottom:16px">
        <div class="card kpi"><span class="label">Em acompanhamento</span><span class="value">${ativos.length}</span><span class="sub">abertos, em preparação ou submetidos</span></div>
        <div class="card kpi"><span class="label">Valor pleiteado</span><span class="value">${money(ativos.reduce((a, e) => a + (Number(e.valor) || 0), 0))}</span><span class="sub">em chamadas ativas</span></div>
        <div class="card kpi"><span class="label">Aprovado</span><span class="value">${money(l.filter(e => e.status === 'aprovado').reduce((a, e) => a + (Number(e.valor) || 0), 0))}</span><span class="sub">${l.filter(e => e.status === 'aprovado').length} chamadas</span></div>
        <div class="card kpi"><span class="label">Próximo prazo</span><span class="value" style="font-size:26px">${(() => { const p = ativos.find(e => e.prazo >= hoje); return p ? fmtDate(p.prazo) : '—'; })()}</span><span class="sub">${(() => { const p = ativos.find(e => e.prazo >= hoje); return p ? esc(p.titulo) : 'sem prazo cadastrado'; })()}</span></div>
      </div>
      <div class="table-wrap" style="margin-bottom:18px"><table><thead><tr><th>Chamada</th><th>Órgão</th><th>Mecanismo</th><th>Prazo</th><th class="num">Valor</th><th>Situação</th><th>Parceiros</th></tr></thead><tbody>${l.length ? l.map(e => { const [st, k] = ST[e.status] || ST.aberto; return `<tr class="row-link" data-id="${esc(e.id)}"><td class="title">${esc(e.titulo)}${safeUrl(e.link) ? ` <a href="${esc(e.link)}" target="_blank" rel="noopener" title="Abrir edital">${icon('externo', 13)}</a>` : ''}</td><td>${esc(e.orgao || '—')}</td><td class="small">${e.mecanismo ? esc(mecCurto(e.mecanismo)) : '—'}</td>
        <td class="nowrap">${e.prazo ? `${fmtDate(e.prazo)} <span class="muted small" style="color:${e.prazo < hoje && ['aberto', 'preparacao'].includes(e.status) ? 'var(--bad)' : ''}">(${relTime(e.prazo)})</span>` : '—'}</td><td class="num">${e.valor ? money(e.valor) : '—'}</td><td><span class="badge ${k}">${st}</span></td><td class="small">${esc((e.parceiros || []).map(id => store.get('orgs', id)?.nome).filter(Boolean).join(', ') || '—')}</td></tr>`; }).join('') : '<tr><td colspan="7"><div class="empty">Nenhum edital cadastrado. Consulte as fontes abaixo e registre as chamadas de interesse.</div></td></tr>'}</tbody></table></div>
      ${(() => { const ja = new Set(store.list('editais').map(e => e.origemId).filter(Boolean)); const l = (auto?.itens || []).filter(x => !ja.has(x.id)).slice(0, 12);
        return `<div class="card" style="margin-bottom:18px"><h3>Chamadas identificadas automaticamente <span class="muted">${auto?.atualizadoEm ? 'coleta ' + relTime(auto.atualizadoEm) : 'aguardando a coleta diária'}</span></h3>${l.length ? `<div class="list">${l.map(x => `<div class="list-item"><div style="flex:1;min-width:0"><a class="title" href="${esc(x.link)}" target="_blank" rel="noopener">${esc(x.titulo)} ${icon('externo', 12)}</a><div class="meta">${esc(x.orgao)} · publicada ${fmtDate(x.publicado)}${x.prazo ? ` · <b>prazo ${fmtDate(x.prazo)}</b>` : ''}</div></div><button class="btn sm" data-seguir="${esc(x.id)}">${icon('mais', 13)} Acompanhar</button></div>`).join('')}</div>` : '<div class="empty">Nenhuma chamada nova. A coleta procura duas vezes por dia em notícias, EMBRAPII e Agência FAPESP.</div>'}</div>`; })()}
      <div class="card"><h3>Onde acompanhar novas chamadas</h3><div class="grid g2">${FONTES.map(f => `<div class="list-item" style="border:0;padding:6px 0"><div><a class="title" href="${f[1]}" target="_blank" rel="noopener">${f[0]} ${icon('externo', 12)}</a><div class="meta">${f[2]}</div></div></div>`).join('')}</div></div>`;
    view.querySelector('#novo').onclick = () => form({}, mecs, draw);
    view.querySelectorAll('[data-seguir]').forEach(b => b.onclick = () => { const x = auto.itens.find(i => i.id === b.dataset.seguir); store.upsert('editais', { titulo: x.titulo, orgao: x.orgao, link: x.link, prazo: x.prazo || '', status: 'aberto', origemId: x.id, notas: 'Identificada pela coleta diária; confirme regras e prazo na página oficial.' }, 'edt'); toast('Chamada em acompanhamento.', 'ok'); draw(); });
    view.querySelector('tbody').onclick = e => { if (e.target.closest('a')) return; const tr = e.target.closest('tr[data-id]'); if (tr) form(store.get('editais', tr.dataset.id), mecs, draw); };
  };
  draw();
}

function form(e, mecs, done) {
  const orgs = [...store.list('orgs')].filter(o => o.relacionamento && o.relacionamento !== 'mapeada' || (e.parceiros || []).includes(o.id)).sort((a, b) => a.nome.localeCompare(b.nome));
  const { el, close } = modal({ title: e.id ? 'Editar edital' : 'Novo edital', wide: true, body: `<form class="form-grid" id="f">
    <label class="field full">Título da chamada *<input type="text" name="titulo" required value="${esc(e.titulo)}"></label>
    <label class="field">Órgão<input type="text" name="orgao" value="${esc(e.orgao)}" placeholder="Finep, CNPq, FAPESQ, BNDES…"></label>
    <label class="field">Mecanismo<select name="mecanismo">${options(Object.values(mecs).map(m => ({ id: m.id, nome: m.curto || m.nome })), e.mecanismo, { empty: '—' })}</select></label>
    <label class="field">Prazo de submissão<input type="date" name="prazo" value="${esc(e.prazo || '')}"></label>
    <label class="field">Valor pleiteado (R$)<input type="number" min="0" step="1000" name="valor" value="${esc(e.valor || '')}"></label>
    <label class="field">Situação<select name="status">${options(Object.entries(ST).map(([id, [nome]]) => ({ id, nome })), e.status || 'aberto')}</select></label>
    <label class="field">Responsável<input type="text" name="responsavel" value="${esc(e.responsavel || store.cfg().remetenteNome)}"></label>
    <label class="field full">Link do edital<input type="url" name="link" value="${esc(e.link)}" placeholder="https://"></label>
    <label class="field full">Parceiros no consórcio (organizações em relacionamento)<select name="parceiros" multiple size="5">${orgs.map(o => `<option value="${esc(o.id)}" ${(e.parceiros || []).includes(o.id) ? 'selected' : ''}>${esc(o.nome)}</option>`).join('')}</select></label>
    <label class="field full">Notas<textarea name="notas">${esc(e.notas)}</textarea></label></form>`,
    footer: `${e.id ? '<button class="btn danger" id="del" style="margin-right:auto">Excluir</button>' : ''}<button class="btn" data-close>Cancelar</button><button class="btn primary" id="ok">Salvar</button>` });
  el.querySelector('#ok').onclick = () => { const f = el.querySelector('#f'); if (!f.reportValidity()) return; const d = formData(f); d.valor = Number(d.valor) || 0; d.link = safeUrl(d.link); store.upsert('editais', { ...e, ...d }, 'edt'); toast('Edital salvo.', 'ok'); close(); done(); };
  el.querySelector('#del')?.addEventListener('click', async () => { close(); store.removerComDesfazer('editais', e.id, 'Edital', done); done(); });
}
