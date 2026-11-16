import * as store from '../store.js';
import * as G from '../google.js';
import * as cad from '../cadencia.js';
import { esc, options, toast, modal, confirmDialog, isEmail, fmtDateTime, SEGMENTOS, EVIDENCIA, norm } from '../util.js';
import { pontuar, contexto } from '../score.js';
import { icon } from '../icons.js';

const ST = { ativa: ['Ativa', ''], respondeu: ['Respondeu', 'ok'], concluida: ['Concluída sem resposta', 'gray'], pausada: ['Pausada', 'warn'], encerrada: ['Encerrada', 'gray'], erro: ['Erro', 'bad'] };

export async function render(view) {
  let sel = store.list('cadencias')[0]?.id || '';
  const draw = () => {
    const cs = store.list('cadencias'), ins = store.list('inscricoes'), e = cad.estado(), conf = store.cfg(), g = G.status();
    const c = store.get('cadencias', sel);
    const conta = (id, st) => ins.filter(i => i.cadenciaId === id && (!st || i.status === st)).length;
    const total = k => ins.filter(i => i.status === k).length;
    const fech = total('respondeu') + total('concluida');
    view.innerHTML = `<div class="section-head"><div><h2>Cadências automáticas</h2><p>Sequências de e-mails enviadas da conta Google do CIQUANTA, um contato por vez, em dias úteis e horário comercial. A sequência para sozinha quando o contato responde ou pede descadastro, e cada envio fica no histórico da organização.</p></div>
      <div class="toolbar" style="margin:0"><button class="btn" id="run">${icon('play', 14)} Executar agora</button><button class="btn primary" id="nova">${icon('mais', 15)} Nova cadência</button></div></div>
      <div class="callout ${g.conectado && conf.cadenciasAtivas ? 'info' : 'warn'}" style="margin-bottom:16px">${!g.conectado ? `Conta Google desconectada: as cadências ficam em espera. <a href="#/config">Conectar</a>.` : conf.cadenciasAtivas ? `Motor ativo${e.ultimo ? `; última verificação às ${new Date(e.ultimo).toLocaleTimeString('pt-BR')}` : ''}. Limite diário: ${conf.limiteDiario} envios. ${conf.horarioComercial ? 'Somente dias úteis, das 8h às 18h.' : 'Sem restrição de horário.'}` : 'Motor pausado.'}
        <label class="check" style="margin-left:14px"><input type="checkbox" id="on" ${conf.cadenciasAtivas ? 'checked' : ''}> Envio automático</label>
        <label class="check" style="margin-left:14px"><input type="checkbox" id="hc" ${conf.horarioComercial ? 'checked' : ''}> Só em horário comercial</label></div>
      <div class="grid g4" style="margin-bottom:16px">
        <div class="card kpi"><span class="label">Contatos em sequência</span><span class="value">${total('ativa')}</span><span class="sub">${ins.filter(i => i.status === 'ativa' && new Date(i.proximoEm) <= new Date()).length} com envio pendente agora</span></div>
        <div class="card kpi"><span class="label">Responderam</span><span class="value">${total('respondeu')}</span><span class="sub">${fech ? Math.round(100 * total('respondeu') / fech) : 0}% das sequências encerradas</span></div>
        <div class="card kpi"><span class="label">Concluídas sem resposta</span><span class="value">${total('concluida')}</span><span class="sub">candidatas a novo canal de contato</span></div>
        <div class="card kpi"><span class="label">E-mails enviados</span><span class="value">${ins.reduce((a, i) => a + (i.envios?.length || 0), 0)}</span><span class="sub">por cadências</span></div>
      </div>
      <div class="grid split"><div class="card" style="padding:8px"><div class="list">${cs.map(x => `<button class="list-item btn ghost" style="justify-content:flex-start;text-align:left;border-radius:8px;${x.id === sel ? 'background:var(--surface-2)' : ''}" data-c="${esc(x.id)}"><div style="flex:1"><div class="title">${esc(x.nome)}</div><div class="meta">${x.passos.length} passos · ${conta(x.id, 'ativa')} ativos · ${conta(x.id, 'respondeu')} respostas ${x.ativa ? '' : '· pausada'}</div></div></button>`).join('') || '<div class="empty">Nenhuma cadência.</div>'}</div></div>
      <div id="det">${c ? detalhe(c, ins.filter(i => i.cadenciaId === c.id)) : '<div class="card"><div class="empty">Selecione ou crie uma cadência.</div></div>'}</div></div>`;
    view.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { sel = b.dataset.c; draw(); });
    view.querySelector('#on').onchange = ev => { store.setConfig({ cadenciasAtivas: ev.target.checked }); draw(); };
    view.querySelector('#hc').onchange = ev => { store.setConfig({ horarioComercial: ev.target.checked }); draw(); };
    view.querySelector('#run').onclick = async ev => { ev.currentTarget.disabled = true; const n = await cad.ciclo({ manual: true }); if (!n && G.status().conectado) toast('Nenhum envio pendente neste momento.'); draw(); };
    view.querySelector('#nova').onclick = () => { const n = store.upsert('cadencias', { nome: 'Nova cadência', publico: '', ativa: true, passos: [{ dias: 0, modeloId: store.list('modelos')[0]?.id || '' }, { dias: 5, modeloId: 'mod-followup' }] }, 'cad'); sel = n.id; draw(); };
    if (c) bind(c);
  };

  const detalhe = (c, ins) => {
    const mods = store.list('modelos').map(m => ({ id: m.id, nome: m.nome }));
    let acum = 0;
    return `<div class="card" style="margin-bottom:16px"><div class="form-grid"><label class="field">Nome<input type="text" id="c-nome" value="${esc(c.nome)}"></label><label class="field">Público<input type="text" id="c-pub" value="${esc(c.publico || '')}"></label></div>
      <h3 style="margin:16px 0 8px">Passos</h3><div class="list">${c.passos.map((p, i) => { acum += i ? Number(p.dias) || 0 : 0; return `<div class="list-item" style="align-items:center"><span class="kicker" style="width:26px">${String(i + 1).padStart(2, '0')}</span>
        <label class="field" style="width:150px">${i ? 'Dias após o passo anterior' : 'Início'}<input type="number" min="0" max="60" data-dias="${i}" value="${esc(p.dias)}" ${i ? '' : 'disabled'}></label>
        <label class="field" style="flex:1">Modelo de e-mail<select data-mod="${i}">${options(mods, p.modeloId, { empty: 'Selecione…' })}</select></label>
        <span class="muted small" style="width:70px">dia ${acum}</span><button class="btn sm ghost danger" data-rmp="${i}" ${c.passos.length < 2 ? 'disabled' : ''} aria-label="Remover passo">${icon('x', 14)}</button></div>`; }).join('')}</div>
      <div class="toolbar" style="margin:12px 0 0"><button class="btn sm" id="addp">${icon('mais', 13)} Passo</button><label class="check"><input type="checkbox" id="c-ativa" ${c.ativa ? 'checked' : ''}> Cadência ativa</label><span style="flex:1"></span><button class="btn primary" id="insc">${icon('contatos', 15)} Inscrever contatos</button><button class="btn ghost danger" id="delc">Excluir</button></div>
      <p class="muted small" style="margin:10px 0 0">A partir do segundo passo, as mensagens seguem na mesma conversa do Gmail, como resposta ao primeiro e-mail.</p></div>
      <div class="card"><h3>Contatos nesta cadência <span class="muted">${ins.length}</span></h3>${ins.length ? `<div class="table-wrap"><table><thead><tr><th>Contato</th><th>Organização</th><th>Situação</th><th>Passo</th><th>Próximo envio</th><th></th></tr></thead><tbody>${ins.sort((a, b) => (a.status === 'ativa' ? 0 : 1) - (b.status === 'ativa' ? 0 : 1) || (a.proximoEm || '').localeCompare(b.proximoEm || '')).slice(0, 300).map(i => { const ct = store.get('contatos', i.contatoId), o = store.orgOf(ct); const [l, k] = ST[i.status] || ST.ativa; return `<tr><td class="title">${esc(ct?.nome || '—')}<div class="muted small">${esc(ct?.email || '')}</div></td><td>${o ? `<a href="#/org/${esc(o.id)}">${esc(o.nomeFantasia || o.nome)}</a>` : '—'}</td><td><span class="badge ${k}">${l}</span>${i.motivo ? `<div class="muted small">${esc(i.motivo)}</div>` : ''}</td><td>${Math.min(i.passo + (i.status === 'ativa' ? 1 : 0), c.passos.length)}/${c.passos.length}</td><td class="small">${i.status === 'ativa' ? fmtDateTime(i.proximoEm) : '—'}</td>
        <td class="nowrap">${i.status === 'ativa' ? `<button class="btn sm" data-pause="${esc(i.id)}">Pausar</button>` : i.status === 'pausada' ? `<button class="btn sm" data-resume="${esc(i.id)}">Retomar</button>` : ''} <button class="btn sm ghost danger" data-rmi="${esc(i.id)}" aria-label="Remover">${icon('x', 14)}</button></td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty">Nenhum contato inscrito. Use "Inscrever contatos" para montar o público por setor, segmento e potencial.</div>'}</div>`;
  };

  const bind = c => {
    const $ = s => view.querySelector(s), save = () => store.touch('cadencias');
    $('#c-nome').onchange = e => { c.nome = e.target.value; save(); draw(); };
    $('#c-pub').onchange = e => { c.publico = e.target.value; save(); };
    $('#c-ativa').onchange = e => { c.ativa = e.target.checked; save(); draw(); };
    view.querySelectorAll('[data-dias]').forEach(i => i.onchange = () => { c.passos[+i.dataset.dias].dias = Math.max(0, +i.value || 0); save(); draw(); });
    view.querySelectorAll('[data-mod]').forEach(i => i.onchange = () => { c.passos[+i.dataset.mod].modeloId = i.value; save(); });
    view.querySelectorAll('[data-rmp]').forEach(b => b.onclick = () => { c.passos.splice(+b.dataset.rmp, 1); c.passos[0].dias = 0; save(); draw(); });
    $('#addp').onclick = () => { c.passos.push({ dias: 5, modeloId: 'mod-followup' }); save(); draw(); };
    $('#delc').onclick = async () => { if (await confirmDialog(`Excluir a cadência "${c.nome}" e as inscrições?`, { ok: 'Excluir', danger: true })) { store.remove('cadencias', c.id); sel = store.list('cadencias')[0]?.id || ''; draw(); } };
    $('#insc').onclick = () => publico(c, draw);
    $('#det').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const i = store.get('inscricoes', b.dataset.pause || b.dataset.resume || b.dataset.rmi); if (!i) return;
      if (b.dataset.pause) i.status = 'pausada';
      if (b.dataset.resume) { i.status = 'ativa'; i.proximoEm = cad.proximoHorario(new Date(), 0).toISOString(); }
      if (b.dataset.rmi) store.state().inscricoes = store.list('inscricoes').filter(x => x.id !== i.id);
      store.touch('inscricoes'); draw();
    });
  };
  draw();
  const off = cad.onCadencia(() => { if (!document.querySelector('.modal-back') && !/INPUT|SELECT/.test(document.activeElement?.tagName)) draw(); });
  return off;
}

