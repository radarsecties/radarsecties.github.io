import * as store from '../store.js';
import { esc, money, toast, isEmail } from '../util.js';
import { evBadge, relBadge, openOportunidadeForm } from '../components.js';
import { loadMecanismos, linkApresentacao } from '../email.js';
import { buildDeck, present } from '../deck.js';
import { icon } from '../icons.js';

export async function render(view, { arg }) {
  const mecs = await loadMecanismos();
  const ref = await store.ref('empresas');
  return arg ? detalhe(view, arg, mecs, ref) : grade(view, ref);
}

function contagens(setorId, ref) {
  const orgs = store.list('orgs').filter(o => o.setor === setorId);
  const ops = store.list('oportunidades').filter(o => o.setor === setorId && !['contratada', 'perdida'].includes(o.etapa));
  return { mapeadas: ref.itens.filter(r => r.setor === setorId).length, crm: orgs.length, confirmadas: ref.itens.filter(r => r.setor === setorId && r.evidencia === 'confirmada').length,
    pipeline: ops.reduce((a, o) => a + store.pipelineValor(o), 0), ops: ops.length };
}

function grade(view, ref) {
  const S = store.setoresLista();
  const comDeck = S.filter(s => s.deck), outros = S.filter(s => !s.deck);
  const card = s => { const n = contagens(s.id, ref); return `<div class="card setor-card" style="--c:${s.cor || '#3056D5'}" data-id="${esc(s.id)}">
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><h4 style="font-size:16px">${esc(s.nome)}</h4>${s.deck ? `<span class="badge">${s.linhas.length} linhas</span>` : `<span class="badge gray">usa agenda de ${esc(store.setorCurto(s.deckId))}</span>`}</div>
    <p class="muted small" style="margin:0;flex:1">${esc(s.resumo)}</p>
    <div class="n"><div><b>${n.mapeadas}</b>mapeadas</div><div><b>${n.confirmadas}</b>com atuação quântica</div><div><b>${n.crm}</b>no CRM</div><div><b>${money(n.pipeline)}</b>pipeline</div></div></div>`; };
  view.innerHTML = `<div class="section-head"><div><h2>Setores e aplicações</h2></div></div>
    <div class="grid g3" id="g1">${comDeck.map(card).join('')}</div>
    <h3 style="margin:24px 0 12px;font-size:15px">Setores relacionados</h3><div class="grid g3" id="g2">${outros.map(card).join('')}</div>`;
  const onClick = e => { const c = e.target.closest('.setor-card'); if (c) location.hash = `#/setores/${c.dataset.id}`; };
  view.addEventListener('click', onClick);
  return () => view.removeEventListener('click', onClick);
}

