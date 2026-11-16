import * as store from '../store.js';
import { esc, fmtCNPJ, fmtDate, fmtDateTime, money, toast, confirmDialog, TIPOS_INTERACAO, safeUrl, isEmail, ESTAGIOS, options } from '../util.js';
import { openOrgForm, openContatoForm, openInteracaoForm, segBadge, estBadge } from '../components.js';
import { loadMecanismos } from '../email.js';
import { sugerirMecanismos, linksBusca } from '../dominio.js';
import { consultarCNPJ, paraOrganizacao } from '../cnpj.js';
import { quickMail } from '../quickmail.js';

export async function render(view, { arg, params }) {
  const mecs = await loadMecanismos();
  let tab = params.get('aba') || 'geral';
  const draw = () => {
    const o = store.get('orgs', arg);
    if (!o) { view.innerHTML = '<div class="card"><div class="empty">Organização não encontrada. <a href="#/organizacoes">Voltar</a></div></div>'; return; }
    document.querySelector('#page-title').textContent = o.nome;
    const contatos = store.contatosDe(o.id);
    const hist = store.interacoesDe(o.id);
    const sug = sugerirMecanismos(o).filter(id => !(o.mecanismos || []).includes(id) && mecs[id]);
    const site = safeUrl(o.site);
    view.innerHTML = `
    <div class="toolbar"><a href="#/organizacoes" class="btn ghost">← Organizações</a></div>
    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:flex-start">
        <div><h2 style="font-size:22px">${esc(o.nome)}</h2>
          <div class="muted">${o.nomeFantasia ? esc(o.nomeFantasia) + ' · ' : ''}${esc(o.setor || 'Setor não informado')} · ${esc([o.cidade, o.uf].filter(Boolean).join('/') || '—')}</div>
          <div class="tags" style="margin-top:8px">${segBadge(o.segmento)} ${estBadge(o.estagio)} ${(o.tags || []).map(t => `<span class="badge gray">#${esc(t)}</span>`).join('')}</div></div>
        <div class="toolbar" style="margin:0">
          <select id="est" aria-label="Estágio" style="width:auto">${options(ESTAGIOS, o.estagio || 'prospeccao')}</select>
          <button class="btn" id="edit">Editar</button>
          <button class="btn" id="int">+ Registro</button>
          <button class="btn primary" id="ct">+ Contato</button>
          <button class="btn danger" id="del" title="Excluir">Excluir</button>
        </div>
      </div>
      <div class="grid g4" style="margin-top:16px">
        <div><div class="muted small">CNPJ</div>${o.cnpj ? esc(fmtCNPJ(o.cnpj)) : '<span class="muted">—</span>'}</div>
        <div><div class="muted small">Site</div>${site ? `<a href="${esc(site)}" target="_blank" rel="noopener">${esc(site.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</a>` : '—'}</div>
        <div><div class="muted small">E-mail / telefone</div>${esc(o.email || '—')}<br>${esc(o.telefone || '')}</div>
        <div><div class="muted small">Potencial · Responsável</div>${o.potencial ? money(o.potencial) : '—'} · ${esc(o.responsavel || '—')}</div>
      </div>
    </div>
    <div class="tabs" role="tablist">
      ${[['geral', 'Visão geral'], ['contatos', `Contatos (${contatos.length})`], ['historico', `Histórico (${hist.length})`], ['mecanismos', 'Mecanismos de fomento'], ['busca', 'Busca ativa de contatos']].map(([k, l]) => `<button role="tab" data-tab="${k}" class="${tab === k ? 'active' : ''}">${l}</button>`).join('')}
    </div>
    <div id="tab"></div>`;
    const T = view.querySelector('#tab');
    if (tab === 'geral') {
      const r = o.receita;
      T.innerHTML = `<div class="grid g2">
        <div class="card"><h3>Notas</h3><p style="white-space:pre-wrap;margin:0">${esc(o.notas || 'Sem notas.')}</p></div>
        <div class="card"><h3>Dados da Receita Federal ${o.cnpj ? '<button class="btn sm" id="rf">Atualizar</button>' : ''}</h3>
          ${r ? `<div class="grid g2 small">
            <div><span class="muted">Situação</span><br>${esc(r.situacao || '—')}</div><div><span class="muted">Porte</span><br>${esc(o.porte || '—')}</div>
            <div><span class="muted">Abertura</span><br>${fmtDate(r.abertura)}</div><div><span class="muted">Capital social</span><br>${r.capital ? money(r.capital) : '—'}</div>
            <div class="span2"><span class="muted">Atividade (CNAE)</span><br>${esc(o.cnae || '—')}</div>
            <div class="span2"><span class="muted">Endereço</span><br>${esc(r.endereco || '—')} ${esc(r.cep || '')}</div>
            <div class="span2"><span class="muted">Quadro societário / administradores</span><br>${(r.socios || []).length ? r.socios.slice(0, 12).map(s => `${esc(s.nome)} <span class="muted">(${esc(s.qualificacao)})</span>`).join('<br>') : '—'}</div>
            <div class="span2 muted">Fonte: ${esc(r.fonte)} · consultado em ${fmtDateTime(r.consultadoEm)}</div></div>`
          : `<p class="muted">${o.cnpj ? 'Clique em Atualizar para buscar razão social, CNAE, porte, e-mail, telefone e sócios/administradores.' : 'Cadastre o CNPJ (Editar) para buscar os dados públicos da Receita.'}</p>`}
        </div>
        <div class="card span2"><h3>Últimos registros</h3>${histList(hist.slice(0, 5))}</div>
      </div>`;
      T.querySelector('#rf')?.addEventListener('click', async e => {
        e.target.disabled = true; e.target.textContent = 'Consultando…';
        try {
          const r2 = paraOrganizacao(await consultarCNPJ(o.cnpj));
          Object.entries(r2).forEach(([k, v]) => { if (v && (k === 'receita' || !o[k])) o[k] = v; });
          store.touch('orgs'); toast('Dados da Receita atualizados.', 'ok'); draw();
        } catch (err) { toast(err.message, 'bad'); e.target.disabled = false; e.target.textContent = 'Atualizar'; }
      });
    }
    if (tab === 'contatos') {
      T.innerHTML = contatos.length ? `<div class="table-wrap"><table><thead><tr><th>Nome</th><th>Cargo / área</th><th>E-mail</th><th>Telefone</th><th></th></tr></thead><tbody>
        ${contatos.map(c => `<tr><td><div class="title">${esc(c.nome)}</div>${c.linkedin ? `<a class="small" href="${esc(c.linkedin)}" target="_blank" rel="noopener">perfil</a>` : ''} ${c.optout ? '<span class="badge bad">descadastrado</span>' : ''}</td>
          <td>${esc(c.cargo || '—')}<div class="muted small">${esc(c.area || '')}</div></td>
          <td>${isEmail(c.email) ? esc(c.email) : '<span class="muted">—</span>'}</td><td>${esc(c.telefone || '—')}</td>
          <td class="nowrap"><button class="btn sm" data-mail="${esc(c.id)}" ${!isEmail(c.email) || c.optout ? 'disabled' : ''}>✉ E-mail</button> <button class="btn sm" data-edit="${esc(c.id)}">Editar</button> <button class="btn sm ghost danger" data-delc="${esc(c.id)}" aria-label="Excluir">✕</button></td></tr>`).join('')}
        </tbody></table></div>` : `<div class="card"><div class="empty">Nenhum contato. Use a aba <a href="#" data-tab-link="busca">Busca ativa de contatos</a> para encontrar gestores de P&D e Relações Institucionais.</div></div>`;
      T.onclick = async e => {
        const b = e.target.closest('button,[data-tab-link]'); if (!b) return;
        if (b.dataset.tabLink) { e.preventDefault(); tab = b.dataset.tabLink; draw(); return; }
        if (b.dataset.mail) quickMail(store.get('contatos', b.dataset.mail));
        if (b.dataset.edit) openContatoForm(store.get('contatos', b.dataset.edit), draw);
        if (b.dataset.delc && await confirmDialog('Excluir este contato?', { ok: 'Excluir', danger: true })) { store.remove('contatos', b.dataset.delc); draw(); }
      };
    }
    if (tab === 'historico') {
      T.innerHTML = `<div class="card">${histList(hist, true)}</div>`;
      T.onclick = async e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.ei) openInteracaoForm(store.get('interacoes', b.dataset.ei), draw);
        if (b.dataset.di && await confirmDialog('Excluir este registro?', { ok: 'Excluir', danger: true })) { store.remove('interacoes', b.dataset.di); draw(); }
      };
    }
    if (tab === 'mecanismos') {
      const cards = (ids, add) => ids.map(id => mecs[id]).filter(Boolean).map(m => `<div class="card mec"><header><h4>${esc(m.nome)}</h4>${add ? `<button class="btn sm" data-add="${esc(m.id)}">+ Associar</button>` : `<button class="btn sm ghost" data-rm="${esc(m.id)}">Remover</button>`}</header>
        <div class="muted small">${esc(m.baseLegal)}</div><div class="fit"><strong>Como o CIQuanta entra:</strong> ${esc(m.encaixeCiquanta)}</div><div class="small"><strong>Argumento:</strong> ${esc(m.argumento)}</div></div>`).join('');
      T.innerHTML = `<h3 style="margin:0 0 10px">Associados a esta organização</h3><div class="grid g2" style="margin-bottom:20px">${cards(o.mecanismos || [], false) || '<div class="muted">Nenhum ainda.</div>'}</div>
        ${sug.length ? `<h3 style="margin:0 0 10px">Sugeridos pelo perfil (${esc(o.setor || o.segmento || '')}${o.uf ? ', ' + esc(o.uf) : ''})</h3><div class="grid g2">${cards(sug, true)}</div>` : ''}`;
      T.onclick = e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.add) { o.mecanismos = [...new Set([...(o.mecanismos || []), b.dataset.add])]; store.touch('orgs'); draw(); }
        if (b.dataset.rm) { o.mecanismos = (o.mecanismos || []).filter(x => x !== b.dataset.rm); store.touch('orgs'); draw(); }
      };
    }
    if (tab === 'busca') {
      const links = linksBusca(o.nomeFantasia || o.nome, { site: o.site });
      const grupos = [...new Set(links.map(l => l.grupo))];
      T.innerHTML = `<div class="callout info" style="margin-bottom:14px">Abra as buscas, identifique a pessoa certa (P&D, Inovação, Relações Governamentais) e cadastre com <strong>+ Contato</strong>, registrando a fonte. Use só contatos institucionais públicos e respeite pedidos de descadastro (LGPD).</div>
        <div class="grid g2">${grupos.map(g => `<div class="card"><h3>${esc(g)}</h3><div class="list">${links.filter(l => l.grupo === g).map(l => `<div class="list-item"><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.titulo)} ↗</a></div>`).join('')}</div></div>`).join('')}
        ${o.receita?.socios?.length ? `<div class="card"><h3>Administradores (Receita Federal)</h3><div class="list">${o.receita.socios.slice(0, 10).map(s => `<div class="list-item"><div style="flex:1">${esc(s.nome)}<div class="meta">${esc(s.qualificacao)}</div></div><a class="btn sm" target="_blank" rel="noopener" href="https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(s.nome + ' ' + (o.nomeFantasia || o.nome))}">LinkedIn ↗</a></div>`).join('')}</div></div>` : ''}</div>`;
    }
    view.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; draw(); });
    view.querySelector('#edit').onclick = () => openOrgForm(o, draw);
    view.querySelector('#ct').onclick = () => openContatoForm({ orgId: o.id }, () => { tab = 'contatos'; draw(); });
    view.querySelector('#int').onclick = () => openInteracaoForm({ orgId: o.id }, () => { tab = 'historico'; draw(); });
    view.querySelector('#est').onchange = e => { o.estagio = e.target.value; store.touch('orgs'); store.logInteracao({ orgId: o.id, tipo: 'nota', titulo: `Estágio alterado para ${e.target.selectedOptions[0].text}` }); draw(); };
    view.querySelector('#del').onclick = async () => { if (await confirmDialog(`Excluir ${o.nome}, seus contatos e histórico?`, { ok: 'Excluir', danger: true })) { store.remove('orgs', o.id); location.hash = '#/organizacoes'; } };
  };
  draw();
}

function histList(list, actions = false) {
  if (!list.length) return '<div class="empty">Sem registros.</div>';
  const ic = { email: '✉', reuniao: '◎', ligacao: '☎', visita: '⌂', evento: '★', nota: '✎', tarefa: '☐' };
  return `<div class="list">${list.map(i => { const c = i.contatoId && store.get('contatos', i.contatoId); return `<div class="list-item">
    <div class="date-chip" style="min-width:34px">${ic[i.tipo] || '•'}</div>
    <div style="flex:1"><div class="title">${esc(i.titulo)}</div>
    <div class="meta">${esc(TIPOS_INTERACAO[i.tipo] || i.tipo)} · ${fmtDate(i.data)}${c ? ' · ' + esc(c.nome) : ''}${i.venc ? ` · próximo passo até ${fmtDate(i.venc)} ${i.concluida ? '<span class="badge ok">concluído</span>' : '<span class="badge warn">pendente</span>'}` : ''}</div>
    ${i.descricao ? `<div class="small" style="white-space:pre-wrap;color:var(--text-2)">${esc(i.descricao)}</div>` : ''}</div>
    ${actions ? `<div class="nowrap"><button class="btn sm" data-ei="${esc(i.id)}">Editar</button> <button class="btn sm ghost danger" data-di="${esc(i.id)}" aria-label="Excluir">✕</button></div>` : ''}</div>`; }).join('')}</div>`;
}
