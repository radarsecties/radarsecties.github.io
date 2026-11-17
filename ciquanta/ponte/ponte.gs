/**
 * CIQUANTA CRM · Ponte de e-mail
 *
 * Roda na própria conta do CIQUANTA (Google Apps Script) e dá ao CRM o que ele precisa do Google:
 * enviar e acompanhar e-mails, agenda, arquivos do Drive, planilhas do Painel CIQUANTA e a base compartilhada.
 * Não usa Google Cloud nem ID de cliente. Só atende quem traz a chave abaixo (computador que instalou a ponte)
 * ou uma sessão aberta com o código de acesso enviado ao próprio e-mail do CIQUANTA.
 *
 * Serviços avançados usados (menu Serviços +): Gmail API (obrigatório) e Google Calendar API (link do Meet).
 */
const CHAVE = '__CHAVE__';
const PASTA = 'CIQUANTA CRM';
const VERSAO = 3;
const DIAS_SESSAO = 30;
// Únicas ações atendidas sem chave nem sessão: pedir o código e entrar com ele
const PUBLICAS = { acessoPedir: true, acessoEntrar: true };

function doGet() {
  return saida({ ok: true, app: 'ciquanta-ponte', versao: VERSAO });
}

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (x) { return saida({ ok: false, erro: 'Pedido inválido.' }); }
  if (!req) return saida({ ok: false, erro: 'Pedido inválido.' });
  const acao = ACOES[req.acao];
  if (!acao) return saida({ ok: false, erro: 'Ação desconhecida: ' + req.acao });
  let sessao = null;
  if (!PUBLICAS[req.acao]) {
    if (iguais_(req.chave, CHAVE)) sessao = { admin: true };
    else if (req.sessao) sessao = sessaoValida_(req.sessao);
    if (!sessao) return saida({ ok: false, codigo: 401, erro: req.sessao ? 'Acesso encerrado ou expirado. Entre de novo com o código enviado ao e-mail do CIQUANTA.' : 'Chave de acesso incorreta.' });
  }
  try { return saida({ ok: true, dados: acao(req.dados || {}, sessao) }); }
  catch (x) { return saida({ ok: false, erro: String((x && x.message) || x) }); }
}

function saida(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function iguais_(a, b) {
  a = String(a || ''); b = String(b || '');
  if (!b || b.indexOf('__') === 0 || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
// ---- Acesso: código de uso único enviado ao próprio e-mail do CIQUANTA e sessões de 30 dias por computador
function hash_(s) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s)).map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join(''); }
function props_() { return PropertiesService.getScriptProperties(); }
function mascarar_(e) { const p = String(e).split('@'); return p[0].slice(0, 2) + '•••' + p[0].slice(-1) + '@' + p[1]; }
function sessaoValida_(token) {
  if (!/^[a-f0-9-]{60,80}$/.test(String(token))) return null;
  const k = 'sessao:' + hash_(token), p = props_(), v = p.getProperty(k);
  if (!v) return null;
  const s = JSON.parse(v);
  if (s.expira < Date.now()) { p.deleteProperty(k); return null; }
  if (Date.now() - (s.uso || 0) > 36e5) { s.uso = Date.now(); p.setProperty(k, JSON.stringify(s)); }
  s.chave = k; return s;
}
function sessoes_() {
  const todas = props_().getProperties(), out = [];
  Object.keys(todas).forEach(function (k) { if (k.indexOf('sessao:') === 0) { const s = JSON.parse(todas[k]); if (s.expira < Date.now()) props_().deleteProperty(k); else out.push([k, s]); } });
  return out;
}

