import * as store from '../store.js';
import { esc, toast, options, UFS, SEGMENTOS, norm, debounce, fmtCNPJ, onlyDigits, validCNPJ, sleep, money, isEmail, safeUrl } from '../util.js';
import { consultarCNPJ, paraOrganizacao } from '../cnpj.js';
import { sugerirMecanismos, linksProspeccao } from '../dominio.js';
import { fromRef } from './setores.js';
import { loadMecanismos, mecNome } from '../email.js';
import * as G from '../google.js';
import { carregarPesquisa, todasPessoas, linhaPessoa, ligarPessoas, adicionarContato } from '../pesquisa.js';

const ABAS = [['pesquisa', 'Pessoas de P&D'], ['referencia', 'Mapeamento setorial'], ['cnpj', 'Consulta CNPJ'], ['lote', 'CNPJs em lote'], ['prospeccao', 'Prospecção guiada'], ['gmail', 'Contatos no Gmail']];

export async function render(view, { params }) {
  const mecs = await loadMecanismos();
  let aba = params.get('aba') || 'pesquisa';
  view.innerHTML = `<div class="section-head"><div><h2>Busca ativa</h2></div></div>
    <div class="tabs">${ABAS.map(([k, l]) => `<button data-aba="${k}" class="${aba === k ? 'active' : ''}">${l}</button>`).join('')}</div><div id="aba"></div>`;
  const A = view.querySelector('#aba');
  const go = k => { aba = k; view.querySelectorAll('[data-aba]').forEach(b => b.classList.toggle('active', b.dataset.aba === k)); ({ cnpj, lote, prospeccao, referencia, gmail, pesquisa })[k](A, mecs); };
  view.querySelectorAll('[data-aba]').forEach(b => b.onclick = () => go(b.dataset.aba));
  go(aba);
}

function addOrg(dados, { abrir = true } = {}) {
  const ex = (dados.cnpj && store.findOrgByCNPJ(dados.cnpj)) || store.findOrgByName(dados.nome);
  if (ex) { Object.entries(dados).forEach(([k, v]) => { if (v && (k === 'receita' || !ex[k] || (Array.isArray(ex[k]) && !ex[k].length))) ex[k] = v; }); store.touch('orgs'); if (abrir) location.hash = `#/org/${ex.id}`; return { org: ex, novo: false }; }
  const org = store.upsert('orgs', { segmento: 'Empresa', relacionamento: 'mapeada', evidencia: 'potencial', prioridade: 'B', ...dados, mecanismos: dados.mecanismos?.length ? dados.mecanismos : sugerirMecanismos({ segmento: 'Empresa', ...dados }) }, 'org');
  if (abrir) location.hash = `#/org/${org.id}`;
  return { org, novo: true };
}