async function detalhe(view, id, mecs, ref) {
  const s = store.setoresLista().find(x => x.id === id);
  if (!s) { view.innerHTML = '<div class="card"><div class="empty">Setor não encontrado. <a href="#/setores">Voltar</a></div></div>'; return; }
  const agenda = s.deck ? s : store.setoresLista().find(x => x.id === s.deckId);
  const deckId = s.deck ? s.id : s.deckId;
  document.querySelector('#page-title').textContent = s.nome;
  const n = contagens(s.id, ref);
  const comum = (await store.loadSetores()).__comum;
  const draw = () => {
    const orgs = store.list('orgs').filter(o => o.setor === s.id).sort((a, b) => (a.prioridade || 'B').localeCompare(b.prioridade || 'B') || a.nome.localeCompare(b.nome));
    const refSetor = ref.itens.filter(r => r.setor === s.id && !store.findOrgByName(r.nome));
    view.innerHTML = `<div class="toolbar"><a class="btn ghost" href="#/setores">${icon('esquerda', 16)} Setores</a></div>
    <div class="card tom" style="--c:${s.cor || agenda?.cor || '#2F55D4'};margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap"><div style="max-width:760px"><h2 style="font-size:22px">${esc(s.nome)}</h2><p class="muted" style="margin:6px 0 0">${esc(s.resumo)}</p></div>
      <div class="toolbar" style="margin:0;align-items:flex-start">${deckId ? `<button class="btn primary" id="apresentar">${icon('play', 15)} Apresentar agenda</button><button class="btn" id="copiar">${icon('link', 15)} Copiar link público</button>` : ''}<button class="btn" id="camp">${icon('campanhas', 15)} Campanha para o setor</button></div></div>
      <div class="grid g4" style="margin-top:14px"><div><div class="muted small">Organizações mapeadas</div><b style="font-size:20px">${n.mapeadas}</b></div><div><div class="muted small">Atuação quântica confirmada</div><b style="font-size:20px">${n.confirmadas}</b></div><div><div class="muted small">No CRM</div><b style="font-size:20px">${n.crm}</b></div><div><div class="muted small">Pipeline ponderado</div><b style="font-size:20px">${money(n.pipeline)}</b></div></div>
    </div>
    ${s.desafios?.length ? `<div class="card" style="margin-bottom:16px"><h3>Onde o setor encontra limites de cálculo</h3><div class="grid g4">${s.desafios.map(d => `<div class="callout">${esc(d)}</div>`).join('')}</div></div>` : ''}
    <h3 style="margin:8px 0 12px;font-size:16px">Linhas de pesquisa${!s.deck && agenda ? ` (agenda de ${esc(agenda.nome.toLowerCase())})` : ''}</h3>
    <div class="grid" style="margin-bottom:16px">${(agenda?.linhas || []).map(l => `<div class="linha"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><div><h4>${esc(l.nome)}</h4><span class="muted small">${esc(l.sub)}</span></div><button class="btn sm" data-op="${esc(l.id)}">${icon('mais', 14)} Oportunidade nesta linha</button></div>
      <div class="pergunta"><span class="muted small" style="font-weight:700;text-transform:uppercase;letter-spacing:.08em">Pergunta central</span><br>${esc(l.pergunta)}</div>
      <div class="tres"><div><h5>Clássico</h5><ul>${l.classico.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div><div><h5>Híbrido</h5><ul>${l.hibrido.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div><div><h5>Quântico</h5><ul>${l.quantico.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div>
      <div class="grid g2 small" style="margin-top:10px"><div><b>Entregas.</b> ${esc(l.entregas)}</div><div><b>Indicadores.</b> ${esc(l.indicadores)}</div></div></div>`).join('')}</div>
    <div class="grid g2" style="margin-bottom:16px">
      <div class="card"><h3>Mecanismos de financiamento</h3><div class="list">${s.mecanismos.map(m => mecs[m]).filter(Boolean).map(m => `<div class="list-item"><div><div class="title">${esc(m.nome)}</div><div class="meta">${esc(m.encaixeCiquanta)}</div></div></div>`).join('')}</div><a class="small" href="#/mecanismos">Ver todos os mecanismos</a></div>
      <div class="card"><h3>Participação e dados</h3><p class="small"><b>Parceiros prioritários.</b> ${esc(agenda?.parceiros || '—')}</p><p class="small"><b>Dados.</b> ${esc(agenda?.dados || '—')}</p>
        <div class="list">${(comum.participacao || []).map(p => `<div class="list-item"><div><div class="title">${esc(p.t)}</div><div class="meta">${esc(p.d)}</div></div></div>`).join('')}</div></div>
    </div>
    <div class="card" style="margin-bottom:16px"><h3>Organizações do setor no CRM <span class="muted">${orgs.length}</span></h3>
      ${orgs.length ? `<div class="table-wrap"><table><thead><tr><th>Organização</th><th>UF</th><th>Atuação quântica</th><th>Relacionamento</th><th>Contatos</th></tr></thead><tbody>${orgs.map(o => `<tr class="row-link" data-org="${esc(o.id)}"><td class="title">${esc(o.nome)} ${o.prioridade === 'A' ? '<span class="prio" title="Prioridade A">A</span>' : ''}</td><td>${esc(o.uf || '—')}</td><td>${evBadge(o.evidencia)}</td><td>${relBadge(o.relacionamento)}</td><td>${store.contatosDe(o.id).filter(c => isEmail(c.email)).length}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Nenhuma organização deste setor no CRM.</div>'}
    </div>
    ${refSetor.length ? `<div class="card"><h3>Mapeadas e ainda fora do CRM <span class="muted">${refSetor.length}</span></h3><div class="toolbar"><button class="btn" id="imp">Importar todas para o CRM</button></div>
      <div class="list">${refSetor.map(r => `<div class="list-item"><div style="flex:1"><div class="title">${esc(r.nome)} ${evBadge(r.evidencia)}</div><div class="meta">${esc([r.cidade, r.uf].filter(Boolean).join('/'))}${r.atuacao ? ' · ' + esc(r.atuacao) : ''}</div></div></div>`).join('')}</div></div>` : ''}`;
    view.querySelector('#apresentar')?.addEventListener('click', async () => present(await buildDeck(deckId)));
    view.querySelector('#copiar')?.addEventListener('click', async () => { const u = linkApresentacao(deckId); try { await navigator.clipboard.writeText(u); toast('Link copiado: ' + u, 'ok'); } catch { toast(u); } });
    view.querySelector('#camp').onclick = () => {
      const ids = store.list('contatos').filter(c => store.orgOf(c)?.setor === s.id && isEmail(c.email) && !c.optout).map(c => c.id);
      const mod = store.get('modelos', 'mod-empresa-agenda');
      const c = store.upsert('campanhas', { nome: `Agenda ${s.curto}`, modeloId: mod?.id, assunto: mod?.assunto || '', corpo: mod?.corpo || '', destinatarios: ids, status: 'rascunho', modo: 'enviar', materiais: [], vars: {} }, 'cmp');
      if (!ids.length) toast('Nenhum contato com e-mail neste setor ainda: adicione destinatários na campanha.', 'bad');
      location.hash = `#/campanhas/${c.id}`;
    };
    view.querySelectorAll('[data-op]').forEach(b => b.onclick = () => openOportunidadeForm({ setor: s.id, linha: b.dataset.op, titulo: agenda.linhas.find(l => l.id === b.dataset.op)?.nome }, () => toast('Veja em Oportunidades.', 'ok')));
    view.querySelectorAll('[data-org]').forEach(tr => tr.onclick = () => location.hash = `#/org/${tr.dataset.org}`);
    view.querySelector('#imp')?.addEventListener('click', () => {
      refSetor.forEach(r => store.list('orgs').push(fromRef(r)));
      store.touch('orgs'); toast(`${refSetor.length} organizações importadas.`, 'ok'); draw();
    });
  };
  draw();
}

export function fromRef(r) {
  return { id: 'org-' + r.id.slice(4), nome: r.nome, segmento: r.segmento, setor: r.setor, uf: r.uf, cidade: r.cidade, site: r.site, evidencia: r.evidencia, atuacao: r.atuacao,
    fontes: r.fontes, bloco: r.bloco, prioridade: r.prioridade, notas: r.notas, tags: [...(r.tags || [])], mecanismos: [...(store.setoresLista().find(x => x.id === r.setor)?.mecanismos || [])], relacionamento: 'mapeada', origem: 'Mapeamento setorial CIQUANTA', refId: r.id, criadoEm: new Date().toISOString() };
}
