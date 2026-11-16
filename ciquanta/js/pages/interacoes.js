import * as store from '../store.js';
import * as G from '../google.js';
import * as monitor from '../monitor.js';
import { esc, fmtDateTime, toast, options, norm, debounce } from '../util.js';
import { quickMail } from '../quickmail.js';
import { icon } from '../icons.js';

export async function render(view) {
  const f = { q: '', dir: '', org: '' };
  const draw = () => {
    const s = G.status(), m = monitor.estado();
    const pronto = s.conectado && G.hasScope('read');
    const q = norm(f.q);
    const l = [...store.list('recebidos')].filter(r => (!f.dir || r.direcao === f.dir) && (!f.org || r.orgId === f.org) &&
      (!q || norm([r.nome, r.email, r.assunto, r.snippet, store.get('orgs', r.orgId)?.nome].join(' ')).includes(q)))
      .sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    const orgsCom = [...new Set(store.list('recebidos').map(r => r.orgId).filter(Boolean))].map(id => store.get('orgs', id)).filter(Boolean);
    view.innerHTML = `<div class="section-head"><div><h2>Interações em tempo real</h2><p>Mensagens trocadas entre a conta Google do CIQUANTA e as organizações do CRM. Enquanto o sistema estiver aberto, a caixa é verificada periodicamente: cada resposta é vinculada à organização, registrada no histórico e avisada à equipe.</p></div>
      <div class="toolbar" style="margin:0">${pronto ? `<button class="btn" id="sync">Trazer últimos 14 dias</button><button class="btn" id="lidos">Marcar tudo como lido</button>${m.ativo ? '<button class="btn" id="pause">Pausar acompanhamento</button>' : '<button class="btn primary" id="start">Ativar acompanhamento</button>'}` : ''}</div></div>
      ${!s.conectado ? `<div class="callout warn">Conecte a conta Google do CIQUANTA em <a href="#/config">Configurações</a>, com a permissão de leitura do Gmail ativada.</div>`
        : !G.hasScope('read') ? `<div class="callout warn">A conta está conectada sem permissão de leitura. Ative "Ler respostas e acompanhar interações" em <a href="#/config">Configurações</a> e reconecte.</div>`
        : `<div class="callout ${m.ativo ? 'info' : ''}" style="margin-bottom:14px">${m.ativo ? `${icon('sino', 16)} Acompanhamento ativo a cada ${store.cfg().monitorSeg || 30} segundos${m.ultimo ? `; última verificação às ${new Date(m.ultimo).toLocaleTimeString('pt-BR')}` : ''}.` : 'Acompanhamento pausado.'} ${m.erro ? `<span class="badge bad">${esc(m.erro)}</span>` : ''} ${'Notification' in window && Notification.permission !== 'granted' ? '<button class="btn sm" id="notif">Permitir notificações na área de trabalho</button>' : ''}</div>`}
      <div class="toolbar"><input type="search" class="grow" id="q" placeholder="Remetente, assunto, organização" value="${esc(f.q)}">
        <select id="dir"><option value="">Entrada e saída</option><option value="entrada" ${f.dir === 'entrada' ? 'selected' : ''}>Recebidas</option><option value="saida" ${f.dir === 'saida' ? 'selected' : ''}>Enviadas pelo Gmail</option></select>
        <select id="org">${options(orgsCom.map(o => ({ id: o.id, nome: o.nome })), f.org, { empty: 'Todas as organizações' })}</select></div>
      <div class="card"><div id="lista">${l.length ? l.map(r => item(r)).join('') : '<div class="empty">Nenhuma interação registrada ainda. Ative o acompanhamento ou traga os últimos 14 dias da caixa.</div>'}</div></div>`;
    bind();
  };
  const item = r => {
    const o = store.get('orgs', r.orgId); const c = store.get('contatos', r.contatoId);
    const ini = (r.nome || r.email || '?').trim().split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase();
    return `<div class="feed-item ${r.lido ? '' : 'novo'}" data-id="${esc(r.id)}"><div class="av">${esc(ini)}</div>
      <div style="min-width:0"><div><span class="title">${esc(r.nome || r.email)}</span> <span class="muted small">&lt;${esc(r.email)}&gt;</span> ${r.direcao === 'saida' ? '<span class="badge gray">enviado</span>' : r.lido ? '' : '<span class="badge">novo</span>'} ${r.campanhaId ? '<span class="badge info">resposta a campanha</span>' : ''}</div>
      <div class="title" style="margin-top:2px">${esc(r.assunto)}</div><div class="snip">${esc(r.snippet)}</div>
      <div class="meta small">${o ? `<a href="#/org/${esc(o.id)}">${esc(o.nome)}</a>` : '<span class="badge warn">organização não identificada</span>'}${c ? ` · ${esc(c.nome)}` : ''} · ${fmtDateTime(r.data)}</div></div>
      <div class="toolbar" style="margin:0;flex-direction:column;align-items:flex-end">
        <a class="btn sm" target="_blank" rel="noopener" href="https://mail.google.com/mail/u/0/#all/${esc(r.threadId)}">${icon('externo', 14)} Abrir no Gmail</a>
        ${r.direcao === 'entrada' && !c && o ? `<button class="btn sm" data-add="${esc(r.id)}">Cadastrar contato</button>` : ''}
        ${c && r.direcao === 'entrada' ? `<button class="btn sm" data-reply="${esc(c.id)}">Responder</button>` : ''}
        ${!r.lido ? `<button class="btn sm ghost" data-lido="${esc(r.id)}">Marcar como lido</button>` : ''}</div></div>`;
  };
  const bind = () => {
    view.querySelector('#q').addEventListener('input', debounce(e => { f.q = e.target.value; draw(); const q = view.querySelector('#q'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 300));
    view.querySelector('#dir').onchange = e => { f.dir = e.target.value; draw(); };
    view.querySelector('#org').onchange = e => { f.org = e.target.value; draw(); };
    view.querySelector('#start')?.addEventListener('click', () => { monitor.iniciar(); draw(); });
    view.querySelector('#pause')?.addEventListener('click', () => { monitor.parar(); draw(); });
    view.querySelector('#lidos')?.addEventListener('click', () => { monitor.marcarLidos(); draw(); });
    view.querySelector('#notif')?.addEventListener('click', async () => { await Notification.requestPermission(); draw(); });
    view.querySelector('#sync')?.addEventListener('click', async e => {
      const b = e.target; b.disabled = true;
      try { const r = await monitor.sincronizar(14, (i, n) => { b.textContent = `Lendo ${i}/${n}…`; }); toast(`${r.lidas} mensagens lidas, ${r.vinculadas} vinculadas a organizações do CRM.`, 'ok'); draw(); }
      catch (err) { toast(err.message, 'bad'); b.disabled = false; b.textContent = 'Trazer últimos 14 dias'; }
    });
    view.querySelector('#lista').onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.lido) { monitor.marcarLidos([b.dataset.lido]); draw(); }
      if (b.dataset.reply) quickMail(store.get('contatos', b.dataset.reply));
      if (b.dataset.add) {
        const r = store.get('recebidos', b.dataset.add);
        const c = store.upsert('contatos', { nome: r.nome || r.email, email: r.email, orgId: r.orgId, fonte: 'Mensagem recebida no Gmail', tratamento: 'Prezado(a)' }, 'ct');
        store.list('recebidos').forEach(x => { if (x.email === r.email) x.contatoId = c.id; }); store.touch('recebidos');
        toast(`Contato ${c.nome} cadastrado.`, 'ok'); draw();
      }
    };
  };
  draw();
  const off = monitor.onLive(ev => { if (['novo', 'estado', 'lidos'].includes(ev.tipo)) draw(); });
  return off;
}
