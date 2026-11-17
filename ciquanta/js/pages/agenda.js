import * as store from '../store.js';
import { publicoDoEvento } from '../publico.js';
import * as G from '../google.js';
import { openReuniaoForm } from '../components.js';
import { esc, modal, formData, options, toast, isoDay, fmtDate, MESES_LONGOS, download, safeUrl, dayChip, relTime } from '../util.js';

export const TIPOS = { institucional: 'Institucional', potencial: 'Evento potencial', setorial: 'Data do setor', prazo: 'Prazo ou edital', visita: 'Visitas à réplica', reuniao: 'Reunião', google: 'Google Agenda' };

export async function render(view) {
  const now = new Date(); let ym = [now.getFullYear(), now.getMonth()]; let filtro = '';
  let gevs = [], gmsg = '';
  const carregarGoogle = async () => {
    if (!G.status().conectado) { gmsg = ''; return; }
    try {
      const r = await G.calendarEvents({ dias: 120, passado: 30 });
      gevs = (r.items || []).filter(e => e.status !== 'cancelled').map(e => ({ id: 'g-' + e.id, google: true, titulo: e.summary || '(sem título)', data: (e.start.dateTime || e.start.date).slice(0, 10),
        hora: e.start.dateTime ? new Date(e.start.dateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '', tipo: 'google', local: e.location || '', link: e.htmlLink, meet: e.hangoutLink || '', descricao: e.description || '' }));
      gmsg = '';
    } catch (e) { gmsg = 'Não foi possível ler o Google Agenda: ' + e.message; }
  };
  function draw() {
    const vis = (store.state().painel?.visitas || []).map(v => ({ id: 'v-' + v.data, visita: true, data: v.data, tipo: 'visita', titulo: `${v.visitas} visita(s), ${v.pessoas} pessoas`, local: v.grupos.join(', ') }));
    const eds = store.list('editais').filter(e => e.prazo).map(e => ({ id: 'e-' + e.id, edital: true, data: e.prazo, tipo: 'prazo', titulo: `Edital: ${e.titulo}` }));
    const evs = [...store.list('eventos'), ...gevs, ...vis, ...eds].filter(e => !filtro || e.tipo === filtro);
    const [y, m] = ym; const first = new Date(y, m, 1); const start = new Date(y, m, 1 - first.getDay());
    const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    const hoje = isoDay();
    const prox = evs.filter(e => e.data >= hoje).sort((a, b) => a.data.localeCompare(b.data)).slice(0, 12);
    view.innerHTML = `<div class="section-head"><div><h2>Agenda</h2>${gmsg ? `<p class="small" style="color:var(--warn)">${esc(gmsg)}</p>` : ''}</div>
      <div class="toolbar" style="margin:0"><button class="btn" id="ics">Exportar .ics</button><button class="btn" id="reun">Agendar reunião</button><button class="btn primary" id="novo">Novo evento</button></div></div>
      <div class="grid split-21">
        <div class="card"><div class="toolbar" style="justify-content:space-between"><div class="toolbar" style="margin:0"><button class="btn sm" id="prev" aria-label="Mês anterior">‹</button><strong style="min-width:150px;text-align:center;text-transform:capitalize">${MESES_LONGOS[m]} ${y}</strong><button class="btn sm" id="next" aria-label="Próximo mês">›</button><button class="btn sm ghost" id="today">Hoje</button></div>
          <select id="tipo" style="width:auto">${options(Object.entries(TIPOS).map(([id, nome]) => ({ id, nome })), filtro, { empty: 'Todos os tipos' })}</select></div>
          <div class="cal">${['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'].map(d => `<div class="dow">${d}</div>`).join('')}
          ${days.map(d => { const k = isoDay(d); const de = evs.filter(e => e.data === k); return `<div class="day ${d.getMonth() !== m ? 'out' : ''} ${k === hoje ? 'today' : ''}" data-day="${k}"><div class="n">${d.getDate()}</div>${de.map(e => `<span class="ev t-${esc(e.tipo)}" data-ev="${esc(e.id)}" title="${esc(e.titulo)}">${esc(e.titulo)}</span>`).join('')}</div>`; }).join('')}</div>
          <div class="tags" style="margin-top:10px">${Object.entries(TIPOS).map(([k, l]) => `<span class="ev t-${k}" style="display:inline-block">${l}</span>`).join('')}</div></div>
        <div class="card"><h3>Próximos</h3><div class="list">${prox.map(e => `<div class="list-item" data-ev="${esc(e.id)}" style="cursor:pointer">${dayChip(e.data)}<div><div class="title">${esc(e.titulo)}</div><div class="meta">${esc(TIPOS[e.tipo] || e.tipo)} · ${relTime(e.data)}${e.local ? ' · ' + esc(e.local) : ''} ${e.aConfirmar ? '<span class="badge warn">a confirmar</span>' : ''}</div></div></div>`).join('') || '<div class="empty">Nada agendado.</div>'}</div></div>
      </div>`;
    view.querySelector('#prev').onclick = () => { ym = m === 0 ? [y - 1, 11] : [y, m - 1]; draw(); };
    view.querySelector('#next').onclick = () => { ym = m === 11 ? [y + 1, 0] : [y, m + 1]; draw(); };
    view.querySelector('#today').onclick = () => { ym = [now.getFullYear(), now.getMonth()]; draw(); };
    view.querySelector('#tipo').onchange = e => { filtro = e.target.value; draw(); };
    view.querySelector('#novo').onclick = () => form({ data: hoje }, draw);
    view.querySelector('#reun').onclick = () => escolherOrg(async () => { await carregarGoogle(); draw(); });
    view.querySelector('#ics').onclick = () => { download('ciquanta-agenda.ics', ics(store.list('eventos')), 'text/calendar;charset=utf-8'); };
  }
  const onClick = e => {
    const ev = e.target.closest('[data-ev]'); if (ev) { e.stopPropagation(); if (ev.dataset.ev.startsWith('v-')) { location.hash = '#/visitas'; return; } if (ev.dataset.ev.startsWith('e-')) { location.hash = '#/editais'; return; } const g = gevs.find(x => x.id === ev.dataset.ev); if (g) detalheGoogle(g); else detalhe(store.get('eventos', ev.dataset.ev), draw); return; }
    const d = e.target.closest('[data-day]'); if (d) form({ data: d.dataset.day }, draw);
  };
  view.addEventListener('click', onClick);
  draw();
  carregarGoogle().then(draw);
  return () => view.removeEventListener('click', onClick);
}

function form(e, done) {
  const { el, close } = modal({ title: e.id ? 'Editar evento' : 'Novo evento', body: `<form class="form-grid" id="f">
    <label class="field full">Título *<input type="text" name="titulo" required value="${esc(e.titulo)}"></label>
    <label class="field">Data *<input type="date" name="data" required value="${esc(e.data)}"></label>
    <label class="field">Horário<input type="time" name="hora" value="${esc(e.hora || '')}"></label>
    <label class="field">Tipo<select name="tipo">${options(Object.entries(TIPOS).map(([id, nome]) => ({ id, nome })), e.tipo || 'institucional')}</select></label>
    <label class="field">Local<input type="text" name="local" value="${esc(e.local)}"></label>
    <label class="field full">Link oficial<input type="url" name="link" value="${esc(e.link)}" placeholder="https://"></label>
    <label class="field full">Descrição / pauta<textarea name="descricao">${esc(e.descricao)}</textarea></label>
    <label class="check full"><input type="checkbox" name="aConfirmar" ${e.aConfirmar ? 'checked' : ''}> Data ainda a confirmar</label></form>`,
    footer: `${e.id ? '<button class="btn danger" id="del" style="margin-right:auto">Excluir</button>' : ''}<button class="btn" data-close>Cancelar</button><button class="btn primary" id="ok">Salvar</button>` });
  el.querySelector('#ok').onclick = () => { const f = el.querySelector('#f'); if (!f.reportValidity()) return; const d = formData(f); d.link = safeUrl(d.link); store.upsert('eventos', { ...e, ...d }, 'ev'); toast('Evento salvo.', 'ok'); close(); done(); };
  el.querySelector('#del')?.addEventListener('click', async () => { close(); store.removerComDesfazer('eventos', e.id, 'Evento', done); done(); });
}

function gcalLink(e) {
  const d = e.data.replace(/-/g, '');
  let dates;
  if (e.hora) { const [h, mi] = e.hora.split(':'); const s = `${d}T${h}${mi}00`; const end = new Date(`${e.data}T${e.hora}:00`); end.setHours(end.getHours() + 1); dates = `${s}/${isoDay(end).replace(/-/g, '')}T${String(end.getHours()).padStart(2, '0')}${String(end.getMinutes()).padStart(2, '0')}00`; }
  else { const n = new Date(e.data + 'T12:00:00'); n.setDate(n.getDate() + 1); dates = `${d}/${isoDay(n).replace(/-/g, '')}`; }
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(e.titulo)}&dates=${dates}&details=${encodeURIComponent((e.descricao || '') + (e.link ? '\n' + e.link : ''))}&location=${encodeURIComponent(e.local || '')}&ctz=America/Fortaleza`;
}

function detalhe(e, done) {
  if (!e) return;
  const link = safeUrl(e.link);
  const { el, close } = modal({ title: e.titulo, body: `<div class="tags" style="margin-bottom:10px"><span class="ev t-${esc(e.tipo)}" style="display:inline-block">${esc(TIPOS[e.tipo] || e.tipo)}</span>${e.aConfirmar ? '<span class="badge warn">data a confirmar</span>' : ''}</div>
    <p><strong>${fmtDate(e.data, { long: true })}${e.hora ? ' · ' + esc(e.hora) : ''}</strong>${e.local ? `<br>${esc(e.local)}` : ''}</p>
    ${e.descricao ? `<p style="white-space:pre-wrap">${esc(e.descricao)}</p>` : ''}${link ? `<p><a href="${esc(link)}" target="_blank" rel="noopener">Site oficial ↗</a></p>` : ''}`,
    footer: `<button class="btn" id="edit">Editar</button><button class="btn" id="ics1">Baixar .ics</button><a class="btn" target="_blank" rel="noopener" href="${esc(gcalLink(e))}">Google Agenda ↗</a><button class="btn primary" id="conv">${['potencial', 'prazo'].includes(e.tipo) ? 'Marcar encontros' : 'Convidar público'}</button>` });
  el.querySelector('#edit').onclick = () => { close(); form(e, done); };
  el.querySelector('#ics1').onclick = () => download(`evento-${e.id}.ics`, ics([e]), 'text/calendar;charset=utf-8');
  el.querySelector('#conv').onclick = () => {
    const externo = ['potencial', 'prazo'].includes(e.tipo);
    const mod = store.get('modelos', externo ? 'mod-encontro' : 'mod-evento');
    const dest = publicoDoEvento(e);
    const c = store.upsert('campanhas', { nome: `${externo ? 'Encontro' : 'Convite'}: ${e.titulo}`, modeloId: mod?.id, eventoId: e.id, assunto: mod?.assunto || `Convite: {{evento}}`, corpo: mod?.corpo || '', vars: { evento: e.titulo, data_evento: fmtDate(e.data, { long: true }) + (e.local ? `, ${e.local}` : '') }, status: 'rascunho', modo: 'enviar', destinatarios: dest, materiais: [] }, 'cmp');
    toast(dest.length ? `${dest.length} contato(s) sugerido(s) para o público.` : 'Campanha criada; escolha o público.', 'ok');
    close(); location.hash = `#/campanhas/${c.id}`;
  };
}