function eu_() { return String(Session.getEffectiveUser().getEmail() || '').toLowerCase(); }
function exigeGmail_() { if (typeof Gmail === 'undefined') throw new Error('Ative o serviço "Gmail API" no Apps Script (Serviços +) e publique uma nova versão.'); }
function aspas_(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

/** Mensagem no mesmo formato de metadados da API do Gmail, que o CRM já entende. */
function meta_(m) {
  const me = eu_(), de = m.getFrom(), labels = [];
  if (m.isInInbox()) labels.push('INBOX');
  if (m.isUnread()) labels.push('UNREAD');
  if (m.isInTrash()) labels.push('TRASH');
  if (de.toLowerCase().indexOf(me) >= 0) labels.push('SENT');
  const h = (n, v) => ({ name: n, value: v || '' });
  let snip = '';
  try { snip = m.getPlainBody().replace(/\s+/g, ' ').slice(0, 220); } catch (x) {}
  return { id: m.getId(), threadId: m.getThread().getId(), labelIds: labels, snippet: snip, internalDate: String(m.getDate().getTime()),
    payload: { headers: [h('From', de), h('To', m.getTo()), h('Cc', m.getCc()), h('Subject', m.getSubject()), h('Date', m.getDate().toUTCString())] } };
}

function pasta_() {
  const it = DriveApp.getFoldersByName(PASTA);
  return it.hasNext() ? it.next() : DriveApp.createFolder(PASTA);
}
function arquivo_(id) { return DriveApp.getFileById(id); }
function revisao_(f) { return { id: f.getId(), headRevisionId: String(f.getLastUpdated().getTime()), modifiedTime: f.getLastUpdated().toISOString() }; }

/** Colunas com dados pessoais sensíveis não saem das planilhas do Painel CIQUANTA. */
const SENSIVEL = /cpf|rg\b|identidade|documento|telefone|celular|whats|nascimento|endere[cç]o|cep\b/i;

const ACOES = {
  // ---- Acesso
  acessoPedir: d => {
    const c = CacheService.getScriptCache(), n = Number(c.get('pedidos') || 0);
    if (n >= 6) throw new Error('Muitos pedidos de código em pouco tempo. Aguarde 15 minutos.');
    c.put('pedidos', String(n + 1), 900);
    const codigo = String(parseInt(hash_(Utilities.getUuid()).slice(0, 12), 16) % 1000000);
    const seis = ('000000' + codigo).slice(-6), quem = String(d.dispositivo || 'um computador').slice(0, 60);
    c.put('codigo', JSON.stringify({ h: hash_(seis), tentativas: 0 }), 600);
    GmailApp.sendEmail(eu_(), 'Código de acesso ao CIQUANTA CRM: ' + seis,
      'Código de acesso ao CIQUANTA CRM: ' + seis + '\n\nPedido por: ' + quem + '\nVale por 10 minutos e para uma única entrada.\n\nSe não foi alguém da equipe, ignore esta mensagem: ninguém entra sem este código.');
    return { para: mascarar_(eu_()) };
  },
  acessoEntrar: d => {
    const c = CacheService.getScriptCache(), v = c.get('codigo');
    if (!v) throw new Error('Código expirado. Peça um novo.');
    const x = JSON.parse(v);
    if (!iguais_(hash_(String(d.codigo || '').replace(/\D/g, '')), x.h)) {
      x.tentativas++;
      if (x.tentativas >= 5) { c.remove('codigo'); throw new Error('Código incorreto. Peça um novo código.'); }
      c.put('codigo', JSON.stringify(x), 600);
      throw new Error('Código incorreto.');
    }
    c.remove('codigo');
    const token = Utilities.getUuid() + '-' + Utilities.getUuid(), agora = Date.now();
    const s = { nome: String(d.dispositivo || 'Computador').slice(0, 60), criada: agora, uso: agora, expira: agora + DIAS_SESSAO * 864e5 };
    props_().setProperty('sessao:' + hash_(token), JSON.stringify(s));
    return { sessao: token, email: eu_(), expira: s.expira };
  },
  acessoSessoes: (d, sessao) => sessoes_().map(function (e) { return { id: e[0].slice(7, 19), nome: e[1].nome, criada: e[1].criada, uso: e[1].uso, expira: e[1].expira, atual: sessao.chave === e[0] }; }),
  acessoRevogar: (d, sessao) => {
    let n = 0;
    sessoes_().forEach(function (e) { if (d.id === 'todas' ? e[0] !== sessao.chave : e[0].slice(7, 19) === d.id) { props_().deleteProperty(e[0]); n++; } });
    return { encerradas: n };
  },
  acessoSair: (d, sessao) => { if (sessao.chave) props_().deleteProperty(sessao.chave); return { ok: true }; },

  ping: () => ({ email: eu_(), acesso: true, gmailAvancado: typeof Gmail !== 'undefined', agendaAvancada: typeof Calendar !== 'undefined', cotaDiaria: MailApp.getRemainingDailyQuota(), fuso: Session.getScriptTimeZone(), versao: VERSAO }),

  // ---- E-mail
  enviar: d => { exigeGmail_(); const corpo = { raw: d.raw }; if (d.threadId) corpo.threadId = d.threadId; const r = Gmail.Users.Messages.send(corpo, 'me'); return { id: r.id, threadId: r.threadId }; },
  rascunho: d => { exigeGmail_(); const r = Gmail.Users.Drafts.create({ message: { raw: d.raw } }, 'me'); return { id: r.id }; },
  novidades: d => {
    const desde = Number(d.desde) || (Date.now() - 864e5), out = [];
    const ts = GmailApp.search('after:' + Math.floor(desde / 1000 - 120), 0, Math.min(Number(d.max) || 60, 100));
    ts.forEach(t => t.getMessages().forEach(m => { if (m.getDate().getTime() > desde) out.push(meta_(m)); }));
    return { agora: Date.now(), mensagens: out };
  },
  mensagens: d => {
    const out = [];
    GmailApp.search(String(d.q || ''), 0, Math.min(Number(d.max) || 50, 100)).forEach(t => t.getMessages().forEach(m => out.push(meta_(m))));
    return out.slice(-Math.min(Number(d.max) || 50, 300));
  },
  mensagem: d => meta_(GmailApp.getMessageById(d.id)),
  conversa: d => ({ id: d.id, messages: GmailApp.getThreadById(d.id).getMessages().map(meta_) }),
  conversas: d => GmailApp.search(String(d.q || ''), 0, Math.min(Number(d.max) || 20, 50)).map(t => {
    const ms = t.getMessages(), u = ms[ms.length - 1];
    return { id: t.getId(), assunto: ms[0].getSubject() || '(sem assunto)', de: u.getFrom(), data: u.getDate().toISOString(), n: ms.length };
  }),

  // ---- Agenda
  agenda: d => {
    const ini = new Date(Date.now() - (Number(d.passado) || 7) * 864e5), fim = new Date(Date.now() + (Number(d.dias) || 60) * 864e5);
    if (typeof Calendar !== 'undefined') {
      const r = Calendar.Events.list('primary', { timeMin: ini.toISOString(), timeMax: fim.toISOString(), singleEvents: true, orderBy: 'startTime', maxResults: 250, q: d.q || undefined });
      return { items: r.items || [] };
    }
    let evs = CalendarApp.getDefaultCalendar().getEvents(ini, fim);
    if (d.q) { const q = String(d.q).toLowerCase(); evs = evs.filter(e => (e.getTitle() + ' ' + e.getDescription()).toLowerCase().indexOf(q) >= 0); }
    return { items: evs.slice(0, 250).map(e => ({ id: e.getId(), status: 'confirmed', summary: e.getTitle(), description: e.getDescription(),
      start: e.isAllDayEvent() ? { date: Utilities.formatDate(e.getAllDayStartDate(), Session.getScriptTimeZone(), 'yyyy-MM-dd') } : { dateTime: e.getStartTime().toISOString() },
      end: { dateTime: e.getEndTime().toISOString() }, htmlLink: 'https://calendar.google.com/calendar/r' })) };
  },
  agendaCriar: d => {
    if (typeof Calendar !== 'undefined') {
      const r = Calendar.Events.insert(d.evento, 'primary', { conferenceDataVersion: d.evento.conferenceData ? 1 : 0, sendUpdates: 'all' });
      return { id: r.id, htmlLink: r.htmlLink, hangoutLink: r.hangoutLink || '' };
    }
    const ev = d.evento, e = CalendarApp.getDefaultCalendar().createEvent(ev.summary, new Date(ev.start.dateTime), new Date(ev.end.dateTime),
      { description: ev.description || '', location: ev.location || '', guests: (ev.attendees || []).map(a => a.email).join(','), sendInvites: true });
    return { id: e.getId(), htmlLink: 'https://calendar.google.com/calendar/r', hangoutLink: '' };
  },

  // ---- Drive
  driveBuscar: d => {
    const t = aspas_(d.termo), out = [];
    const q = d.apresentacoes
      ? "(fullText contains '" + t + "' or title contains '" + t + "') and trashed = false and (mimeType = 'application/vnd.google-apps.presentation' or mimeType = 'application/pdf' or mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation')"
      : "fullText contains '" + t + "' and trashed = false and mimeType != 'application/vnd.google-apps.folder'";
    const it = DriveApp.searchFiles(q), max = Math.min(Number(d.max) || 15, 50);
    while (it.hasNext() && out.length < max) {
      const f = it.next(); let dono = '';
      try { dono = f.getOwner() ? f.getOwner().getName() : ''; } catch (x) {}
      out.push({ id: f.getId(), name: f.getName(), mimeType: f.getMimeType(), modifiedTime: f.getLastUpdated().toISOString(), webViewLink: f.getUrl(), owners: [{ displayName: dono }] });
    }
    out.sort((a, b) => b.modifiedTime.localeCompare(a.modifiedTime));
    return { files: out };
  },
  planilhaPorNome: d => {
    const it = DriveApp.searchFiles("title = '" + aspas_(d.nome) + "' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false");
    return it.hasNext() ? it.next().getId() : '';
  },
  planilha: d => {
    const out = {};
    SpreadsheetApp.openById(d.id).getSheets().forEach(sh => {
      const v = sh.getDataRange().getDisplayValues();
      if (v.length < 2) { out[sh.getName()] = []; return; }
      const cab = v[0].map(x => String(x).trim()), ok = cab.map(c => c && !SENSIVEL.test(c));
      out[sh.getName()] = v.slice(1).filter(r => r.some(c => String(c).trim())).map(r => { const o = {}; cab.forEach((c, i) => { if (ok[i]) o[c] = String(r[i] || '').trim(); }); return o; });
    });
    return out;
  },

  // ---- Arquivos do próprio CRM (base compartilhada, cópia de segurança), na pasta "CIQUANTA CRM"
  arquivoId: d => { const it = pasta_().getFilesByName(d.nome); return it.hasNext() ? it.next().getId() : ''; },
  arquivoMeta: d => revisao_(arquivo_(d.id)),
  arquivoLer: d => arquivo_(d.id).getBlob().getDataAsString('UTF-8'),
  arquivoGravar: d => { const l = LockService.getScriptLock(); l.waitLock(20000); try { const f = arquivo_(d.id); f.setContent(d.conteudo); return revisao_(f); } finally { l.releaseLock(); } },
  arquivoCriar: d => { const l = LockService.getScriptLock(); l.waitLock(20000); try { const p = pasta_(), it = p.getFilesByName(d.nome); const f = it.hasNext() ? it.next() : p.createFile(d.nome, d.conteudo, 'application/json'); return revisao_(f); } finally { l.releaseLock(); } },
};