function publico(c, done) {
  const ctx = contexto();
  const { el, close } = modal({ title: `Inscrever contatos em "${c.nome}"`, wide: true, body: `<div class="form-grid" style="grid-template-columns:repeat(4,minmax(0,1fr))">
      <label class="field">Setor<select id="p-setor">${options(store.setoresLista().map(s => ({ id: s.id, nome: s.nome })), '', { empty: 'Todos' })}</select></label>
      <label class="field">Segmento<select id="p-seg">${options(SEGMENTOS, '', { empty: 'Todos' })}</select></label>
      <label class="field">Atuação quântica<select id="p-ev">${options(Object.entries(EVIDENCIA).map(([id, [nome]]) => ({ id, nome })), '', { empty: 'Todas' })}</select></label>
      <label class="field">Potencial mínimo<input type="number" id="p-min" min="0" max="100" value="0"></label>
      <label class="field full"><input type="search" id="p-q" placeholder="Nome, cargo ou organização"></label></div>
      <label class="check" style="margin:10px 0"><input type="checkbox" id="p-novos" checked> Somente contatos que ainda não receberam e-mail</label>
      <div class="table-wrap" style="max-height:340px;overflow:auto"><table><thead><tr><th><input type="checkbox" id="p-all" checked aria-label="Selecionar todos"></th><th>Contato</th><th>Organização</th><th>Setor</th><th class="num">Potencial</th></tr></thead><tbody id="p-tb"></tbody></table></div><p class="muted small" id="p-n"></p>`,
    footer: '<button class="btn" data-close>Cancelar</button><button class="btn primary" id="p-ok">Inscrever selecionados</button>' });
  const $ = s => el.querySelector(s); const off = new Set();
  const ja = new Set(store.list('envios').filter(e => e.status === 'enviado').map(e => e.contatoId));
  const ativos = new Set(store.list('inscricoes').filter(i => i.status === 'ativa').map(i => i.contatoId));
  const lista = () => { const q = norm($('#p-q').value), st = $('#p-setor').value, sg = $('#p-seg').value, ev = $('#p-ev').value, min = +$('#p-min').value || 0, novos = $('#p-novos').checked;
    return store.list('contatos').filter(ct => isEmail(ct.email) && !ct.optout && !ativos.has(ct.id) && (!novos || !ja.has(ct.id))).map(ct => { const o = store.orgOf(ct) || {}; return { ct, o, p: pontuar(o, ctx).total }; })
      .filter(x => (!st || x.o.setor === st) && (!sg || x.o.segmento === sg) && (!ev || (x.o.evidencia || 'potencial') === ev) && x.p >= min && (!q || norm([x.ct.nome, x.ct.cargo, x.o.nome].join(' ')).includes(q))).sort((a, b) => b.p - a.p); };
  const draw = () => { const l = lista(); $('#p-tb').innerHTML = l.map(x => `<tr><td><input type="checkbox" data-id="${esc(x.ct.id)}" ${off.has(x.ct.id) ? '' : 'checked'}></td><td class="title">${esc(x.ct.nome)}<div class="muted small">${esc(x.ct.cargo || '')}</div></td><td>${esc(x.o.nomeFantasia || x.o.nome || '—')}</td><td class="small">${esc(store.setorCurto(x.o.setor))}</td><td class="num">${x.p}</td></tr>`).join('') || '<tr><td colspan="5"><div class="empty">Nenhum contato com e-mail atende aos filtros. Cadastre contatos nas organizações de maior potencial.</div></td></tr>';
    $('#p-n').textContent = `${l.filter(x => !off.has(x.ct.id)).length} selecionado(s) de ${l.length}`; };
  el.querySelectorAll('select,input[type=number],input[type=search],#p-novos').forEach(i => i.addEventListener('input', draw));
  $('#p-tb').onchange = e => { const id = e.target.dataset.id; if (id) { e.target.checked ? off.delete(id) : off.add(id); draw(); } };
  $('#p-all').onchange = e => { lista().forEach(x => e.target.checked ? off.delete(x.ct.id) : off.add(x.ct.id)); draw(); };
  $('#p-ok').onclick = () => { const ids = lista().filter(x => !off.has(x.ct.id)).map(x => x.ct.id); if (!ids.length) { toast('Nenhum contato selecionado.', 'bad'); return; } const r = cad.inscrever(c.id, ids); toast(`${r.novos} contato(s) inscrito(s)${r.ignorados ? `, ${r.ignorados} ignorado(s)` : ''}.`, 'ok'); close(); done(); };
  draw();
}