async function pesquisa(A) {
  await carregarPesquisa();
  const todas = todasPessoas(), f = { q: '', quant: false, email: false, setor: '' };
  const setores = [...new Set(todas.map(p => p.org.setor).filter(Boolean))].map(id => ({ id, nome: store.setorCurto(id) })).sort((a, b) => a.nome.localeCompare(b.nome));
  A.innerHTML = `<div class="toolbar"><input class="grow" type="search" id="pq" placeholder="Nome, organização ou tema">
    <select id="ps"><option value="">Todos os setores</option>${options(setores, '')}</select>
    <label class="check"><input type="checkbox" id="pqt"> Computação quântica</label><label class="check"><input type="checkbox" id="pem"> Com e-mail profissional</label>
    <button class="btn" id="padd">Adicionar os que têm e-mail</button></div><div id="pr"></div>`;
  const R = A.querySelector('#pr');
  const filtrar = () => todas.filter(p => (!f.quant || p.quantico) && (!f.email || p.email) && (!f.setor || p.org.setor === f.setor) && (!f.q || norm(`${p.nome} ${p.org.nome} ${p.org.nomeFantasia || ''} ${(p.temas || []).join(' ')} ${p.cargo || ''}`).includes(norm(f.q))))
    .sort((a, b) => (b.relevancia || 35) - (a.relevancia || 35));
  const draw = () => {
    const l = filtrar();
    R.innerHTML = l.length ? `<p class="muted small">${l.length} pessoa(s) em ${new Set(l.map(p => p.org.id)).size} organização(ões) · ${l.filter(p => p.quantico).length} em computação quântica · ${l.filter(p => p.email).length} com e-mail profissional público</p><div class="pessoas">${l.slice(0, 300).map(p => linhaPessoa(p, { comOrg: true })).join('')}</div>`
      : `<div class="empty">${todas.length ? 'Nenhuma pessoa com esses filtros.' : 'As pessoas de P&D aparecem aqui depois da coleta diária (produção científica na OpenAlex, ORCID e lideranças citadas em fontes públicas).'}</div>`;
    ligarPessoas(R, l, draw);
  };
  const deb = debounce(draw, 180);
  A.querySelector('#pq').oninput = e => { f.q = e.target.value; deb(); };
  A.querySelector('#ps').onchange = e => { f.setor = e.target.value; draw(); };
  A.querySelector('#pqt').onchange = e => { f.quant = e.target.checked; draw(); };
  A.querySelector('#pem').onchange = e => { f.email = e.target.checked; draw(); };
  A.querySelector('#padd').onclick = () => { const n = filtrar().filter(p => p.email).map(adicionarContato).filter(Boolean).length; toast(n ? `${n} pessoa(s) adicionada(s) aos contatos.` : 'Todas as pessoas com e-mail já estão nos contatos.', n ? 'ok' : ''); draw(); };
  draw();
}

function cnpj(A, mecs) {
  A.innerHTML = `<div class="grid g2">
    <div class="card"><h3>Consultar CNPJ na Receita Federal</h3>
      <form id="f" class="toolbar" style="margin:0"><input type="text" class="grow" id="c" placeholder="00.000.000/0000-00" inputmode="numeric" autocomplete="off"><button class="btn primary">Consultar</button></form>
      
      <div id="r"></div></div>
    <div class="card"><h3>Como encontrar o contato certo</h3><ol class="steps">
      <li><strong>Empresa:</strong> consulte o CNPJ para confirmar dados cadastrais, setor (CNAE) e porte.</li>
      <li><strong>Mecanismo:</strong> o sistema sugere os incentivos aplicáveis (ex.: energia → PD&I ANEEL; eletrônicos → Lei de TICs).</li>
      <li><strong>Pessoa:</strong> na página da organização, aba <em>Busca ativa de contatos</em>, há buscas prontas no LinkedIn, no Google, nos relatórios anuais e nas listas do MCTI.</li>
      <li><strong>Registro:</strong> cadastre o contato com a fonte. Use só dados institucionais públicos e respeite pedidos de descadastro (LGPD).</li>
    </ol></div></div>`;
  A.querySelector('#c').addEventListener('input', e => { const d = onlyDigits(e.target.value); if (d.length === 14) e.target.value = fmtCNPJ(d); });
  A.querySelector('#f').onsubmit = async e => {
    e.preventDefault(); const R = A.querySelector('#r'); const c = A.querySelector('#c').value;
    if (!validCNPJ(c)) { R.innerHTML = '<div class="callout warn">CNPJ inválido. Confira os 14 dígitos.</div>'; return; }
    R.innerHTML = '<div class="empty">Consultando…</div>';
    try {
      const r = await consultarCNPJ(c);
      const dados = paraOrganizacao(r);
      const sug = sugerirMecanismos({ ...dados, segmento: 'Empresa' });
      const ex = store.findOrgByCNPJ(r.cnpj);
      R.innerHTML = `<div class="callout" style="margin-top:10px">
        <div class="title" style="font-size:16px">${esc(r.razao)}</div><div class="muted">${esc(r.fantasia || '')} · ${esc(fmtCNPJ(r.cnpj))} · ${esc(r.situacao)}</div>
        <div class="grid g2 small" style="margin-top:10px">
          <div><span class="muted">CNAE</span><br>${esc(r.cnae)} ${esc(r.cnaeDesc)}<br><span class="muted">Setor sugerido:</span> ${esc(store.setorNome(dados.setor) || '—')}</div><div><span class="muted">Porte · capital</span><br>${esc(r.porte || '—')} · ${r.capital ? money(r.capital) : '—'}</div>
          <div><span class="muted">Local</span><br>${esc(r.municipio)}/${esc(r.uf)}</div><div><span class="muted">E-mail · telefone</span><br>${esc(r.email || '—')} · ${esc(r.telefone || '—')}</div>
          <div class="span2"><span class="muted">Administradores</span><br>${r.socios.slice(0, 8).map(s => `${esc(s.nome)} <span class="muted">(${esc(s.qualificacao)})</span>`).join('<br>') || '—'}</div>
          <div class="span2"><span class="muted">Mecanismos sugeridos</span><div class="tags" style="margin-top:4px">${sug.map(id => `<span class="badge">${esc(mecNome(id))}</span>`).join('')}</div></div>
        </div>
        <div class="toolbar" style="margin:12px 0 0">${ex ? `<a class="btn" href="#/org/${esc(ex.id)}">Já está no CRM: abrir</a><button class="btn primary" id="add">Atualizar dados no CRM</button>` : '<button class="btn primary" id="add">Adicionar ao CRM</button>'}</div></div>`;
      R.querySelector('#add').onclick = () => { addOrg({ ...dados, origem: 'Busca CNPJ' }); toast('Organização salva no CRM.', 'ok'); };
    } catch (err) { R.innerHTML = `<div class="callout warn">${esc(err.message)}</div>`; }
  };
}

