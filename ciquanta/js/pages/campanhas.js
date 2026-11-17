import * as store from '../store.js';
import * as G from '../google.js';
import * as runner from '../runner.js';
import { compose, buildMime, loadMecanismos, VARIAVEIS, mecNome } from '../email.js';
import { esc, toast, options, SEGMENTOS, UFS, RELACIONAMENTO, EVIDENCIA, REGIAO, norm, fmtDateTime, confirmDialog, pct, isEmail, toCSV, download } from '../util.js';
import { AREAS } from '../components.js';

const STATUS = { rascunho: ['Rascunho', 'gray'], agendada: ['Agendada', 'info'], enviando: ['Enviando', 'warn'], pausada: ['Pausada', 'warn'], concluida: ['Concluída', 'ok'] };
const stBadge = s => { const [l, k] = STATUS[s] || STATUS.rascunho; return `<span class="badge ${k}">${l}</span>`; };

export async function render(view, { arg }) {
  await loadMecanismos();
  return arg ? editor(view, arg) : lista(view);
}

function lista(view) {
  const draw = () => {
    const camps = [...store.list('campanhas')].sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));
    const env = store.list('envios');
    view.innerHTML = `<div class="section-head"><div><h2>Campanhas de e-mail</h2></div>
      <button class="btn primary" id="nova">+ Nova campanha</button></div>
      ${gmailCard()}
      <div class="table-wrap" style="margin-top:16px"><table><thead><tr><th>Campanha</th><th>Status</th><th>Destinatários</th><th>Enviados</th><th>Respostas</th><th>Criada</th><th></th></tr></thead><tbody>
      ${camps.length ? camps.map(c => { const e = env.filter(x => x.campanhaId === c.id); const s = e.filter(x => x.status === 'enviado').length; const r = e.filter(x => x.respondido).length; return `<tr class="row-link" data-id="${esc(c.id)}">
        <td><div class="title">${esc(c.nome)}</div><div class="muted small">${esc(c.assunto || 'sem assunto')}</div></td><td>${stBadge(c.status)}${c.status === 'agendada' ? `<div class="small muted">${fmtDateTime(c.agendadaPara)}</div>` : ''}${c.modo === 'rascunho' ? ' <span class="badge gray">rascunhos</span>' : ''}</td>
        <td>${(c.destinatarios || []).length}</td><td>${s}</td><td>${r} <span class="muted small">(${pct(r, s)}%)</span></td><td class="small">${fmtDateTime(c.criadoEm)}</td>
        <td><button class="btn sm ghost danger" data-del="${esc(c.id)}" aria-label="Excluir">✕</button></td></tr>`; }).join('')
      : '<tr><td colspan="7"><div class="empty">Nenhuma campanha ainda.</div></td></tr>'}
      </tbody></table></div>`;
    bindGmailCard(view, draw);
    view.querySelector('#nova').onclick = () => { const c = store.upsert('campanhas', { nome: 'Nova campanha', status: 'rascunho', modo: 'enviar', destinatarios: [], materiais: [], assunto: '', corpo: '', vars: {} }, 'cmp'); location.hash = `#/campanhas/${c.id}`; };
    view.querySelector('tbody').onclick = async e => {
      const d = e.target.closest('[data-del]');
      if (d) { e.stopPropagation(); if (runner.isRunning(d.dataset.del)) { toast('Pause a campanha antes de excluir.', 'bad'); return; } if (await confirmDialog('Excluir campanha e seu registro de envios?', { ok: 'Excluir', danger: true })) { store.remove('campanhas', d.dataset.del); draw(); } return; }
      const tr = e.target.closest('tr[data-id]'); if (tr) location.hash = `#/campanhas/${tr.dataset.id}`;
    };
  };
  draw();
}

