import * as store from '../store.js';
import { esc, norm, debounce, options, UFS, REGIAO, SEGMENTOS, ESTAGIOS, toCSV, download, parseCSV, readFile, toast, confirmDialog, money, estagioNome, onlyDigits, modal, uid } from '../util.js';
import { openOrgForm, segBadge, estBadge } from '../components.js';
import { loadMecanismos, mecNome, mecCurto } from '../email.js';

export async function render(view, { params }) {
  const mecs = await loadMecanismos();
  const f = { q: params.get('q') || '', segmento: params.get('segmento') || '', uf: params.get('uf') || '', regiao: '', estagio: params.get('estagio') || '', mecanismo: params.get('mecanismo') || '', sort: 'nome', dir: 1 };
  const sel = new Set();

  view.innerHTML = `
  <div class="section-head"><div><h2>Organizações</h2><p>Empresas, fomentadores, autoridades e ICTs acompanhados pelo CIQuanta. Clique numa linha para ver contatos, histórico e mecanismos.</p></div>
    <div class="toolbar" style="margin:0">
      <button class="btn" id="imp">Importar CSV</button><button class="btn" id="exp">Exportar CSV</button>
      <button class="btn primary" id="nova">+ Nova organização</button></div></div>
  <div class="toolbar">
    <input type="search" class="grow" id="q" placeholder="Buscar por nome, setor, cidade, tag…" value="${esc(f.q)}">
    <select id="segmento">${options(SEGMENTOS, f.segmento, { empty: 'Segmento' })}</select>
    <select id="regiao">${options(['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'], '', { empty: 'Região' })}</select>
    <select id="uf">${options(UFS, f.uf, { empty: 'UF' })}</select>
    <select id="estagio">${options(ESTAGIOS, f.estagio, { empty: 'Estágio' })}</select>
    <select id="mecanismo">${options(Object.values(mecs).map(m => ({ id: m.id, nome: m.nome })), f.mecanismo, { empty: 'Mecanismo' })}</select>
  </div>
  <div class="toolbar hidden" id="bulk"><strong id="bulk-n"></strong>
    <select id="bulk-est">${options(ESTAGIOS, '', { empty: 'Mover para estágio…' })}</select>
    <button class="btn sm" id="bulk-camp">✉ Criar campanha com os contatos</button>
    <button class="btn sm danger" id="bulk-del">Excluir</button>
    <button class="btn sm ghost" id="bulk-clear">Limpar seleção</button></div>
  <div class="table-wrap"><table><thead><tr>
    <th style="width:28px"><input type="checkbox" id="all" aria-label="Selecionar todas"></th>
    <th class="sortable" data-s="nome">Organização</th><th class="sortable" data-s="segmento">Segmento</th><th class="sortable" data-s="setor">Setor</th>
    <th class="sortable" data-s="uf">UF</th><th class="sortable" data-s="estagio">Estágio</th><th>Contatos</th><th>Mecanismos</th><th class="sortable" data-s="potencial">Potencial</th>
  </tr></thead><tbody id="tb"></tbody></table></div>
  <p class="muted small" id="count"></p>`;

  const filtered = () => {
    const q = norm(f.q);
    const ct = {}; store.list('contatos').forEach(c => ct[c.orgId] = (ct[c.orgId] || 0) + 1);
    let l = store.list('orgs').filter(o =>
      (!f.segmento || o.segmento === f.segmento) && (!f.uf || o.uf === f.uf) && (!f.regiao || REGIAO[o.uf] === f.regiao) &&
      (!f.estagio || (o.estagio || 'prospeccao') === f.estagio) && (!f.mecanismo || (o.mecanismos || []).includes(f.mecanismo)) &&
      (!q || norm([o.nome, o.nomeFantasia, o.setor, o.cidade, o.uf, (o.tags || []).join(' '), o.notas, o.cnpj].join(' ')).includes(q)));
    l = l.map(o => ({ ...o, _ct: ct[o.id] || 0 }));
    l.sort((a, b) => { const k = f.sort; const x = k === 'potencial' ? (a[k] || 0) - (b[k] || 0) : String(a[k] || '').localeCompare(String(b[k] || ''), 'pt-BR'); return x * f.dir; });
    return l;
  };
  const draw = () => {
    const l = filtered();
    view.querySelector('#tb').innerHTML = l.length ? l.map(o => `<tr class="row-link" data-id="${esc(o.id)}">
      <td><input type="checkbox" data-sel="${esc(o.id)}" ${sel.has(o.id) ? 'checked' : ''} aria-label="Selecionar"></td>
      <td><div class="title">${esc(o.nome)}</div><div class="muted small">${esc(o.cidade || '')}${o.site ? ` · ${esc(o.site.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}` : ''}</div></td>
      <td>${segBadge(o.segmento)}</td><td>${esc(o.setor || '—')}</td><td>${esc(o.uf || '—')}</td><td>${estBadge(o.estagio)}</td>
      <td>${o._ct || '<span class="muted">0</span>'}</td>
      <td><div class="tags">${(o.mecanismos || []).slice(0, 3).map(m => `<span class="badge gray">${esc(mecCurto(m))}</span>`).join('')}${(o.mecanismos || []).length > 3 ? `<span class="badge gray">+${o.mecanismos.length - 3}</span>` : ''}</div></td>
      <td class="nowrap">${o.potencial ? money(o.potencial) : '<span class="muted">—</span>'}</td></tr>`).join('')
      : `<tr><td colspan="9"><div class="empty">${store.list('orgs').length ? 'Nenhuma organização com esses filtros.' : 'Nenhuma organização ainda. <a href="#/busca?aba=referencia">Importe a base de referência</a> ou use a <a href="#/busca">busca ativa por CNPJ</a>.'}</div></td></tr>`;
    view.querySelector('#count').textContent = `${l.length} de ${store.list('orgs').length} organizações`;
    view.querySelector('#bulk').classList.toggle('hidden', !sel.size);
    view.querySelector('#bulk-n').textContent = `${sel.size} selecionada(s)`;
    view.querySelector('#all').checked = l.length > 0 && l.every(o => sel.has(o.id));
  };
  draw();

  view.querySelector('#q').addEventListener('input', debounce(e => { f.q = e.target.value; draw(); }));
  ['segmento', 'uf', 'regiao', 'estagio', 'mecanismo'].forEach(k => view.querySelector('#' + k).onchange = e => { f[k] = e.target.value; draw(); });
  view.querySelectorAll('th.sortable').forEach(th => th.onclick = () => { const s = th.dataset.s; f.dir = f.sort === s ? -f.dir : 1; f.sort = s; draw(); });
  view.querySelector('#tb').addEventListener('click', e => {
    const cb = e.target.closest('[data-sel]');
    if (cb) { cb.checked ? sel.add(cb.dataset.sel) : sel.delete(cb.dataset.sel); draw(); return; }
    const tr = e.target.closest('tr[data-id]'); if (tr && !e.target.closest('a,input')) location.hash = `#/org/${tr.dataset.id}`;
  });
  view.querySelector('#all').onchange = e => { filtered().forEach(o => e.target.checked ? sel.add(o.id) : sel.delete(o.id)); draw(); };
  view.querySelector('#nova').onclick = () => openOrgForm({}, o => location.hash = `#/org/${o.id}`);
  view.querySelector('#bulk-clear').onclick = () => { sel.clear(); draw(); };
  view.querySelector('#bulk-est').onchange = e => { const v = e.target.value; if (!v) return; store.list('orgs').forEach(o => { if (sel.has(o.id)) o.estagio = v; }); store.touch('orgs'); toast(`${sel.size} movida(s) para ${estagioNome(v)}.`, 'ok'); e.target.value = ''; draw(); };
  view.querySelector('#bulk-del').onclick = async () => { if (!await confirmDialog(`Excluir ${sel.size} organização(ões) e seus contatos e histórico?`, { ok: 'Excluir', danger: true })) return; [...sel].forEach(id => store.remove('orgs', id)); sel.clear(); draw(); };
  view.querySelector('#bulk-camp').onclick = () => {
    const ids = store.list('contatos').filter(c => sel.has(c.orgId)).map(c => c.id);
    if (!ids.length) { toast('As organizações selecionadas ainda não têm contatos.', 'bad'); return; }
    const camp = store.upsert('campanhas', { nome: `Campanha ${new Date().toLocaleDateString('pt-BR')}`, destinatarios: ids, status: 'rascunho', modo: 'enviar', assunto: '', corpo: '', materiais: [] }, 'cmp');
    location.hash = `#/campanhas/${camp.id}`;
  };
  view.querySelector('#exp').onclick = () => {
    const l = filtered();
    download(`ciquanta-organizacoes-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(l, [
      { label: 'nome', key: 'nome' }, { label: 'nome_fantasia', key: 'nomeFantasia' }, { label: 'cnpj', key: 'cnpj' }, { label: 'segmento', key: 'segmento' }, { label: 'setor', key: 'setor' },
      { label: 'uf', key: 'uf' }, { label: 'cidade', key: 'cidade' }, { label: 'site', key: 'site' }, { label: 'email', key: 'email' }, { label: 'telefone', key: 'telefone' },
      { label: 'estagio', get: o => estagioNome(o.estagio) }, { label: 'mecanismos', get: o => (o.mecanismos || []).map(mecNome) }, { label: 'potencial', key: 'potencial' },
      { label: 'tags', key: 'tags' }, { label: 'responsavel', key: 'responsavel' }, { label: 'notas', key: 'notas' },
    ]), 'text/csv;charset=utf-8');
  };
  view.querySelector('#imp').onclick = () => importOrgs(draw);
}

function importOrgs(done) {
  const { el, close } = modal({ title: 'Importar organizações (CSV)', body: `
    <p>Colunas reconhecidas (cabeçalho na primeira linha, separador <code>;</code> ou <code>,</code>): <code>nome</code>, <code>nome_fantasia</code>, <code>cnpj</code>, <code>segmento</code>, <code>setor</code>, <code>uf</code>, <code>cidade</code>, <code>site</code>, <code>email</code>, <code>telefone</code>, <code>tags</code>, <code>notas</code>.</p>
    <p class="muted small">Dica: listas públicas do MCTI (beneficiárias da Lei do Bem, empresas habilitadas na Lei de TICs) podem ser convertidas em planilha e importadas aqui. Organizações com mesmo CNPJ ou mesmo nome são atualizadas, não duplicadas.</p>
    <input type="file" accept=".csv,text/csv" id="file">`,
    footer: '<button class="btn" data-close>Fechar</button>' });
  el.querySelector('#file').onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    const rows = parseCSV(await readFile(file));
    let novos = 0, atual = 0;
    const pick = (r, ...ks) => { for (const k of ks) if (r[k]) return r[k]; return ''; };
    for (const r of rows) {
      const nome = pick(r, 'nome', 'razao social', 'razao_social', 'empresa', 'organizacao'); if (!nome) continue;
      const cnpj = onlyDigits(pick(r, 'cnpj'));
      const ex = (cnpj && store.findOrgByCNPJ(cnpj)) || store.findOrgByName(nome);
      const seg = SEGMENTOS.find(s => norm(s) === norm(pick(r, 'segmento'))) || 'Empresa';
      const d = { nome, nomeFantasia: pick(r, 'nome_fantasia', 'nome fantasia'), cnpj, segmento: seg, setor: pick(r, 'setor', 'atividade'), uf: pick(r, 'uf', 'estado').toUpperCase().slice(0, 2),
        cidade: pick(r, 'cidade', 'municipio'), site: pick(r, 'site', 'website', 'url'), email: pick(r, 'email', 'e-mail'), telefone: pick(r, 'telefone', 'fone'),
        tags: pick(r, 'tags') ? pick(r, 'tags').split(/[;,]/).map(s => s.trim()).filter(Boolean) : [], notas: pick(r, 'notas', 'observacoes'), origem: 'Importação CSV' };
      Object.keys(d).forEach(k => { if (!d[k] || (Array.isArray(d[k]) && !d[k].length)) delete d[k]; });
      if (ex) { Object.assign(ex, d); atual++; } else { store.list('orgs').push({ id: uid('org'), estagio: 'prospeccao', mecanismos: [], criadoEm: new Date().toISOString(), ...d }); novos++; }
    }
    store.touch('orgs');
    toast(`${novos} nova(s), ${atual} atualizada(s).`, 'ok'); close(); done();
  };
}