function lote(A) {
  A.innerHTML = `<div class="card"><h3>Enriquecer uma lista de CNPJs</h3>
    
    <textarea id="t" placeholder="33.000.167/0001-01&#10;..." style="min-height:140px"></textarea>
    <div class="toolbar" style="margin-top:10px"><button class="btn primary" id="go">Consultar</button><button class="btn hidden" id="stop">Parar</button><button class="btn hidden" id="imp">Adicionar todos ao CRM</button><span class="muted small" id="st"></span></div>
    <div class="table-wrap"><table><thead><tr><th>CNPJ</th><th>Razão social</th><th>UF</th><th>CNAE</th><th>E-mail</th><th>Status</th></tr></thead><tbody id="tb"><tr><td colspan="6"><div class="empty">Resultados aparecerão aqui.</div></td></tr></tbody></table></div></div>`;
  let stop = false; const ok = [];
  A.querySelector('#stop').onclick = () => { stop = true; };
  A.querySelector('#go').onclick = async () => {
    const list = [...new Set((A.querySelector('#t').value.match(/\d[\d./-]{12,18}\d/g) || []).map(onlyDigits).filter(x => x.length === 14))];
    if (!list.length) { toast('Nenhum CNPJ encontrado no texto.', 'bad'); return; }
    stop = false; ok.length = 0;
    const tb = A.querySelector('#tb'); tb.innerHTML = '';
    A.querySelector('#stop').classList.remove('hidden'); A.querySelector('#imp').classList.add('hidden');
    for (let i = 0; i < list.length && !stop; i++) {
      A.querySelector('#st').textContent = `${i + 1}/${list.length}`;
      const c = list[i]; const tr = document.createElement('tr'); tb.appendChild(tr);
      if (!validCNPJ(c)) { tr.innerHTML = `<td>${esc(fmtCNPJ(c))}</td><td colspan="4"></td><td><span class="badge bad">inválido</span></td>`; continue; }
      tr.innerHTML = `<td>${esc(fmtCNPJ(c))}</td><td colspan="4" class="muted">consultando…</td><td></td>`;
      try {
        const r = await consultarCNPJ(c); ok.push(paraOrganizacao(r));
        const ex = store.findOrgByCNPJ(c);
        tr.innerHTML = `<td>${esc(fmtCNPJ(c))}</td><td>${esc(r.razao)}<div class="muted small">${esc(r.fantasia)}</div></td><td>${esc(r.uf)}</td><td class="small">${esc(r.cnaeDesc)}</td><td class="small">${esc(r.email || '—')}</td><td>${ex ? '<span class="badge gray">no CRM</span>' : '<span class="badge ok">ok</span>'}</td>`;
      } catch (e) { tr.innerHTML = `<td>${esc(fmtCNPJ(c))}</td><td colspan="4" class="small muted">${esc(e.message)}</td><td><span class="badge bad">erro</span></td>`; }
      await sleep(1200);
    }
    A.querySelector('#stop').classList.add('hidden');
    A.querySelector('#st').textContent = `${ok.length} encontrados`;
    if (ok.length) A.querySelector('#imp').classList.remove('hidden');
  };
  A.querySelector('#imp').onclick = () => { let n = 0; ok.forEach(d => { if (addOrg({ ...d, origem: 'CNPJs em lote' }, { abrir: false }).novo) n++; }); toast(`${n} organização(ões) nova(s); as demais foram atualizadas.`, 'ok'); };
}

