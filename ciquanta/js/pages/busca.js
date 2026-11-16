import * as store from '../store.js';
import { esc, toast, options, UFS, SEGMENTOS, norm, debounce, fmtCNPJ, onlyDigits, validCNPJ, sleep, uid, money, isEmail, safeUrl } from '../util.js';
import { consultarCNPJ, paraOrganizacao } from '../cnpj.js';
import { sugerirMecanismos, linksProspeccao } from '../dominio.js';
import { loadMecanismos, mecNome, mecCurto } from '../email.js';
import * as G from '../google.js';

const ABAS = [['cnpj', 'Consulta CNPJ'], ['lote', 'CNPJs em lote'], ['prospeccao', 'Prospecção guiada'], ['referencia', 'Base de referência'], ['gmail', 'Contatos no meu Gmail']];

export async function render(view, { params }) {
  const mecs = await loadMecanismos();
  let aba = params.get('aba') || 'cnpj';
  view.innerHTML = `<div class="section-head"><div><h2>Busca ativa</h2><p>Encontre empresas que investem em P&D, fomentadores e autoridades, enriqueça com dados públicos da Receita Federal e leve para o CRM com os mecanismos de fomento já sugeridos.</p></div></div>
    <div class="tabs">${ABAS.map(([k, l]) => `<button data-aba="${k}" class="${aba === k ? 'active' : ''}">${l}</button>`).join('')}</div><div id="aba"></div>`;
  const A = view.querySelector('#aba');
  const go = k => { aba = k; view.querySelectorAll('[data-aba]').forEach(b => b.classList.toggle('active', b.dataset.aba === k)); ({ cnpj, lote, prospeccao, referencia, gmail })[k](A, mecs); };
  view.querySelectorAll('[data-aba]').forEach(b => b.onclick = () => go(b.dataset.aba));
  go(aba);
}

function addOrg(dados, { abrir = true } = {}) {
  const ex = (dados.cnpj && store.findOrgByCNPJ(dados.cnpj)) || store.findOrgByName(dados.nome);
  if (ex) { Object.entries(dados).forEach(([k, v]) => { if (v && (k === 'receita' || !ex[k] || (Array.isArray(ex[k]) && !ex[k].length))) ex[k] = v; }); store.touch('orgs'); if (abrir) location.hash = `#/org/${ex.id}`; return { org: ex, novo: false }; }
  const org = store.upsert('orgs', { segmento: 'Empresa', estagio: 'prospeccao', ...dados, mecanismos: dados.mecanismos?.length ? dados.mecanismos : sugerirMecanismos({ segmento: 'Empresa', ...dados }) }, 'org');
  if (abrir) location.hash = `#/org/${org.id}`;
  return { org, novo: true };
}

