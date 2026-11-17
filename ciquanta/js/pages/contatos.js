import * as store from '../store.js';
import { esc, norm, debounce, options, SEGMENTOS, UFS, isEmail, toCSV, download, parseCSV, readFile, toast, modal, uid, confirmDialog, TRATAMENTOS } from '../util.js';
import { openContatoForm, AREAS, openReuniaoForm } from '../components.js';
import { icon } from '../icons.js';
import { quickMail } from '../quickmail.js';

export async function render(view) {
  const f = { q: '', segmento: '', area: '', uf: '', email: '' };
  const sel = new Set();
  view.innerHTML = `
  <div class="section-head"><div><h2>Contatos</h2></div>
    <div class="toolbar" style="margin:0"><button class="btn" id="imp">Importar CSV</button><button class="btn" id="exp">Exportar CSV</button><button class="btn primary" id="novo">+ Novo contato</button></div></div>
  <div class="toolbar">
    <input type="search" class="grow" id="q" placeholder="Nome, cargo, e-mail, organização…">
    <select id="segmento">${options(SEGMENTOS, '', { empty: 'Segmento' })}</select>
    <select id="area">${options(AREAS, '', { empty: 'Área' })}</select>
    <select id="uf">${options(UFS, '', { empty: 'UF' })}</select>
    <select id="email"><option value="">E-mail: todos</option><option value="ok">Com e-mail válido</option><option value="sem">Sem e-mail</option><option value="optout">Descadastrados</option></select>
  </div>
  <div class="toolbar hidden" id="bulk"><strong id="bulk-n"></strong><button class="btn sm primary" id="bulk-camp">✉ Criar campanha</button><button class="btn sm danger" id="bulk-del">Excluir</button><button class="btn sm ghost" id="bulk-clear">Limpar</button></div>
  <div class="table-wrap"><table><thead><tr><th style="width:28px"><input type="checkbox" id="all" aria-label="Selecionar todos"></th><th>Nome</th><th>Organização</th><th>Cargo / área</th><th>E-mail</th><th>Último contato</th><th></th></tr></thead><tbody id="tb"></tbody></table></div>
  <p class="muted small" id="count"></p>`;

  const filtered = () => {
    const q = norm(f.q);
    const last = {}; store.list('interacoes').forEach(i => { if (i.contatoId && (!last[i.contatoId] || i.data > last[i.contatoId])) last[i.contatoId] = i.data; });
    return store.list('contatos').map(c => ({ c, o: store.orgOf(c) || {}, last: last[c.id] })).filter(({ c, o }) =>
      (!f.segmento || o.segmento === f.segmento) && (!f.area || c.area === f.area) && (!f.uf || o.uf === f.uf) &&
      (!f.email || (f.email === 'ok' ? isEmail(c.email) && !c.optout : f.email === 'sem' ? !isEmail(c.email) : c.optout)) &&
      (!q || norm([c.nome, c.cargo, c.email, o.nome, o.nomeFantasia, c.area].join(' ')).includes(q)))
      .sort((a, b) => a.c.nome.localeCompare(b.c.nome, 'pt-BR'));
  };
  const draw = () => {
    const l = filtered();
    view.querySelector('#tb').innerHTML = l.length ? l.map(({ c, o, last }) => `<tr>
      <td><input type="checkbox" data-sel="${esc(c.id)}" ${sel.has(c.id) ? 'checked' : ''} aria-label="Selecionar"></td>
      <td><div class="title">${esc(c.nome)}</div>${c.optout ? '<span class="badge bad">não deseja e-mails</span>' : ''}</td>
      <td>${o.id ? `<a href="#/org/${esc(o.id)}">${esc(o.nomeFantasia || o.nome)}</a><div class="muted small">${esc(store.setorCurto(o.setor))} ${o.uf ? '· ' + esc(o.uf) : ''}</div>` : '—'}</td>
      <td>${esc(c.cargo || '—')}<div class="muted small">${esc(c.area || '')}</div></td>
      <td>${isEmail(c.email) ? esc(c.email) : '<span class="badge warn">sem e-mail</span>'}</td>
      <td class="small">${last ? new Date(last).toLocaleDateString('pt-BR') : '<span class="muted">nunca</span>'}</td>
      <td class="nowrap"><button class="btn sm" data-mail="${esc(c.id)}" title="Enviar e-mail" ${!isEmail(c.email) || c.optout ? 'disabled' : ''}>${icon('mail', 14)}</button> <button class="btn sm" data-meet="${esc(c.id)}" title="Agendar reunião">${icon('reuniao', 14)}</button> <button class="btn sm" data-edit="${esc(c.id)}">Editar</button></td></tr>`).join('')
      : `<tr><td colspan="7"><div class="empty">${store.list('contatos').length ? 'Nenhum contato com esses filtros.' : 'Nenhum contato ainda. Cadastre a partir das organizações, importe um CSV ou use a Busca ativa.'}</div></td></tr>`;
    view.querySelector('#count').textContent = `${l.length} de ${store.list('contatos').length} contatos`;
    view.querySelector('#bulk').classList.toggle('hidden', !sel.size);
    view.querySelector('#bulk-n').textContent = `${sel.size} selecionado(s)`;
    view.querySelector('#all').checked = l.length > 0 && l.every(x => sel.has(x.c.id));
  };
  draw();
  view.querySelector('#q').addEventListener('input', debounce(e => { f.q = e.target.value; draw(); }));
  ['segmento', 'area', 'uf', 'email'].forEach(k => view.querySelector('#' + k).onchange = e => { f[k] = e.target.value; draw(); });
  view.querySelector('#tb').addEventListener('click', e => {
    const t = e.target.closest('[data-sel],[data-mail],[data-edit],[data-meet]'); if (!t) return;
    if (t.dataset.meet) { const c = store.get('contatos', t.dataset.meet); openReuniaoForm({ orgId: c.orgId, contatoIds: [c.id] }); return; }
    if (t.dataset.sel) { t.checked ? sel.add(t.dataset.sel) : sel.delete(t.dataset.sel); draw(); }
    if (t.dataset.mail) quickMail(store.get('contatos', t.dataset.mail));
    if (t.dataset.edit) openContatoForm(store.get('contatos', t.dataset.edit), draw);
  });
  view.querySelector('#all').onchange = e => { filtered().forEach(({ c }) => e.target.checked ? sel.add(c.id) : sel.delete(c.id)); draw(); };
  view.querySelector('#novo').onclick = () => { if (!store.list('orgs').length) { toast('Cadastre uma organização primeiro.', 'bad'); return; } openContatoForm({}, draw); };
  view.querySelector('#bulk-clear').onclick = () => { sel.clear(); draw(); };
  view.querySelector('#bulk-del').onclick = async () => { if (await confirmDialog(`Excluir ${sel.size} contato(s)?`, { ok: 'Excluir', danger: true })) { [...sel].forEach(id => store.remove('contatos', id)); sel.clear(); draw(); } };
  view.querySelector('#bulk-camp').onclick = () => {
    const camp = store.upsert('campanhas', { nome: `Campanha ${new Date().toLocaleDateString('pt-BR')}`, destinatarios: [...sel], status: 'rascunho', modo: 'enviar', assunto: '', corpo: '', materiais: [], vars: {} }, 'cmp');
    location.hash = `#/campanhas/${camp.id}`;
  };
  view.querySelector('#exp').onclick = () => download(`ciquanta-contatos-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(filtered(), [
    { label: 'nome', get: x => x.c.nome }, { label: 'tratamento', get: x => x.c.tratamento }, { label: 'cargo', get: x => x.c.cargo }, { label: 'area', get: x => x.c.area },
    { label: 'email', get: x => x.c.email }, { label: 'telefone', get: x => x.c.telefone }, { label: 'linkedin', get: x => x.c.linkedin },
    { label: 'organizacao', get: x => x.o.nome }, { label: 'segmento', get: x => x.o.segmento }, { label: 'uf', get: x => x.o.uf }, { label: 'descadastrado', get: x => x.c.optout ? 'sim' : '' }, { label: 'fonte', get: x => x.c.fonte },
  ]), 'text/csv;charset=utf-8');
  view.querySelector('#imp').onclick = () => importContatos(draw);
}

function importContatos(done) {
  const { el, close } = modal({ title: 'Importar contatos (CSV)', body: `
    <p>Colunas reconhecidas: <code>nome</code>, <code>email</code>, <code>cargo</code>, <code>area</code>, <code>telefone</code>, <code>linkedin</code>, <code>tratamento</code>, <code>organizacao</code>, <code>segmento</code>, <code>uf</code>, <code>fonte</code>.</p>
    
    <input type="file" accept=".csv,text/csv" id="file">`, footer: '<button class="btn" data-close>Fechar</button>' });
  el.querySelector('#file').onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    const rows = parseCSV(await readFile(file));
    let n = 0, u = 0, orgsNovas = 0;
    const pick = (r, ...ks) => { for (const k of ks) if (r[k]) return r[k]; return ''; };
    for (const r of rows) {
      const nome = pick(r, 'nome', 'name', 'contato'); if (!nome) continue;
      const orgNome = pick(r, 'organizacao', 'empresa', 'instituicao', 'orgao', 'company') || 'Sem organização';
      let org = store.findOrgByName(orgNome);
      if (!org) { org = { id: uid('org'), nome: orgNome, segmento: SEGMENTOS.find(s => norm(s) === norm(pick(r, 'segmento'))) || 'Empresa', uf: pick(r, 'uf').toUpperCase().slice(0, 2), relacionamento: 'mapeada', evidencia: 'potencial', mecanismos: [], origem: 'Importação CSV', criadoEm: new Date().toISOString() }; store.list('orgs').push(org); orgsNovas++; }
      const email = pick(r, 'email', 'e-mail', 'mail').toLowerCase();
      const trat = TRATAMENTOS.find(t => norm(t.id) === norm(pick(r, 'tratamento')))?.id;
      const d = { nome, orgId: org.id, email, cargo: pick(r, 'cargo', 'title'), area: AREAS.find(a => norm(a).includes(norm(pick(r, 'area')) || '#')) || '', telefone: pick(r, 'telefone', 'phone'), linkedin: pick(r, 'linkedin'), fonte: pick(r, 'fonte') || 'Importação CSV', ...(trat ? { tratamento: trat } : {}) };
      if (store.suprimido(email)) d.optout = true;
      const ex = email && store.list('contatos').find(c => norm(c.email) === norm(email));
      if (ex) { Object.entries(d).forEach(([k, v]) => { if (v) ex[k] = v; }); u++; } else { store.list('contatos').push({ id: uid('ct'), criadoEm: new Date().toISOString(), ...d }); n++; }
    }
    store.touch('contatos'); store.touch('orgs');
    toast(`${n} contato(s) novo(s), ${u} atualizado(s), ${orgsNovas} organização(ões) criada(s).`, 'ok'); close(); done();
  };
}
