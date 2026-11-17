// E-mail avulso para um contato, com modelo, pré-visualização e envio pelo Gmail
import * as store from './store.js';
import * as G from './google.js';
import { compose, buildMime, loadMecanismos, htmlToText } from './email.js';
import { esc, modal, options, toast, isEmail } from './util.js';

export async function quickMail(contato) {
  await loadMecanismos();
  if (!isEmail(contato.email)) { toast('Este contato não tem e-mail válido.', 'bad'); return; }
  if (contato.optout || store.suprimido(contato.email)) { toast('Este contato pediu para não receber e-mails.', 'bad'); return; }
  const modelos = store.list('modelos');
  const mats = store.list('materiais').filter(m => m.url);
  const camp = { assunto: modelos[0]?.assunto || '', corpo: modelos[0]?.corpo || '', vars: {} };
  const body = `<div class="grid g2">
    <div style="display:grid;gap:10px;align-content:start">
      <label class="field">Modelo<select id="qm-mod">${options(modelos.map(m => ({ id: m.id, nome: m.nome })), modelos[0]?.id)}</select></label>
      <label class="field">Assunto<input type="text" id="qm-ass" value="${esc(camp.assunto)}"></label>
      <label class="field">Corpo (HTML; variáveis como {{saudacao}} são preenchidas)<textarea id="qm-corpo" style="min-height:220px;font-family:ui-monospace,monospace;font-size:12px">${esc(camp.corpo)}</textarea></label>
      ${mats.length ? `<div class="field">Incluir links de materiais<div class="tags" style="gap:4px 12px">${mats.map(m => `<label class="check small"><input type="checkbox" data-mat value="${esc(m.id)}">${esc(m.titulo)}</label>`).join('')}</div></div>` : ''}
    </div>
    <div><div class="muted small" style="margin-bottom:4px">Pré-visualização para <strong>${esc(contato.nome)}</strong> &lt;${esc(contato.email)}&gt;</div><iframe class="preview-frame" id="qm-prev" sandbox title="Pré-visualização"></iframe></div>
  </div>`;
  const { el, close } = modal({ title: 'Enviar e-mail', body, wide: true, footer: `
    <button class="btn" data-close>Cancelar</button>
    <a class="btn" id="qm-web" target="_blank" rel="noopener">Abrir no Gmail (web)</a>
    <button class="btn" id="qm-draft">Salvar como rascunho</button>
    <button class="btn primary" id="qm-send">Enviar pelo Gmail</button>` });
  const cur = () => {
    camp.assunto = el.querySelector('#qm-ass').value; camp.corpo = el.querySelector('#qm-corpo').value;
    const materiais = [...el.querySelectorAll('[data-mat]:checked')].map(i => store.get('materiais', i.value)).filter(Boolean);
    return compose(camp, contato, { materiais });
  };
  const refresh = () => {
    const m = cur(); el.querySelector('#qm-prev').srcdoc = m.html;
    const text = htmlToText(m.html.replace(/^[\s\S]*?<td style="padding:28px 32px 8px[^>]*>/, '').replace(/<\/td><\/tr>[\s\S]*$/, ''));
    el.querySelector('#qm-web').href = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(contato.email)}&su=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(text.slice(0, 1800))}`;
  };
  el.querySelector('#qm-mod').onchange = e => { const m = store.get('modelos', e.target.value); el.querySelector('#qm-ass').value = m.assunto; el.querySelector('#qm-corpo').value = m.corpo; refresh(); };
  el.addEventListener('input', refresh); el.addEventListener('change', e => { if (e.target.matches('[data-mat]')) refresh(); });
  refresh();
  const go = async draft => {
    try {
      if (!G.status().conectado) await G.connect();
      const m = cur(); const conf = store.cfg();
      const raw = buildMime({ to: contato.email, toName: contato.nome, from: G.status().email, fromName: conf.remetenteNome, replyTo: conf.replyTo, subject: m.subject, html: m.html });
      const r = draft ? await G.draftRaw(raw) : await G.sendRaw(raw);
      const msg = draft ? r.message : r;
      if (!draft) {
        store.upsert('envios', { campanhaId: '', contatoId: contato.id, email: contato.email, status: 'enviado', messageId: msg?.id, threadId: msg?.threadId, assunto: m.subject, data: new Date().toISOString() }, 'env');
        store.logInteracao({ orgId: contato.orgId, contatoId: contato.id, tipo: 'email', titulo: m.subject, descricao: 'E-mail avulso', threadId: msg?.threadId });
        const org = store.orgOf(contato); if (org && (!org.relacionamento || org.relacionamento === 'mapeada')) { org.relacionamento = 'contato'; store.touch('orgs'); }
      }
      toast(draft ? 'Rascunho criado no Gmail.' : 'E-mail enviado.', 'ok'); close();
    } catch (e) { toast(e.message, 'bad'); }
  };
  el.querySelector('#qm-send').onclick = () => go(false);
  el.querySelector('#qm-draft').onclick = () => go(true);
}