function cnpj(A, mecs) {
  A.innerHTML = `<div class="grid g2">
    <div class="card"><h3>Consultar CNPJ na Receita Federal</h3>
      <form id="f" class="toolbar" style="margin:0"><input type="text" class="grow" id="c" placeholder="00.000.000/0000-00" inputmode="numeric" autocomplete="off"><button class="btn primary">Consultar</button></form>
      <p class="muted small">Retorna razão social, nome fantasia, CNAE, porte, situação, e-mail e telefone cadastrados, endereço e quadro de administradores. Fontes públicas: BrasilAPI, Minha Receita e CNPJ.ws.</p>
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
          <div><span class="muted">CNAE</span><br>${esc(r.cnae)} ${esc(r.cnaeDesc)}</div><div><span class="muted">Porte · capital</span><br>${esc(r.porte || '—')} · ${r.capital ? money(r.capital) : '—'}</div>
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
    <p class="muted">Cole CNPJs (um por linha ou separados por vírgula), por exemplo de listas públicas de beneficiárias da Lei do Bem ou de empresas habilitadas na Lei de TICs. As consultas são feitas uma a uma, com pausa, para respeitar os limites das APIs públicas.</p>
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
  A.querySelector('#imp').onclick = () => { let n = 0; ok.forEach(d => { if (addOrg({ ...d, origem: 'CNPJs em lote' }, { abrir: false }).novo) n++; }); toast(`${n} organização(ões) nova(s); demais atualizadas.`, 'ok'); };
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

async function referencia(A, mecs) {
  const ref = await store.ref('organizacoes');
  const sel = new Set(); const f = { q: '', seg: '', uf: '' };
  A.innerHTML = `<div class="callout info" style="margin-bottom:12px">${esc(ref.aviso)} <span class="muted">(Revisado em ${esc(ref.verificadoEm.split('-').reverse().join('/'))}.)</span></div>
    <div class="toolbar"><input type="search" class="grow" id="q" placeholder="Filtrar ${ref.itens.length} organizações…"><select id="seg">${options(SEGMENTOS, '', { empty: 'Segmento' })}</select><select id="uf">${options(UFS, '', { empty: 'UF' })}</select>
    <button class="btn" id="sel-all">Selecionar visíveis</button><button class="btn primary" id="imp">Importar selecionadas</button></div>
    <div class="table-wrap"><table><thead><tr><th></th><th>Organização</th><th>Segmento</th><th>Setor</th><th>UF</th><th>Mecanismos</th><th></th></tr></thead><tbody id="tb"></tbody></table></div><p class="muted small" id="cnt"></p>`;
  const inCRM = o => !!store.findOrgByName(o.nome);
  const list = () => { const q = norm(f.q); return ref.itens.filter(o => (!f.seg || o.segmento === f.seg) && (!f.uf || o.uf === f.uf) && (!q || norm(`${o.nome} ${o.setor} ${o.cidade} ${o.notas}`).includes(q))); };
  const draw = () => {
    const l = list();
    A.querySelector('#tb').innerHTML = l.map(o => { const has = inCRM(o); return `<tr>
      <td><input type="checkbox" data-id="${esc(o.id)}" ${sel.has(o.id) ? 'checked' : ''} ${has ? 'disabled' : ''} aria-label="Selecionar"></td>
      <td><div class="title">${esc(o.nome)}</div><div class="muted small">${esc(o.cidade)}${o.notas ? ' · ' + esc(o.notas) : ''}</div></td><td>${esc(o.segmento)}</td><td>${esc(o.setor)}</td><td>${esc(o.uf)}</td>
      <td><div class="tags">${o.mecanismos.slice(0, 3).map(m => `<span class="badge gray">${esc(mecCurto(m))}</span>`).join('')}</div></td>
      <td class="nowrap">${has ? '<span class="badge ok">no CRM</span>' : ''} ${safeUrl(o.site) ? `<a class="small" href="${esc(o.site)}" target="_blank" rel="noopener">site ↗</a>` : ''}</td></tr>`; }).join('');
    A.querySelector('#cnt').textContent = `${l.length} exibidas · ${sel.size} selecionadas`;
  };
  draw();
  A.querySelector('#q').addEventListener('input', debounce(e => { f.q = e.target.value; draw(); }));
  A.querySelector('#seg').onchange = e => { f.seg = e.target.value; draw(); };
  A.querySelector('#uf').onchange = e => { f.uf = e.target.value; draw(); };
  A.querySelector('#tb').onchange = e => { const id = e.target.dataset.id; if (id) { e.target.checked ? sel.add(id) : sel.delete(id); draw(); } };
  A.querySelector('#sel-all').onclick = () => { list().filter(o => !inCRM(o)).forEach(o => sel.add(o.id)); draw(); };
  A.querySelector('#imp').onclick = () => {
    if (!sel.size) { toast('Selecione organizações para importar.', 'bad'); return; }
    let n = 0;
    ref.itens.filter(o => sel.has(o.id)).forEach(o => {
      if (inCRM(o)) return;
      store.list('orgs').push({ id: uid('org'), nome: o.nome, segmento: o.segmento, setor: o.setor, uf: o.uf, cidade: o.cidade, site: o.site, mecanismos: o.mecanismos, notas: o.notas, estagio: 'prospeccao', origem: 'Base de referência', refId: o.id, criadoEm: new Date().toISOString() });
      n++;
    });
    store.touch('orgs'); sel.clear(); draw();
    toast(`${n} organização(ões) importada(s). Agora encontre os contatos na aba "Busca ativa de contatos" de cada uma.`, 'ok');
  };
}

function gmail(A) {
  const s = G.status();
  A.innerHTML = `<div class="card"><h3>Descobrir contatos nas suas conversas do Gmail</h3>
    <p class="muted">Procura remetentes e destinatários de conversas que você já teve com um domínio ou tema (ex.: <code>petrobras.com.br</code>, <code>"Lei do Bem"</code>, <code>quântica</code>). Útil para reaproveitar relacionamentos existentes. Requer a permissão "Ler respostas" (somente leitura).</p>
    ${!s.conectado || !G.hasScope('read') ? `<div class="callout warn">Conecte o Gmail com a permissão de leitura: ative "Ler respostas" em <a href="#/config">Configurações</a> e clique em Conectar.</div>` : ''}
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
        store.upsert('contatos', { nome: R.querySelector(`[data-n="${i}"]`).value || p.email, email: p.email, orgId, fonte: 'Conversas no Gmail', optout: store.suprimido(p.email) }, 'ct');
        ev.target.outerHTML = '<span class="badge ok">adicionado</span>';
      };
    } catch (err) { R.innerHTML = `<div class="callout warn">${esc(err.message)}</div>`; }
  };
}
