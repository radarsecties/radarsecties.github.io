import * as store from '../store.js';
import { inscrever } from '../cadencia.js';
import { esc, norm, debounce, options, UFS, REGIAO, SEGMENTOS, RELACIONAMENTO, EVIDENCIA, relNome, toCSV, download, parseCSV, readFile, toast, confirmDialog, money, onlyDigits, modal, uid } from '../util.js';
import { openOrgForm, segBadge, relBadge, evBadge } from '../components.js';
import { loadMecanismos, mecNome } from '../email.js';
import { icon } from '../icons.js';
import { pontuar, contexto } from '../score.js';

export async function render(view, { params }) {
  const mecs = await loadMecanismos();
  const f = { q: params.get('q') || '', segmento: params.get('segmento') || '', setor: params.get('setor') || '', uf: params.get('uf') || '', regiao: '', rel: params.get('rel') || '',
    evidencia: params.get('evidencia') || '', prioridade: '', mecanismo: params.get('mecanismo') || '', sort: '_pot', dir: -1 };
  const sel = new Set();
  view.innerHTML = `
  <div class="section-head"><div><h2>Organizações</h2></div>
    <div class="toolbar" style="margin:0"><a class="btn" href="#/busca?aba=referencia">Importar mapeamento</a><button class="btn" id="imp">Importar CSV</button><button class="btn" id="exp">Exportar CSV</button><button class="btn primary" id="nova">${icon('mais', 16)} Nova organização</button></div></div>
  <div class="toolbar">
    <input type="search" class="grow" id="q" placeholder="Nome, cidade, tag, atuação" value="${esc(f.q)}">
    <select id="setor">${options(store.setoresLista().map(s => ({ id: s.id, nome: s.nome })), f.setor, { empty: 'Setor' })}</select>
    <select id="segmento">${options(SEGMENTOS, f.segmento, { empty: 'Segmento' })}</select>
    <select id="evidencia">${options(Object.entries(EVIDENCIA).map(([id, [nome]]) => ({ id, nome })), f.evidencia, { empty: 'Atuação quântica' })}</select>
    <select id="rel">${options(RELACIONAMENTO, f.rel, { empty: 'Relacionamento' })}</select>
    <select id="prioridade">${options(['A', 'B', 'C'].map(x => ({ id: x, nome: 'Prioridade ' + x })), '', { empty: 'Prioridade' })}</select>
    <select id="regiao">${options(['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'], '', { empty: 'Região' })}</select>
    <select id="uf">${options(UFS, f.uf, { empty: 'UF' })}</select>
    <select id="mecanismo">${options(Object.values(mecs).map(m => ({ id: m.id, nome: m.curto || m.nome })), f.mecanismo, { empty: 'Mecanismo' })}</select>
  </div>
  <div class="toolbar hidden" id="bulk"><strong id="bulk-n"></strong>
    <select id="bulk-rel">${options(RELACIONAMENTO, '', { empty: 'Mudar relacionamento…' })}</select>
    <select id="bulk-cad">${options(store.list('cadencias').filter(c => c.ativa).map(c => ({ id: c.id, nome: c.nome })), '', { empty: 'Inscrever contatos em cadência…' })}</select>
    <button class="btn sm" id="bulk-camp">${icon('campanhas', 14)} Campanha com os contatos</button>
    <button class="btn sm danger" id="bulk-del">Excluir</button><button class="btn sm ghost" id="bulk-clear">Limpar seleção</button></div>
  <div class="table-wrap"><table><thead><tr>
    <th style="width:28px"><input type="checkbox" id="all" aria-label="Selecionar todas"></th>
    <th class="sortable" data-s="nome">Organização</th><th class="sortable" data-s="setor">Setor</th><th class="sortable" data-s="evidencia">Atuação quântica</th>
    <th class="sortable" data-s="relacionamento">Relacionamento</th><th class="sortable" data-s="_pot" title="Pontuação de 0 a 100; passe o mouse sobre o número para ver os critérios">Potencial</th><th class="num">Contatos</th><th class="num sortable" data-s="_pipe">Pipeline</th>
  </tr></thead><tbody id="tb"></tbody></table></div>
  <p class="muted small" id="count"></p>`;

  const EVO = { confirmada: 0, indicios: 1, potencial: 2 };
  const filtered = () => {
    const q = norm(f.q);
    const ct = {}; store.list('contatos').forEach(c => ct[c.orgId] = (ct[c.orgId] || 0) + 1);
    const ctxS = contexto();
    const pp = {}; store.list('oportunidades').filter(o => !['contratada', 'perdida'].includes(o.etapa)).forEach(o => pp[o.orgId] = (pp[o.orgId] || 0) + store.pipelineValor(o));
    let l = store.list('orgs').filter(o =>
      (!f.segmento || o.segmento === f.segmento) && (!f.setor || o.setor === f.setor) && (!f.uf || o.uf === f.uf) && (!f.regiao || REGIAO[o.uf] === f.regiao) &&
      (!f.rel || (o.relacionamento || 'mapeada') === f.rel) && (!f.evidencia || (o.evidencia || 'potencial') === f.evidencia) && (!f.prioridade || o.prioridade === f.prioridade) &&
      (!f.mecanismo || (o.mecanismos || []).includes(f.mecanismo)) &&
      (!q || norm([o.nome, o.nomeFantasia, store.setorNome(o.setor), o.cidade, o.uf, (o.tags || []).join(' '), o.notas, o.atuacao, o.cnpj].join(' ')).includes(q)))
      .map(o => ({ o, ct: ct[o.id] || 0, pipe: pp[o.id] || 0, pot: pontuar(o, ctxS) }));
    const key = { prioridade: x => (x.o.prioridade || 'B') + (EVO[x.o.evidencia] ?? 2) + x.o.nome, nome: x => x.o.nome, setor: x => store.setorNome(x.o.setor), evidencia: x => (EVO[x.o.evidencia] ?? 2) + x.o.nome,
      relacionamento: x => RELACIONAMENTO.findIndex(r => r.id === (x.o.relacionamento || 'mapeada')) + x.o.nome, uf: x => (x.o.uf || 'ZZ') + x.o.nome, _pipe: x => x.pipe, _pot: x => x.pot.total }[f.sort];
    l.sort((a, b) => { const x = key(a), y = key(b); return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'pt-BR')) * f.dir; });
    return l;
  };
  const draw = () => {
    const l = filtered();
    view.querySelector('#tb').innerHTML = l.length ? l.slice(0, 600).map(({ o, ct, pipe, pot }) => `<tr class="row-link" data-id="${esc(o.id)}">
      <td><input type="checkbox" data-sel="${esc(o.id)}" ${sel.has(o.id) ? 'checked' : ''} aria-label="Selecionar"></td>
      <td><div class="title">${esc(o.nome)} ${o.prioridade === 'A' ? '<span class="prio" title="Prioridade A">A</span>' : ''}</div><div class="muted small">${esc(o.cidade || '')}${o.uf ? `, ${esc(o.uf)}` : ''}${o.site ? ` · ${esc(store.dominio(o.site))}` : ''}</div></td>
      <td><div>${esc(store.setorCurto(o.setor))}</div><div class="muted small">${esc(o.segmento || '')}</div></td><td>${evBadge(o.evidencia)}</td><td>${relBadge(o.relacionamento)}</td><td><span class="pot" title="${esc(pot.motivos.map(m => `+${m[0]} ${m[1]}`).join('\n'))}"><i><b style="width:${pot.total}%"></b></i>${pot.total}</span></td>
      <td class="num">${ct || '<span class="muted">0</span>'}</td><td class="num nowrap">${pipe ? money(pipe) : '<span class="muted">—</span>'}</td></tr>`).join('')
      : `<tr><td colspan="10"><div class="empty">${store.list('orgs').length ? 'Nenhuma organização com esses filtros.' : 'Nenhuma organização ainda. <a href="#/busca?aba=referencia">Importe o mapeamento setorial</a> ou use a <a href="#/busca">busca por CNPJ</a>.'}</div></td></tr>`;
    view.querySelector('#count').textContent = `${l.length} de ${store.list('orgs').length} organizações${l.length > 600 ? ' (exibindo 600; use os filtros)' : ''}`;
    view.querySelector('#bulk').classList.toggle('hidden', !sel.size);
    view.querySelector('#bulk-n').textContent = `${sel.size} selecionada(s)`;
    view.querySelector('#all').checked = l.length > 0 && l.every(x => sel.has(x.o.id));
  };
  draw();

  view.querySelector('#q').addEventListener('input', debounce(e => { f.q = e.target.value; draw(); }));
  ['segmento', 'setor', 'uf', 'regiao', 'rel', 'evidencia', 'prioridade', 'mecanismo'].forEach(k => view.querySelector('#' + k).onchange = e => { f[k] = e.target.value; draw(); });
  view.querySelectorAll('th.sortable').forEach(th => th.onclick = () => { const s = th.dataset.s; f.dir = f.sort === s ? -f.dir : (s === '_pipe' || s === '_pot' ? -1 : 1); f.sort = s; draw(); });
  view.querySelector('#tb').addEventListener('click', e => {
    const cb = e.target.closest('[data-sel]');
    if (cb) { cb.checked ? sel.add(cb.dataset.sel) : sel.delete(cb.dataset.sel); draw(); return; }
    const tr = e.target.closest('tr[data-id]'); if (tr && !e.target.closest('a,input')) location.hash = `#/org/${tr.dataset.id}`;
  });
  view.querySelector('#all').onchange = e => { filtered().forEach(({ o }) => e.target.checked ? sel.add(o.id) : sel.delete(o.id)); draw(); };
  view.querySelector('#nova').onclick = () => openOrgForm({}, o => location.hash = `#/org/${o.id}`);
  view.querySelector('#bulk-cad').onchange = e => {
    const id = e.target.value; if (!id) return; e.target.value = '';
    const cts = store.list('contatos').filter(c => sel.has(c.orgId) && c.email && !c.optout).map(c => c.id);
    if (!cts.length) { toast('As organizações selecionadas ainda não têm contatos com e-mail. Use "Encontrar contatos" na ficha de cada uma.', 'bad'); return; }
    const r = inscrever(id, cts);
    toast(`${r.novos} contato(s) inscrito(s) na cadência${r.ignorados ? `, ${r.ignorados} já estavam em sequência ou pediram descadastro` : ''}.`, 'ok');
  };
  view.querySelector('#bulk-clear').onclick = () => { sel.clear(); draw(); };
  view.querySelector('#bulk-rel').onchange = e => { const v = e.target.value; if (!v) return; store.list('orgs').forEach(o => { if (sel.has(o.id)) o.relacionamento = v; }); store.touch('orgs'); toast(`${sel.size} organização(ões): ${relNome(v)}.`, 'ok'); e.target.value = ''; draw(); };
  view.querySelector('#bulk-del').onclick = async () => { if (!await confirmDialog(`Excluir ${sel.size} organização(ões) com contatos, oportunidades e histórico?`, { ok: 'Excluir', danger: true })) return; const desfazer = [...sel].map(id => store.remove('orgs', id)); const n = sel.size; sel.clear(); draw(); toast(`${n} organização(ões) excluída(s).`, '', { acao: 'Desfazer', onAcao: () => { desfazer.reverse().forEach(f => f()); draw(); } }); };
  view.querySelector('#bulk-camp').onclick = () => {
    const ids = store.list('contatos').filter(c => sel.has(c.orgId)).map(c => c.id);
    if (!ids.length) { toast('As organizações selecionadas ainda não têm contatos.', 'bad'); return; }
    const camp = store.upsert('campanhas', { nome: `Campanha ${new Date().toLocaleDateString('pt-BR')}`, destinatarios: ids, status: 'rascunho', modo: 'enviar', assunto: '', corpo: '', materiais: [], vars: {} }, 'cmp');
    location.hash = `#/campanhas/${camp.id}`;
  };
  view.querySelector('#exp').onclick = () => download(`ciquanta-organizacoes-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(filtered().map(x => x.o), [
    { label: 'nome', key: 'nome' }, { label: 'nome_fantasia', key: 'nomeFantasia' }, { label: 'cnpj', key: 'cnpj' }, { label: 'segmento', key: 'segmento' }, { label: 'setor', get: o => store.setorNome(o.setor) },
    { label: 'atuacao_quantica', get: o => (EVIDENCIA[o.evidencia] || EVIDENCIA.potencial)[0] }, { label: 'relacionamento', get: o => relNome(o.relacionamento) }, { label: 'prioridade', key: 'prioridade' },
    { label: 'uf', key: 'uf' }, { label: 'cidade', key: 'cidade' }, { label: 'site', key: 'site' }, { label: 'email', key: 'email' }, { label: 'telefone', key: 'telefone' },
    { label: 'mecanismos', get: o => (o.mecanismos || []).map(mecNome) }, { label: 'atuacao', key: 'atuacao' }, { label: 'tags', key: 'tags' }, { label: 'notas', key: 'notas' },
  ]), 'text/csv;charset=utf-8');
  view.querySelector('#imp').onclick = () => importOrgs(draw);
}

function importOrgs(done) {
  const { el, close } = modal({ title: 'Importar organizações (CSV)', body: `
    <p>Primeira linha com os nomes das colunas, separador <code>;</code> ou <code>,</code>. Colunas reconhecidas: <code>nome</code>, <code>nome_fantasia</code>, <code>cnpj</code>, <code>segmento</code>, <code>setor</code>, <code>uf</code>, <code>cidade</code>, <code>site</code>, <code>email</code>, <code>telefone</code>, <code>tags</code>, <code>notas</code>.</p>
    
    <input type="file" accept=".csv,text/csv" id="file">`, footer: '<button class="btn" data-close>Fechar</button>' });
  el.querySelector('#file').onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    const rows = parseCSV(await readFile(file));
    let novos = 0, atual = 0;
    const pick = (r, ...ks) => { for (const k of ks) if (r[k]) return r[k]; return ''; };
    const setores = store.setoresLista();
    for (const r of rows) {
      const nome = pick(r, 'nome', 'razao social', 'razao_social', 'empresa', 'organizacao'); if (!nome) continue;
      const cnpj = onlyDigits(pick(r, 'cnpj'));
      const ex = (cnpj && store.findOrgByCNPJ(cnpj)) || store.findOrgByName(nome);
      const st = norm(pick(r, 'setor'));
      const d = { nome, nomeFantasia: pick(r, 'nome_fantasia', 'nome fantasia'), cnpj, segmento: SEGMENTOS.find(s => norm(s) === norm(pick(r, 'segmento'))) || 'Empresa',
        setor: st ? (setores.find(s => norm(s.nome) === st || norm(s.curto) === st || s.id === st)?.id || '') : '', uf: pick(r, 'uf', 'estado').toUpperCase().slice(0, 2),
        cidade: pick(r, 'cidade', 'municipio'), site: pick(r, 'site', 'website', 'url'), email: pick(r, 'email', 'e-mail'), telefone: pick(r, 'telefone', 'fone'),
        tags: pick(r, 'tags') ? pick(r, 'tags').split(/[;,]/).map(s => s.trim()).filter(Boolean) : [], notas: pick(r, 'notas', 'observacoes'), origem: 'Importação CSV' };
      Object.keys(d).forEach(k => { if (!d[k] || (Array.isArray(d[k]) && !d[k].length)) delete d[k]; });
      if (ex) { Object.assign(ex, d); atual++; } else { store.list('orgs').push({ id: uid('org'), relacionamento: 'mapeada', evidencia: 'potencial', prioridade: 'B', mecanismos: [], criadoEm: new Date().toISOString(), ...d }); novos++; }
    }
    store.touch('orgs'); toast(`${novos} nova(s), ${atual} atualizada(s).`, 'ok'); close(); done();
  };
}