function prospeccao(A, mecs) {
  const setores = ['Energia elétrica', 'Petróleo e gás', 'Automotivo', 'Eletroeletrônico', 'Telecom', 'Semicondutores', 'TIC / Software', 'Data centers / Nuvem', 'Financeiro', 'Farmacêutico', 'Química', 'Mineração', 'Aeroespacial e defesa', 'Agronegócio', 'Logística', 'Saúde'];
  A.innerHTML = `<div class="grid g2"><div class="card"><h3>Monte sua busca</h3>
    <div class="form-grid"><label class="field">Setor<select id="s">${options(setores, '')}</select></label>
    <label class="field">UF (opcional)<select id="u">${options(UFS, '', { empty: 'Brasil inteiro' })}</select></label>
    <label class="field full">Mecanismo de interesse<select id="m">${options(Object.values(mecs).map(m => ({ id: m.nome, nome: m.nome })), '', { empty: 'Qualquer' })}</select></label></div>
    <div class="list" id="links" style="margin-top:12px"></div></div>
    <div class="card"><h3>Onde estão os investidores de P&D</h3><div class="list">
      ${Object.values(mecs).filter(m => m.prioridade === 1).map(m => `<div class="list-item"><div style="flex:1"><div class="title">${esc(m.nome)}</div><div class="meta">${esc(m.quemUsa)}</div></div><a class="btn sm" href="${esc(m.link)}" target="_blank" rel="noopener">Fonte ↗</a></div>`).join('')}
    </div></div></div>`;
  const draw = () => {
    const l = linksProspeccao({ setor: A.querySelector('#s').value, uf: A.querySelector('#u').value, mecanismo: A.querySelector('#m').value });
    A.querySelector('#links').innerHTML = l.map(x => `<div class="list-item"><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.titulo)} ↗</a></div>`).join('');
  };
  A.querySelectorAll('select').forEach(s => s.onchange = draw); draw();
}