function ics(evs) {
  const escI = s => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, m => '\\' + m);
  const fold = l => l.match(/.{1,73}/g).join('\r\n ');
  const out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CIQUANTA-PB//Relacoes Institucionais//PT-BR', 'CALSCALE:GREGORIAN'];
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  for (const e of evs) {
    const d = e.data.replace(/-/g, ''); const n = new Date(e.data + 'T12:00:00'); n.setDate(n.getDate() + 1);
    out.push('BEGIN:VEVENT', `UID:${e.id}@ciquanta-pb`, `DTSTAMP:${stamp}`);
    if (e.hora) out.push(`DTSTART;TZID=America/Fortaleza:${d}T${e.hora.replace(':', '')}00`, `DURATION:PT1H`);
    else out.push(`DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${isoDay(n).replace(/-/g, '')}`);
    out.push(fold(`SUMMARY:${escI((e.aConfirmar ? '[a confirmar] ' : '') + e.titulo)}`));
    if (e.local) out.push(fold(`LOCATION:${escI(e.local)}`));
    if (e.descricao || e.link) out.push(fold(`DESCRIPTION:${escI((e.descricao || '') + (e.link ? '\n' + e.link : ''))}`));
    out.push('END:VEVENT');
  }
  out.push('END:VCALENDAR');
  return out.join('\r\n');
}