function gmailCard() {
  const s = G.status(); const c = store.cfg();
  return `<div class="card" style="display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap">
    <div><div class="title">${s.conectado ? `Conectado como <strong>${esc(s.email)}</strong>` : 'E-mail desconectado'}</div>
    <div class="muted small">${s.conectado ? `Ritmo: 1 e-mail a cada ${c.intervaloSeg}s · limite diário ${c.limiteDiario} · enviados hoje: ${runner.enviadosHoje()}` : 'Configure o Client ID do Google em Configurações para habilitar o envio.'}</div></div>
    <div class="toolbar" style="margin:0">${s.conectado ? '' : c.ponteUrl ? '<button class="btn primary" id="g-on">Conectar conta Google</button>' : '<a class="btn primary" href="#/config">Configurar integração</a>'}</div></div>`;
}
function bindGmailCard(view, redraw) {
  view.querySelector('#g-on')?.addEventListener('click', async () => { try { await G.connect(); toast('Gmail conectado.', 'ok'); redraw(); } catch (e) { toast(e.message, 'bad'); } });
  view.querySelector('#g-off')?.addEventListener('click', () => { G.disconnect(); redraw(); });
}

function editor(view, id) {
  const camp = () => store.get('campanhas', id);
  if (!camp()) { view.innerHTML = '<div class="card"><div class="empty">Campanha não encontrada. <a href="#/campanhas">Voltar</a></div></div>'; return; }
  const c0 = camp(); c0.vars ||= {}; c0.materiais ||= []; c0.destinatarios ||= [];
  let previewIdx = 0;
  const save = patch => { Object.assign(camp(), patch); store.touch('campanhas'); };
  const locked = () => runner.isRunning(id);

  view.innerHTML = `
  <div class="toolbar"><a class="btn ghost" href="#/campanhas">← Campanhas</a><span id="st"></span></div>
  <div class="grid g2">
    <div style="display:grid;gap:16px;align-content:start">
      <div class="card"><h3>1. Identificação</h3><div class="form-grid">
        <label class="field full">Nome interno<input type="text" id="nome" value="${esc(c0.nome)}"></label>
        <label class="field">Modo<select id="modo"><option value="enviar" ${c0.modo !== 'rascunho' ? 'selected' : ''}>Enviar diretamente</option><option value="rascunho" ${c0.modo === 'rascunho' ? 'selected' : ''}>Criar rascunhos no Gmail (revisar antes)</option></select></label>
        <label class="field">Cópia (Cc) opcional<input type="email" id="cc" value="${esc(c0.cc || '')}" placeholder="equipe@…"></label>
      </div></div>
      <div class="card"><h3>2. Mensagem</h3><div class="form-grid">
        <label class="field full">Partir de um modelo<select id="mod">${options(store.list('modelos').map(m => ({ id: m.id, nome: m.nome })), '', { empty: 'Selecione para carregar…' })}</select></label>
        <label class="field full">Assunto<input type="text" id="assunto" value="${esc(c0.assunto)}"></label>
        <div class="field full">Variáveis (clique para inserir)<div class="var-chips">${VARIAVEIS.map(([k, d]) => `<button type="button" title="${esc(d)}" data-var="${k}">{{${k}}}</button>`).join('')}</div></div>
        <label class="field full">Corpo (HTML simples: &lt;p&gt;, &lt;strong&gt;, &lt;ul&gt;, &lt;a&gt;)<textarea id="corpo" style="min-height:240px;font-family:ui-monospace,monospace;font-size:12.5px">${esc(c0.corpo)}</textarea></label>
        <label class="field">{{evento}}<input type="text" id="v-evento" value="${esc(c0.vars.evento || '')}"></label>
        <label class="field">{{data_evento}}<input type="text" id="v-data_evento" value="${esc(c0.vars.data_evento || '')}"></label>
      </div></div>
      <div class="card"><h3>3. Materiais institucionais</h3><div id="mats"></div></div>
      <div class="card"><h3>4. Destinatários <span class="muted" id="dest-sum"></span></h3>
        <div class="form-grid">
          <label class="field">Setor<select id="a-setor">${options(store.setoresLista().map(s => ({ id: s.id, nome: s.nome })), '', { empty: 'Todos' })}</select></label>
          <label class="field">Segmento<select id="a-seg">${options(SEGMENTOS, '', { empty: 'Todos' })}</select></label>
          <label class="field">Atuação quântica<select id="a-ev">${options(Object.entries(EVIDENCIA).map(([id, [nome]]) => ({ id, nome })), '', { empty: 'Todas' })}</select></label>
          <label class="field">Região<select id="a-reg">${options(['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'], '', { empty: 'Todas' })}</select></label>
          <label class="field">UF<select id="a-uf">${options(UFS, '', { empty: 'Todas' })}</select></label>
          <label class="field">Relacionamento<select id="a-est">${options(RELACIONAMENTO, '', { empty: 'Todos' })}</select></label>
          <label class="field">Mecanismo<select id="a-mec">${options(Object.values(store.state().orgs.flatMap(o => o.mecanismos || []).reduce((a, m) => (a[m] = { id: m, nome: mecNome(m) }, a), {})), '', { empty: 'Todos' })}</select></label>
          <label class="field">Área do contato<select id="a-area">${options(AREAS, '', { empty: 'Todas' })}</select></label>
          <label class="field full">Texto (nome, cargo, organização, tag)<input type="search" id="a-q"></label>
        </div>
        <div class="toolbar" style="margin:10px 0"><button class="btn" id="a-add">Adicionar contatos filtrados (<span id="a-n">0</span>)</button><button class="btn ghost danger" id="a-clear">Remover todos</button></div>
        <div class="table-wrap" style="max-height:300px;overflow:auto"><table><tbody id="dest"></tbody></table></div>
      </div>
    </div>
    <div style="display:grid;gap:16px;align-content:start">
      <div class="card" style="position:sticky;top:76px"><h3>Pré-visualização <span><button class="btn sm" id="pv-prev">‹</button> <span class="small muted" id="pv-who"></span> <button class="btn sm" id="pv-next">›</button></span></h3>
        <div class="small" style="margin-bottom:6px"><strong>Assunto:</strong> <span id="pv-subj"></span></div>
        <iframe class="preview-frame" id="pv" sandbox title="Pré-visualização do e-mail"></iframe>
        <div id="send-box" style="margin-top:14px"></div>
      </div>
    </div>
  </div>
  <div class="card" style="margin-top:16px"><h3>Resultados <span class="toolbar" style="margin:0"><button class="btn sm" id="chk">Verificar respostas no Gmail</button><button class="btn sm" id="exp">Exportar CSV</button></span></h3><div id="res"></div></div>`;

  const $ = s => view.querySelector(s);
  const status = () => { $('#st').innerHTML = stBadge(camp().status) + (locked() ? ' <span class="muted small">edição bloqueada durante o envio</span>' : ''); };

  // Campos simples
  const bindField = (sel, key, fn = v => v) => $(sel).addEventListener('input', e => { if (locked()) return; save({ [key]: fn(e.target.value) }); preview(); });
  bindField('#nome', 'nome'); bindField('#assunto', 'assunto'); bindField('#corpo', 'corpo'); bindField('#cc', 'cc');
  $('#modo').onchange = e => { save({ modo: e.target.value }); drawSend(); };
  ['evento', 'data_evento'].forEach(k => $('#v-' + k).addEventListener('input', e => { camp().vars[k] = e.target.value; store.touch('campanhas'); preview(); }));
  $('#mod').onchange = async e => {
    const m = store.get('modelos', e.target.value); if (!m) return;
    if ((camp().corpo || camp().assunto) && !await confirmDialog('Substituir assunto e corpo pelo modelo?', { ok: 'Substituir' })) { e.target.value = ''; return; }
    $('#assunto').value = m.assunto; $('#corpo').value = m.corpo; save({ assunto: m.assunto, corpo: m.corpo, modeloId: m.id }); preview(); e.target.value = '';
  };
  let lastFocus = $('#corpo');
  [$('#assunto'), $('#corpo')].forEach(el => el.addEventListener('focus', () => lastFocus = el));
  view.querySelector('.var-chips').onclick = e => {
    const k = e.target.dataset.var; if (!k) return;
    const el = lastFocus; const s = el.selectionStart ?? el.value.length;
    el.value = el.value.slice(0, s) + `{{${k}}}` + el.value.slice(el.selectionEnd ?? s);
    el.dispatchEvent(new Event('input')); el.focus(); el.selectionStart = el.selectionEnd = s + k.length + 4;
  };

  // Materiais
  const drawMats = () => {
    const mats = store.list('materiais');
    $('#mats').innerHTML = mats.length ? `<div class="list">${mats.map(m => `<label class="list-item check"><input type="checkbox" data-mat="${esc(m.id)}" ${camp().materiais.includes(m.id) ? 'checked' : ''}><div style="flex:1"><div class="title">${esc(m.titulo)}</div><div class="meta">${esc(m.categoria || '')} · ${m.url ? 'link' : ''}${m.url && m.arquivoId ? ' + ' : ''}${m.arquivoId ? 'arquivo' : ''}</div></div></label>`).join('')}</div>
      <label class="check small" style="margin-top:8px"><input type="checkbox" id="anexar" ${camp().anexarArquivos ? 'checked' : ''}> Anexar os arquivos guardados (senão, só os links entram no e-mail)</label>`
      : '<div class="muted">Nenhum material cadastrado. <a href="#/materiais">Cadastre apresentações, folders e notas técnicas</a>.</div>';
    $('#mats').onchange = e => {
      if (e.target.id === 'anexar') { save({ anexarArquivos: e.target.checked }); return; }
      const mid = e.target.dataset.mat; if (!mid) return;
      const set = new Set(camp().materiais); e.target.checked ? set.add(mid) : set.delete(mid); save({ materiais: [...set] }); preview();
    };
  };

  // Audiência
  const audiencia = () => {
    const q = norm($('#a-q').value), setor = $('#a-setor').value, ev = $('#a-ev').value, seg = $('#a-seg').value, reg = $('#a-reg').value, uf = $('#a-uf').value, est = $('#a-est').value, mec = $('#a-mec').value, area = $('#a-area').value;
    return store.list('contatos').filter(c => {
      const o = store.orgOf(c) || {};
      return isEmail(c.email) && !c.optout && (!seg || o.segmento === seg) && (!reg || REGIAO[o.uf] === reg) && (!uf || o.uf === uf) && (!est || (o.relacionamento || 'mapeada') === est) && (!setor || o.setor === setor) && (!ev || (o.evidencia || 'potencial') === ev) &&
        (!mec || (o.mecanismos || []).includes(mec)) && (!area || c.area === area) && (!q || norm([c.nome, c.cargo, o.nome, o.nomeFantasia, (o.tags || []).join(' ')].join(' ')).includes(q));
    });
  };
  const drawAud = () => { $('#a-n').textContent = audiencia().filter(c => !camp().destinatarios.includes(c.id)).length; };
  view.querySelectorAll('[id^="a-"]').forEach(el => el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', drawAud));
  $('#a-add').onclick = () => { if (locked()) return; const ids = new Set(camp().destinatarios); audiencia().forEach(c => ids.add(c.id)); save({ destinatarios: [...ids] }); drawDest(); drawAud(); preview(); drawSend(); };
  $('#a-clear').onclick = async () => { if (locked()) return; if (await confirmDialog('Remover todos os destinatários?', { ok: 'Remover', danger: true })) { save({ destinatarios: [] }); drawDest(); drawAud(); preview(); drawSend(); } };
  const drawDest = () => {
    const d = runner.destinatarios(camp());
    const ok = d.filter(x => !x.motivo).length;
    $('#dest-sum').textContent = `${ok} válidos de ${d.length}`;
    $('#dest').innerHTML = d.length ? d.map(({ contato: c, motivo }) => { const o = store.orgOf(c) || {}; return `<tr><td><div class="title">${esc(c.nome)}</div><div class="muted small">${esc(c.cargo || '')} · ${esc(o.nomeFantasia || o.nome || '')}</div></td><td class="small">${esc(c.email || '')} ${motivo ? `<span class="badge bad">${esc(motivo)}</span>` : ''}</td><td><button class="btn sm ghost" data-rm="${esc(c.id)}" aria-label="Remover">✕</button></td></tr>`; }).join('')
      : '<tr><td><div class="empty">Use os filtros acima para adicionar contatos, ou selecione contatos na página Contatos/Organizações.</div></td></tr>';
  };
  $('#dest').onclick = e => { const r = e.target.dataset.rm; if (r && !locked()) { save({ destinatarios: camp().destinatarios.filter(x => x !== r) }); drawDest(); drawAud(); preview(); drawSend(); } };

  // Pré-visualização
  const preview = () => {
    const ds = camp().destinatarios.map(i => store.get('contatos', i)).filter(Boolean);
    const sample = ds.length ? ds[((previewIdx % ds.length) + ds.length) % ds.length] : { nome: 'Ana Souza', cargo: 'Gerente de P&D', tratamento: 'Prezada Senhora', email: 'exemplo@empresa.com.br' };
    const mats = camp().materiais.map(i => store.get('materiais', i)).filter(Boolean);
    const m = compose(camp(), sample, { materiais: mats });
    $('#pv').srcdoc = m.html; $('#pv-subj').textContent = m.subject || '(sem assunto)';
    $('#pv-who').textContent = ds.length ? `${((previewIdx % ds.length) + ds.length) % ds.length + 1}/${ds.length} · ${sample.nome}` : 'exemplo';
  };
  $('#pv-prev').onclick = () => { previewIdx--; preview(); };
  $('#pv-next').onclick = () => { previewIdx++; preview(); };

  // Envio
  const drawSend = () => {
    const s = G.status(); const c = camp(); const conf = store.cfg();
    const env = store.list('envios').filter(e => e.campanhaId === id);
    const done = env.filter(e => ['enviado', 'rascunho', 'ignorado'].includes(e.status)).length;
    const total = c.destinatarios.length;
    const run = runner.isRunning(id);
    $('#send-box').innerHTML = `
      ${!conf.ponteUrl ? '<div class="callout warn"><a href="#/config">Conectar o e-mail do CIQUANTA</a></div>' : !s.conectado ? '<button class="btn primary" id="g-on" style="width:100%;justify-content:center">Conectar conta Google</button>' : `<div class="muted small">Remetente: <strong>${esc(s.email)}</strong></div>`}
      <div class="progress" style="margin:10px 0 6px"><span style="width:${pct(done, total)}%"></span></div>
      <div class="small muted">${done} de ${total} processados · enviados hoje: ${runner.enviadosHoje()}/${conf.limiteDiario}</div>
      <div class="toolbar" style="margin:10px 0 0">
        ${run ? `<button class="btn" id="pause">${runner.isRunning() && c.status === 'enviando' ? 'Pausar' : 'Retomar'}</button><button class="btn danger" id="cancel">Interromper</button>`
        : `<button class="btn" id="test" ${!s.conectado ? 'disabled' : ''}>Enviar teste para mim</button>
           <button class="btn primary" id="start" ${!s.conectado || !total ? 'disabled' : ''}>${c.modo === 'rascunho' ? 'Criar rascunhos' : done && done < total ? 'Continuar envio' : 'Iniciar envio'}</button>`}
      </div>
      ${!run ? `<details style="margin-top:10px"><summary class="small">Agendar envio</summary><div class="toolbar" style="margin-top:8px"><input type="datetime-local" id="ag" value="${esc(c.agendadaPara ? c.agendadaPara.slice(0, 16) : '')}" style="width:auto"><button class="btn sm" id="ag-ok">Agendar</button>${c.status === 'agendada' ? '<button class="btn sm ghost" id="ag-x">Cancelar agendamento</button>' : ''}</div>
        </details>` : ''}
      <div class="log" id="log" style="margin-top:10px">${esc(logText.join('\n')) || 'Registro do envio aparecerá aqui.'}</div>`;
    $('#g-on')?.addEventListener('click', async () => { try { await G.connect(); drawSend(); } catch (e) { toast(e.message, 'bad'); } });
    $('#test')?.addEventListener('click', sendTest);
    $('#start')?.addEventListener('click', start);
    $('#pause')?.addEventListener('click', () => { const p = camp().status === 'enviando'; runner.pause(p); camp().status = p ? 'pausada' : 'enviando'; store.touch('campanhas'); drawSend(); status(); });
    $('#cancel')?.addEventListener('click', () => runner.cancel());
    $('#ag-ok')?.addEventListener('click', () => { const v = $('#ag').value; if (!v) return; if (new Date(v) < new Date()) { toast('Escolha um horário futuro.', 'bad'); return; } save({ status: 'agendada', agendadaPara: new Date(v).toISOString() }); toast('Campanha agendada.', 'ok'); drawSend(); status(); });
    $('#ag-x')?.addEventListener('click', () => { save({ status: 'rascunho', agendadaPara: '' }); drawSend(); status(); });
  };
  const logText = [];
  const sendTest = async () => {
    try {
      const me = G.status().email; const conf = store.cfg();
      const ds = camp().destinatarios.map(i => store.get('contatos', i)).filter(Boolean);
      const sample = ds[0] || { nome: conf.remetenteNome || 'Teste', email: me };
      const mats = camp().materiais.map(i => store.get('materiais', i)).filter(Boolean);
      const m = compose(camp(), sample, { materiais: mats });
      await G.sendRaw(buildMime({ to: me, from: me, fromName: conf.remetenteNome, subject: '[TESTE] ' + m.subject, html: m.html }));
      toast(`Teste enviado para ${me}.`, 'ok');
    } catch (e) { toast(e.message, 'bad'); }
  };
  const start = async () => {
    const c = camp();
    if (!c.assunto || !c.corpo) { toast('Preencha assunto e corpo.', 'bad'); return; }
    const ok = runner.destinatarios(c).filter(x => !x.motivo).length;
    if (!await confirmDialog(c.modo === 'rascunho' ? `Criar ${ok} rascunho(s) no seu Gmail?` : `Enviar ${ok} e-mail(s) personalizados a partir de ${G.status().email}?`, { ok: c.modo === 'rascunho' ? 'Criar rascunhos' : 'Enviar' })) return;
    runner.run(id);
  };

  // Resultados
  const drawRes = () => {
    const env = store.list('envios').filter(e => e.campanhaId === id).sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    const cnt = k => env.filter(e => e.status === k).length;
    $('#res').innerHTML = env.length ? `<div class="tags" style="margin-bottom:10px"><span class="badge ok">${cnt('enviado')} enviados</span><span class="badge info">${env.filter(e => e.respondido).length} respostas</span><span class="badge gray">${cnt('rascunho')} rascunhos</span><span class="badge warn">${cnt('ignorado')} ignorados</span><span class="badge bad">${cnt('erro')} erros</span></div>
      <div class="table-wrap" style="max-height:360px;overflow:auto"><table><thead><tr><th>Contato</th><th>E-mail</th><th>Status</th><th>Data</th><th>Resposta</th></tr></thead><tbody>${env.map(e => { const c = store.get('contatos', e.contatoId); return `<tr><td>${esc(c?.nome || '—')}</td><td class="small">${esc(e.email)}</td><td>${e.status === 'enviado' ? '<span class="badge ok">enviado</span>' : e.status === 'erro' ? `<span class="badge bad" title="${esc(e.erro)}">erro</span> <span class="small muted">${esc(e.erro)}</span>` : e.status === 'ignorado' ? `<span class="badge warn">${esc(e.erro)}</span>` : '<span class="badge gray">rascunho</span>'}</td><td class="small">${fmtDateTime(e.data)}</td><td>${e.respondido ? '<span class="badge info">respondeu</span>' : e.threadId ? `<a class="small" target="_blank" rel="noopener" href="https://mail.google.com/mail/u/0/#all/${esc(e.threadId)}">abrir conversa</a>` : ''}</td></tr>`; }).join('')}</tbody></table></div>`
      : '<div class="empty">Nenhum envio ainda.</div>';
  };
  $('#chk').onclick = async e => { e.target.disabled = true; try { const r = await runner.checkReplies(id); toast(`${r.verificados} conversas verificadas, ${r.respostas} nova(s) resposta(s).`, 'ok'); drawRes(); } catch (err) { toast(err.message, 'bad'); } e.target.disabled = false; };
  $('#exp').onclick = () => download(`campanha-${id}.csv`, toCSV(store.list('envios').filter(e => e.campanhaId === id), [
    { label: 'contato', get: e => store.get('contatos', e.contatoId)?.nome }, { label: 'organizacao', get: e => store.orgOf(store.get('contatos', e.contatoId))?.nome },
    { label: 'email', key: 'email' }, { label: 'status', key: 'status' }, { label: 'erro', key: 'erro' }, { label: 'data', key: 'data' }, { label: 'respondeu', get: e => e.respondido ? 'sim' : '' },
  ]), 'text/csv;charset=utf-8');

  const offProg = runner.onProgress((cid, msg) => {
    if (cid !== id) return;
    if (msg.tipo === 'item') logText.unshift(`${new Date().toLocaleTimeString('pt-BR')}  ${msg.status.toUpperCase().padEnd(9)} ${msg.contato.email}${msg.erro ? '  — ' + msg.erro : ''}`);
    if (msg.tipo === 'fim') logText.unshift('— fim —');
    drawSend(); drawRes(); status();
  });
  const offAuth = G.onAuth(() => drawSend());

  drawMats(); drawDest(); drawAud(); preview(); drawSend(); drawRes(); status();
  return () => { offProg(); offAuth(); };
}