async function referencia(A) {
  const ref = await store.ref('empresas');
  const fontes = Object.fromEntries((await store.ref('fontes')).itens.map(f => [f.id, f]));
  const sel = new Set(); const f = { q: '', seg: '', uf: '', setor: '', ev: '' };
  const EV = { confirmada: 'Atuação quântica confirmada', indicios: 'Indícios públicos', potencial: 'Perfil compatível' };
  A.innerHTML = `
    <div class="grid g4" style="margin-bottom:14px">${Object.entries(EV).map(([k, l]) => `<div class="card kpi"><span class="label">${l}</span><span class="value">${ref.itens.filter(r => r.evidencia === k).length}</span></div>`).join('')}<div class="card kpi"><span class="label">Total mapeado</span><span class="value">${ref.itens.length}</span><span class="sub">${new Set(ref.itens.map(r => r.setor)).size} setores</span></div></div>
    <div class="toolbar"><input type="search" class="grow" id="q" placeholder="Filtrar organizações">
    <select id="setor">${options(store.setoresLista().map(s => ({ id: s.id, nome: s.nome })), '', { empty: 'Setor' })}</select>
    <select id="ev">${options(Object.entries(EV).map(([id, nome]) => ({ id, nome })), '', { empty: 'Atuação quântica' })}</select>
    <select id="seg">${options(SEGMENTOS, '', { empty: 'Segmento' })}</select><select id="uf">${options(UFS, '', { empty: 'UF' })}</select>
    <button class="btn" id="sel-all">Selecionar visíveis</button><button class="btn primary" id="imp">Importar selecionadas</button></div>
    <div class="table-wrap"><table><thead><tr><th></th><th>Organização</th><th>Setor</th><th>Atuação quântica</th><th>UF</th><th>Fonte</th></tr></thead><tbody id="tb"></tbody></table></div><p class="muted small" id="cnt"></p>`;
  const inCRM = o => !!store.findOrgByName(o.nome);
  const ordem = { confirmada: 0, indicios: 1, potencial: 2 };
  const list = () => { const q = norm(f.q); return ref.itens.filter(o => (!f.seg || o.segmento === f.seg) && (!f.uf || o.uf === f.uf) && (!f.setor || o.setor === f.setor) && (!f.ev || o.evidencia === f.ev) &&
    (!q || norm(`${o.nome} ${o.cidade} ${o.notas} ${o.atuacao} ${store.setorNome(o.setor)}`).includes(q))).sort((a, b) => ordem[a.evidencia] - ordem[b.evidencia] || a.prioridade.localeCompare(b.prioridade) || a.nome.localeCompare(b.nome)); };
  const draw = () => {
    const l = list();
    A.querySelector('#tb').innerHTML = l.map(o => { const has = inCRM(o); return `<tr>
      <td><input type="checkbox" data-id="${esc(o.id)}" ${sel.has(o.id) ? 'checked' : ''} ${has ? 'disabled' : ''} aria-label="Selecionar"></td>
      <td><div class="title">${esc(o.nome)} ${o.prioridade === 'A' ? '<span class="prio" title="Prioridade A">A</span>' : ''} ${has ? '<span class="badge ok">no CRM</span>' : ''}</div><div class="muted small">${esc(o.segmento)}${o.cidade ? ' · ' + esc(o.cidade) : ''}${o.atuacao ? '<br>' + esc(o.atuacao) : (o.notas ? ' · ' + esc(o.notas) : '')}</div></td>
      <td class="small">${esc(store.setorCurto(o.setor))}</td><td><span class="badge ${o.evidencia === 'confirmada' ? 'ok' : o.evidencia === 'indicios' ? 'info' : 'gray'}">${EV[o.evidencia]}</span></td><td>${esc(o.uf || '—')}</td>
      <td class="small">${o.fontes.map(id => fontes[id]).filter(Boolean).map(ff => ff.url ? `<a href="${esc(ff.url)}" target="_blank" rel="noopener" title="${esc(ff.titulo)}">${esc(ff.titulo.split(':')[0])}</a>` : esc(ff.titulo.split(',')[0])).join('<br>') || (safeUrl(o.site) ? `<a href="${esc(o.site)}" target="_blank" rel="noopener">site</a>` : '—')}</td></tr>`; }).join('');
    A.querySelector('#cnt').textContent = `${l.length} exibidas · ${sel.size} selecionadas`;
  };
  draw();
  A.querySelector('#q').addEventListener('input', debounce(e => { f.q = e.target.value; draw(); }));
  ['seg', 'uf', 'setor', 'ev'].forEach(k => A.querySelector('#' + k).onchange = e => { f[k] = e.target.value; draw(); });
  A.querySelector('#tb').onchange = e => { const id = e.target.dataset.id; if (id) { e.target.checked ? sel.add(id) : sel.delete(id); draw(); } };
  A.querySelector('#sel-all').onclick = () => { list().filter(o => !inCRM(o)).forEach(o => sel.add(o.id)); draw(); };
  A.querySelector('#imp').onclick = () => {
    if (!sel.size) { toast('Selecione organizações para importar.', 'bad'); return; }
    let n = 0;
    ref.itens.filter(o => sel.has(o.id) && !inCRM(o)).forEach(o => { store.list('orgs').push(fromRef(o)); n++; });
    store.touch('orgs'); sel.clear(); draw();
    toast(`${n} organização(ões) importada(s). Em cada uma, a aba "Encontrar contatos" ajuda a localizar as pessoas responsáveis.`, 'ok');
  };
}