function detalheGoogle(e) {
  modal({ title: e.titulo, body: `<p><strong>${fmtDate(e.data, { long: true })}${e.hora ? ' · ' + esc(e.hora) : ''}</strong>${e.local ? `<br>${esc(e.local)}` : ''}</p>${e.descricao ? `<p style="white-space:pre-wrap">${esc(e.descricao)}</p>` : ''}`,
    footer: `${e.meet ? `<a class="btn" target="_blank" rel="noopener" href="${esc(safeUrl(e.meet))}">Entrar no Meet</a>` : ''}<a class="btn primary" target="_blank" rel="noopener" href="${esc(safeUrl(e.link))}">Abrir no Google Agenda</a>` });
}

function escolherOrg(done) {
  const orgs = [...store.list('orgs')].sort((a, b) => a.nome.localeCompare(b.nome));
  const { el, close } = modal({ title: 'Agendar reunião', body: `<label class="field">Organização<select id="o">${options(orgs.map(o => ({ id: o.id, nome: o.nome })), '', { empty: 'Sem organização (reunião interna)' })}</select></label>`,
    footer: '<button class="btn" data-close>Cancelar</button><button class="btn primary" id="ok">Continuar</button>' });
  el.querySelector('#ok').onclick = () => { const id = el.querySelector('#o').value; close(); openReuniaoForm({ orgId: id || undefined }, done); };
}
