import * as store from '../store.js';
import { esc, fmtCNPJ, fmtDate, fmtDateTime, money, toast, confirmDialog, TIPOS_INTERACAO, safeUrl, isEmail, RELACIONAMENTO, options, modNome, blocoNome } from '../util.js';
import { openOrgForm, openContatoForm, openInteracaoForm, openOportunidadeForm, openReuniaoForm, segBadge, relBadge, evBadge, funilBadge } from '../components.js';
import { loadMecanismos, mecCurto, linkApresentacao } from '../email.js';
import { sugerirMecanismos, linksBusca } from '../dominio.js';
import { consultarCNPJ, paraOrganizacao } from '../cnpj.js';
import { quickMail } from '../quickmail.js';
import { buildDeck, present } from '../deck.js';
import { icon } from '../icons.js';
import * as G from '../google.js';
import { carregarSinais, sinaisDe } from '../sinais.js';
import { pontuar } from '../score.js';
import { gerarProposta } from '../proposta.js';
import { carregarPesquisa, pesquisaDe, linhaPessoa, ligarPessoas } from '../pesquisa.js';

export async function render(view, { arg, params }) {
  const mecs = await loadMecanismos();
  await carregarSinais();
  await carregarPesquisa();
  const fontes = Object.fromEntries((await store.ref('fontes')).itens.map(f => [f.id, f]));
  let tab = params.get('aba') || 'geral';
  const draw = () => {
    const o = store.get('orgs', arg);
    if (!o) { view.innerHTML = '<div class="card"><div class="empty">Organização não encontrada. <a href="#/organizacoes">Voltar</a></div></div>'; return; }
    document.querySelector('#page-title').textContent = o.nome;
    const contatos = store.contatosDe(o.id), hist = store.interacoesDe(o.id), ops = store.oportunidadesDe(o.id);
    const setor = store.setoresLista().find(s => s.id === o.setor);
    const agenda = setor?.deck ? setor : store.setoresLista().find(s => s.id === setor?.deckId);
    const site = safeUrl(o.site);
    const pot = pontuar(o);
    const pq = pesquisaDe(o);
    view.innerHTML = `
    <div class="toolbar"><a href="#/organizacoes" class="btn ghost">${icon('esquerda', 16)} Organizações</a></div>
    <div class="card" style="margin-bottom:18px">
      <div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:flex-start">
        <div><h2 class="titulo-org">${esc(o.nome)}</h2>
          <div class="muted">${o.nomeFantasia ? esc(o.nomeFantasia) + ' · ' : ''}${esc(store.setorNome(o.setor))} · ${esc([o.cidade, o.uf].filter(Boolean).join('/') || '—')}</div>
          <div class="tags" style="margin-top:8px"><span class="pot" title="${esc(pot.motivos.map(m => `+${m[0]} ${m[1]}`).join('\n'))}">Potencial <i><b style="width:${pot.total}%"></b></i>${pot.total}</span> ${segBadge(o.segmento)} ${evBadge(o.evidencia)} ${relBadge(o.relacionamento)} ${o.prioridade ? `<span class="badge">Prioridade ${esc(o.prioridade)}</span>` : ''} ${o.bloco ? `<span class="badge gray">${esc(blocoNome(o.bloco))}</span>` : ''} ${(o.tags || []).map(t => `<span class="badge gray">#${esc(t)}</span>`).join('')}</div></div>
        <div class="toolbar" style="margin:0">
          <select id="rel" aria-label="Relacionamento" style="width:auto">${options(RELACIONAMENTO, o.relacionamento || 'mapeada')}</select>
          <button class="btn" id="edit">Editar</button>
          <button class="btn" id="reuniao">${icon('reuniao', 15)} Agendar reunião</button>
          <button class="btn" id="opp">${icon('oportunidades', 15)} Oportunidade</button>
          <button class="btn primary" id="ct">${icon('mais', 15)} Contato</button>
          <button class="btn ghost danger" id="del" title="Excluir">${icon('x', 16)}</button>
        </div>
      </div>
      <div class="grid g4" style="margin-top:16px">
        <div><div class="muted small">CNPJ</div>${o.cnpj ? esc(fmtCNPJ(o.cnpj)) : '<span class="muted">—</span>'}</div>
        <div><div class="muted small">Site</div>${site ? `<a href="${esc(site)}" target="_blank" rel="noopener">${esc(store.dominio(site))}</a>` : '—'}</div>
        <div><div class="muted small">E-mail e telefone</div>${esc(o.email || '—')}<br>${esc(o.telefone || '')}</div>
        <div><div class="muted small">Pipeline · responsável</div>${money(ops.filter(x => !['contratada', 'perdida'].includes(x.etapa)).reduce((a, x) => a + store.pipelineValor(x), 0))} · ${esc(o.responsavel || '—')}</div>
      </div>
    </div>
    <div class="tabs" role="tablist">
      ${[['geral', 'Visão geral'], ['contatos', `Contatos (${contatos.length})`], ['oportunidades', `Oportunidades (${ops.length})`], ['historico', `Histórico (${hist.length})`], ['pesquisa', `Pessoas de P&D (${pq.lista.length})`], ['agenda', 'Agenda setorial'], ['google', 'E-mails, arquivos e agenda'], ['busca', 'Encontrar contatos']].map(([k, l]) => `<button role="tab" data-tab="${k}" class="${tab === k ? 'active' : ''}">${l}</button>`).join('')}
    </div><div id="tab"></div>`;
    const T = view.querySelector('#tab');

    if (tab === 'geral') {
      const r = o.receita;
      T.innerHTML = `<div class="grid g2">
        <div class="card"><h3>Atuação em P&D e computação quântica</h3>
          <p style="margin:0 0 10px">${o.atuacao ? esc(o.atuacao) : '<span class="muted">Sem atuação quântica documentada. O perfil de P&D do setor indica potencial.</span>'}</p>
          ${(o.fontes || []).length ? `<div class="small"><b>Fontes</b><ul style="margin:4px 0 0;padding-left:18px">${o.fontes.map(id => fontes[id]).filter(Boolean).map(f => `<li>${f.url ? `<a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.titulo)}</a>` : esc(f.titulo)}</li>`).join('')}</ul></div>` : ''}
          ${o.notas ? `<p class="small" style="white-space:pre-wrap;margin:12px 0 0"><b>Notas.</b> ${esc(o.notas)}</p>` : ''}
          <div style="margin-top:12px"><div class="muted small">Mecanismos associados</div><div class="tags" style="margin-top:4px">${(o.mecanismos || []).map(m => `<span class="badge gray">${esc(mecCurto(m))}</span>`).join('') || '<span class="muted small">Nenhum</span>'}</div></div>
        </div>
        <div class="card"><h3>Dados da Receita Federal ${o.cnpj ? '<button class="btn sm" id="rf">Atualizar</button>' : ''}</h3>
          ${r ? `<div class="grid g2 small">
            <div><span class="muted">Situação</span><br>${esc(r.situacao || '—')}</div><div><span class="muted">Porte</span><br>${esc(o.porte || '—')}</div>
            <div><span class="muted">Abertura</span><br>${fmtDate(r.abertura)}</div><div><span class="muted">Capital social</span><br>${r.capital ? money(r.capital) : '—'}</div>
            <div class="span2"><span class="muted">Atividade (CNAE)</span><br>${esc(o.cnae || '—')}</div>
            <div class="span2"><span class="muted">Endereço</span><br>${esc(r.endereco || '—')} ${esc(r.cep || '')}</div>
            <div class="span2"><span class="muted">Quadro de administradores</span><br>${(r.socios || []).length ? r.socios.slice(0, 12).map(s => `${esc(s.nome)} <span class="muted">(${esc(s.qualificacao)})</span>`).join('<br>') : '—'}</div>
            <div class="span2 muted">Fonte: ${esc(r.fonte)} · consultado em ${fmtDateTime(r.consultadoEm)}</div></div>`
          : `<p class="muted">${o.cnpj ? 'Clique em Atualizar para buscar razão social, CNAE, porte, e-mail, telefone e administradores.' : 'Cadastre o CNPJ (Editar) para consultar os dados públicos da Receita Federal.'}</p>`}
        </div>
        ${(() => { const l = sinaisDe(o.id).slice(0, 6); return l.length ? `<div class="card span2"><h3>${icon('sinal', 16)} Na imprensa <span class="muted">coleta diária de notícias</span></h3><div class="sinais compacto">${l.map(x => `<article class="sinal"><div class="quando">${fmtDate(x.data)}<small>${esc(x.fonte)}</small></div><div><a class="title" href="${esc(x.link)}" target="_blank" rel="noopener">${esc(x.titulo)}</a>${x.edital ? '<div class="tags"><span class="badge warn">Chamada aberta</span></div>' : ''}</div></article>`).join('')}</div></div>` : ''; })()}
        ${o.links?.length ? `<div class="card span2"><h3>Origem da descoberta</h3><ul class="small" style="margin:0;padding-left:18px">${o.links.map(u => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(u.replace(/^https?:\/\//, '').slice(0, 90))}</a></li>`).join('')}</ul></div>` : ''}
        <div class="card span2"><h3>Últimos registros</h3>${histList(hist.slice(0, 6))}</div>
      </div>`;
      T.querySelector('#rf')?.addEventListener('click', async e => {
        e.target.disabled = true; e.target.textContent = 'Consultando…';
        try { const r2 = paraOrganizacao(await consultarCNPJ(o.cnpj)); Object.entries(r2).forEach(([k, v]) => { if (v && (k === 'receita' || !o[k] || k === 'setor' && !o.setor)) o[k] = v; }); delete o.setorCnae; store.touch('orgs'); toast('Dados da Receita atualizados.', 'ok'); draw(); }
        catch (err) { toast(err.message, 'bad'); e.target.disabled = false; e.target.textContent = 'Atualizar'; }
      });
    }
    if (tab === 'contatos') {
      T.innerHTML = contatos.length ? `<div class="table-wrap"><table><thead><tr><th>Nome</th><th>Cargo e área</th><th>E-mail</th><th>Telefone</th><th></th></tr></thead><tbody>
        ${contatos.map(c => `<tr><td><div class="title">${esc(c.nome)}</div><div class="muted small">${esc(c.tratamento || '')}</div>${c.linkedin ? `<a class="small" href="${esc(c.linkedin)}" target="_blank" rel="noopener">perfil</a>` : ''} ${c.optout ? '<span class="badge bad">não deseja e-mails</span>' : ''}</td>
          <td>${esc(c.cargo || '—')}<div class="muted small">${esc(c.area || '')}</div></td><td>${isEmail(c.email) ? esc(c.email) : '<span class="muted">—</span>'}</td><td>${esc(c.telefone || '—')}</td>
          <td class="nowrap"><button class="btn sm" data-mail="${esc(c.id)}" ${!isEmail(c.email) || c.optout ? 'disabled' : ''}>${icon('mail', 14)} E-mail</button> <button class="btn sm" data-meet="${esc(c.id)}">${icon('reuniao', 14)}</button> <button class="btn sm" data-edit="${esc(c.id)}">Editar</button> <button class="btn sm ghost danger" data-delc="${esc(c.id)}" aria-label="Excluir">${icon('x', 14)}</button></td></tr>`).join('')}
        </tbody></table></div>` : `<div class="card"><div class="empty">Nenhum contato. A aba <a href="#" data-tab-link="busca">Encontrar contatos</a> reúne buscas prontas por gestores de P&D e de relações institucionais.</div></div>`;
      T.onclick = async e => {
        const b = e.target.closest('button,[data-tab-link]'); if (!b) return;
        if (b.dataset.tabLink) { e.preventDefault(); tab = b.dataset.tabLink; draw(); return; }
        if (b.dataset.mail) quickMail(store.get('contatos', b.dataset.mail));
        if (b.dataset.meet) openReuniaoForm({ orgId: o.id, contatoIds: [b.dataset.meet] }, draw);
        if (b.dataset.edit) openContatoForm(store.get('contatos', b.dataset.edit), draw);
        if (b.dataset.delc) store.removerComDesfazer('contatos', b.dataset.delc, 'Contato', draw), draw();
      };
    }
    if (tab === 'oportunidades') {
      T.innerHTML = ops.length ? `<div class="table-wrap"><table><thead><tr><th>Oportunidade</th><th>Linha</th><th>Modalidade</th><th>Mecanismo</th><th>Etapa</th><th class="num">Valor</th><th class="num">Ponderado</th><th>Próximo passo</th><th></th></tr></thead><tbody>
        ${ops.map(x => `<tr class="row-link" data-op="${esc(x.id)}"><td class="title">${esc(x.titulo)}</td><td class="small">${esc(agenda?.linhas.find(l => l.id === x.linha)?.nome || '—')}</td><td class="small">${esc(modNome(x.modalidade))}</td><td class="small">${x.mecanismo ? esc(mecCurto(x.mecanismo)) : '—'}</td><td>${funilBadge(x.etapa)}</td><td class="num">${money(x.valor)}</td><td class="num">${money(store.pipelineValor(x))}</td><td class="small">${esc(x.proximoPasso || '—')}${x.proximoEm ? ` (${fmtDate(x.proximoEm)})` : ''}</td><td class="nowrap"><button class="btn sm" data-prop="${esc(x.id)}">${x.propostaEm ? 'Proposta ' + esc(x.propostaNum || '') : 'Gerar proposta'}</button></td></tr>`).join('')}</tbody></table></div>`
        : `<div class="card"><div class="empty">Nenhuma oportunidade. <button class="btn sm" id="opp2">Criar oportunidade</button></div></div>`;
      T.querySelectorAll('[data-op]').forEach(tr => tr.onclick = e => { const b = e.target.closest('[data-prop]'); if (b) { gerarProposta(b.dataset.prop).then(draw); return; } openOportunidadeForm(store.get('oportunidades', tr.dataset.op), draw); });
      T.querySelector('#opp2')?.addEventListener('click', () => openOportunidadeForm({ orgId: o.id, setor: o.setor }, draw));
    }
    if (tab === 'historico') {
      T.innerHTML = `<div class="toolbar"><button class="btn" id="novo-reg">${icon('mais', 15)} Registrar interação</button></div><div class="card">${histList(hist, true)}</div>`;
      T.querySelector('#novo-reg').onclick = () => openInteracaoForm({ orgId: o.id }, draw);
      T.querySelector('.card').onclick = async e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.ei) openInteracaoForm(store.get('interacoes', b.dataset.ei), draw);
        if (b.dataset.di) store.removerComDesfazer('interacoes', b.dataset.di, 'Registro', draw), draw();
      };
    }
    if (tab === 'agenda') {
      const sug = sugerirMecanismos(o).filter(id => !(o.mecanismos || []).includes(id) && mecs[id]);
      T.innerHTML = agenda ? `<div class="card" style="margin-bottom:16px"><h3>${esc(agenda.nome)}<span class="toolbar" style="margin:0"><button class="btn sm primary" id="apres">${icon('play', 14)} Apresentar</button><button class="btn sm" id="link">${icon('link', 14)} Copiar link</button></span></h3>
        <div class="grid g2">${agenda.linhas.map(l => `<div class="linha"><h4>${esc(l.nome)}</h4><div class="pergunta small">${esc(l.pergunta)}</div><button class="btn sm" data-lop="${esc(l.id)}">${icon('mais', 14)} Oportunidade nesta linha</button></div>`).join('')}</div></div>
        <div class="card"><h3>Mecanismos de financiamento</h3><div class="grid g2">${[...(o.mecanismos || []), ...sug].map(id => mecs[id]).filter(Boolean).map(m => `<div class="callout"><div style="display:flex;justify-content:space-between;gap:8px"><b>${esc(m.nome)}</b>${(o.mecanismos || []).includes(m.id) ? `<button class="btn sm ghost" data-rm="${esc(m.id)}">Remover</button>` : `<button class="btn sm" data-add="${esc(m.id)}">Associar</button>`}</div><div class="small" style="margin-top:4px">${esc(m.encaixeCiquanta)}</div></div>`).join('')}</div></div>`
        : '<div class="card"><div class="empty">Defina o setor da organização (Editar) para ver a agenda de pesquisa aplicada correspondente.</div></div>';
      T.querySelector('#apres')?.addEventListener('click', async () => present(await buildDeck(agenda.id)));
      T.querySelector('#link')?.addEventListener('click', async () => { const u = linkApresentacao(agenda.id); try { await navigator.clipboard.writeText(u); toast('Link copiado.', 'ok'); } catch { toast(u); } });
      T.onclick = e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.lop) openOportunidadeForm({ orgId: o.id, setor: o.setor, linha: b.dataset.lop, titulo: agenda.linhas.find(l => l.id === b.dataset.lop)?.nome }, () => { tab = 'oportunidades'; draw(); });
        if (b.dataset.add) { o.mecanismos = [...new Set([...(o.mecanismos || []), b.dataset.add])]; store.touch('orgs'); draw(); }
        if (b.dataset.rm) { o.mecanismos = (o.mecanismos || []).filter(x => x !== b.dataset.rm); store.touch('orgs'); draw(); }
      };
    }
    if (tab === 'google') {
      const g = G.status(), dom = o.site ? store.dominio(o.site) : '', nome = o.nomeFantasia || o.nome;
      if (!g.conectado) T.innerHTML = '<div class="card"><div class="empty"><a href="#/config">Conecte o e-mail do CIQUANTA</a> para ver aqui os e-mails, os arquivos do Drive e os compromissos ligados a esta organização.</div></div>';
      else {
        T.innerHTML = `<div class="grid g3"><div class="card"><h3>E-mails ${icon('mail', 15)}</h3><div id="g-mail"><div class="empty">Buscando…</div></div></div><div class="card"><h3>Arquivos no Drive ${icon('materiais', 15)}</h3><div id="g-drive"><div class="empty">Buscando…</div></div></div><div class="card"><h3>Agenda ${icon('agenda', 15)}</h3><div id="g-cal"><div class="empty">Buscando…</div></div></div></div>`;
        const put = (id, h) => { const el = T.querySelector(id); if (el) el.innerHTML = h; };
        const falha = (id, e, perm) => put(id, `<div class="empty">${esc(e.message)}</div>`);
        const emails = contatos.map(c => c.email).filter(isEmail);
        const q = [dom && `from:${dom} OR to:${dom}`, ...emails.slice(0, 6).map(e => `from:${e} OR to:${e}`)].filter(Boolean).join(' OR ') || `"${nome}"`;
        G.threadsDetalhe(q, 8).then(l => put('#g-mail', l.length ? `<div class="list">${l.map(t => `<div class="list-item"><div style="min-width:0;flex:1"><a class="title" target="_blank" rel="noopener" href="https://mail.google.com/mail/u/0/#all/${esc(t.id)}">${esc(t.assunto)}</a><div class="meta">${esc(t.de.replace(/<.*>/, '').trim())} · ${t.n} mensagem(ns) · ${fmtDate(t.data)}</div></div></div>`).join('')}</div>` : '<div class="empty">Nenhuma conversa encontrada.</div>')).catch(e => falha('#g-mail', e, 'read'));
        G.driveSearch(nome, 10).then(r => put('#g-drive', (r.files || []).length ? `<div class="list">${r.files.map(f => `<div class="list-item"><div style="min-width:0;flex:1"><a class="title" target="_blank" rel="noopener" href="${esc(f.webViewLink)}">${esc(f.name)}</a><div class="meta">${esc(f.owners?.[0]?.displayName || '')} · ${fmtDate(f.modifiedTime)}</div></div></div>`).join('')}</div>` : '<div class="empty">Nenhum arquivo cita esta organização.</div>')).catch(e => falha('#g-drive', e, 'drive'));
        G.calendarSearch(nome).then(r => put('#g-cal', (r.items || []).length ? `<div class="list">${r.items.map(ev => `<div class="list-item"><div style="min-width:0;flex:1"><a class="title" target="_blank" rel="noopener" href="${esc(ev.htmlLink)}">${esc(ev.summary || '(sem título)')}</a><div class="meta">${fmtDateTime(ev.start.dateTime || ev.start.date)}${ev.hangoutLink ? ` · <a target="_blank" rel="noopener" href="${esc(ev.hangoutLink)}">Meet</a>` : ''}</div></div></div>`).join('')}</div>` : '<div class="empty">Nenhum compromisso com esta organização.</div>')).catch(e => falha('#g-cal', e, 'calendar'));
      }
    }
    if (tab === 'pesquisa') {
      const q = pq.lista.filter(p => p.quantico).length;
      T.innerHTML = `<div class="card"><h3>Pessoas de P&D <span class="muted">${pq.instituicao ? `produção registrada como ${esc(pq.instituicao.nome)}${q ? ` · ${q} em computação quântica` : ''}` : 'produção científica e lideranças citadas'}</span></h3>
        ${pq.lista.length ? `<div class="pessoas">${pq.lista.map(p => linhaPessoa(p)).join('')}</div>` : `<div class="empty">${pq.buscadoEm ? 'Nenhuma produção científica ou liderança pública identificada até agora.' : 'A coleta diária ainda não pesquisou esta organização.'}</div>`}</div>`;
      ligarPessoas(T, pq.lista, draw);
    }
    if (tab === 'busca') {
      const links = linksBusca(o.nomeFantasia || o.nome, { site: o.site });
      const grupos = [...new Set(links.map(l => l.grupo))];
      T.innerHTML = `
        <div class="grid g2">${grupos.map(g => `<div class="card"><h3>${esc(g)}</h3><div class="list">${links.filter(l => l.grupo === g).map(l => `<div class="list-item"><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.titulo)} ${icon('externo', 13)}</a></div>`).join('')}</div></div>`).join('')}
        ${o.receita?.socios?.length ? `<div class="card"><h3>Administradores (Receita Federal)</h3><div class="list">${o.receita.socios.slice(0, 10).map(s => `<div class="list-item"><div style="flex:1">${esc(s.nome)}<div class="meta">${esc(s.qualificacao)}</div></div><a class="btn sm" target="_blank" rel="noopener" href="https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(s.nome + ' ' + (o.nomeFantasia || o.nome))}">LinkedIn</a></div>`).join('')}</div></div>` : ''}</div>`;
    }
    view.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; draw(); });
    view.querySelector('#edit').onclick = () => openOrgForm(o, draw);
    view.querySelector('#ct').onclick = () => openContatoForm({ orgId: o.id }, () => { tab = 'contatos'; draw(); });
    view.querySelector('#opp').onclick = () => openOportunidadeForm({ orgId: o.id, setor: o.setor }, () => { tab = 'oportunidades'; draw(); });
    view.querySelector('#reuniao').onclick = () => openReuniaoForm({ orgId: o.id }, () => { tab = 'historico'; draw(); });
    view.querySelector('#rel').onchange = e => { o.relacionamento = e.target.value; store.touch('orgs'); store.logInteracao({ orgId: o.id, tipo: 'nota', titulo: `Relacionamento: ${e.target.selectedOptions[0].text}` }); draw(); };
    view.querySelector('#del').onclick = async () => { if (await confirmDialog(`Excluir ${o.nome}, com contatos, oportunidades e histórico?`, { ok: 'Excluir', danger: true })) { store.remove('orgs', o.id); location.hash = '#/organizacoes'; } };
  };
  draw();
  const off = store.onChange(w => { if (w === 'interacoes' && tab === 'historico') draw(); });
  return off;
}