function gmail(A) {
  const s = G.status();
  A.innerHTML = `<div class="card"><h3>Descobrir contatos nas suas conversas do Gmail</h3>
    
    ${!s.conectado ? `<div class="callout warn"><a href="#/config">Conectar o e-mail do CIQUANTA</a></div>` : ''}
    <form class="toolbar" id="f" style="margin-top:10px"><input class="grow" type="text" id="q" placeholder="Domínio, nome da empresa ou termo de busca do Gmail"><button class="btn primary">Buscar</button></form>
    <div id="r"></div></div>`;
  A.querySelector('#f').onsubmit = async e => {
    e.preventDefault(); const R = A.querySelector('#r'); let q = A.querySelector('#q').value.trim(); if (!q) return;
    if (/^[\w-]+(\.[\w-]+)+$/.test(q)) q = `from:${q} OR to:${q}`;
    R.innerHTML = '<div class="empty">Buscando…</div>';
    try {
      if (!G.hasScope('read')) throw new Error('Permissão de leitura não concedida.');
      const l = await G.searchThreads(q, 25);
      const pessoas = new Map(); const me = G.status().email.toLowerCase();
      for (const t of l.threads || []) {
        const th = await G.thread(t.id);
        for (const m of th.messages || []) for (const h of m.payload?.headers || []) {
          if (!/^(from|to|cc)$/i.test(h.name)) continue;
          for (const part of h.value.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)) {
            const mm = part.match(/"?([^"<]*)"?\s*<([^>]+)>/) || [null, '', part.trim()];
            const email = (mm[2] || '').trim().toLowerCase(); if (!isEmail(email) || email === me) continue;
            const nome = (mm[1] || '').trim();
            if (!pessoas.has(email) || (nome && !pessoas.get(email).nome)) pessoas.set(email, { email, nome, n: (pessoas.get(email)?.n || 0) + 1 });
            else pessoas.get(email).n++;
          }
        }
      }
      const arr = [...pessoas.values()].sort((a, b) => b.n - a.n);
      const orgs = [...store.list('orgs')].sort((a, b) => a.nome.localeCompare(b.nome));
      R.innerHTML = arr.length ? `<div class="table-wrap"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Ocorrências</th><th>Organização</th><th></th></tr></thead><tbody>${arr.map((p, i) => {
        const has = store.list('contatos').some(c => norm(c.email) === p.email);
        const dom = p.email.split('@')[1]; const guess = orgs.find(o => o.site && o.site.includes(dom.replace(/^mail\./, '')));
        return `<tr><td><input type="text" value="${esc(p.nome)}" data-n="${i}"></td><td>${esc(p.email)}</td><td>${p.n}</td><td><select data-o="${i}">${options(orgs.map(o => ({ id: o.id, nome: o.nome })), guess?.id, { empty: 'Selecione…' })}</select></td>
        <td>${has ? '<span class="badge ok">já cadastrado</span>' : `<button class="btn sm" data-add="${i}">Adicionar</button>`}</td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty">Nenhum contato encontrado.</div>';
      R.onclick = ev => {
        const i = ev.target.dataset.add; if (i === undefined) return;
        const orgId = R.querySelector(`[data-o="${i}"]`).value; if (!orgId) { toast('Escolha a organização.', 'bad'); return; }
        const p = arr[+i];
        store.upsert('contatos', { nome: R.querySelector(`[data-n="${i}"]`).value || p.email, email: p.email, orgId, fonte: 'Conversas no Gmail', tratamento: 'Prezado(a)', optout: store.suprimido(p.email) }, 'ct');
        ev.target.outerHTML = '<span class="badge ok">adicionado</span>';
      };
    } catch (err) { R.innerHTML = `<div class="callout warn">${esc(err.message)}</div>`; }
  };
}