function histList(list, actions = false) {
  if (!list.length) return '<div class="empty">Sem registros.</div>';
  const cor = { email: 'gray', recebido: 'ok', reuniao: 'marinho', ligacao: 'info', visita: 'info', evento: 'info', nota: 'gray', tarefa: 'warn' };
  return `<div class="list">${list.map(i => { const c = i.contatoId && store.get('contatos', i.contatoId); return `<div class="list-item">
    <span class="badge ${cor[i.tipo] || 'gray'}" style="min-width:96px;justify-content:center">${esc(TIPOS_INTERACAO[i.tipo] || i.tipo)}</span>
    <div style="flex:1;min-width:0"><div class="title">${esc(i.titulo)}</div>
    <div class="meta">${fmtDateTime(i.data)}${c ? ' · ' + esc(c.nome) : ''}${i.venc ? ` · próximo passo até ${fmtDate(i.venc)} ${i.concluida ? '<span class="badge ok">concluído</span>' : '<span class="badge warn">pendente</span>'}` : ''}
    ${i.threadId ? ` · <a target="_blank" rel="noopener" href="https://mail.google.com/mail/u/0/#all/${esc(i.threadId)}">conversa no Gmail</a>` : ''}${i.link ? ` · <a target="_blank" rel="noopener" href="${esc(safeUrl(i.link))}">evento no Google Agenda</a>` : ''}${i.meet ? ` · <a target="_blank" rel="noopener" href="${esc(safeUrl(i.meet))}">Meet</a>` : ''}</div>
    ${i.descricao ? `<div class="small" style="white-space:pre-wrap;color:var(--text-2)">${esc(i.descricao)}</div>` : ''}</div>
    ${actions ? `<div class="nowrap"><button class="btn sm" data-ei="${esc(i.id)}">Editar</button> <button class="btn sm ghost danger" data-di="${esc(i.id)}" aria-label="Excluir">${icon('x', 14)}</button></div>` : ''}</div>`; }).join('')}</div>`;
}
