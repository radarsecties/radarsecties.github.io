// Montagem de e-mails: variáveis, layout institucional em HTML e mensagem MIME
import { cfg, orgOf, ref } from './store.js';
import { esc, MESES_LONGOS, safeUrl } from './util.js';

export const VARIAVEIS = [
  ['saudacao', 'Saudação completa (ex.: "Prezada Ana")'],
  ['nome', 'Nome do contato'], ['primeiro_nome', 'Primeiro nome'], ['cargo', 'Cargo'],
  ['organizacao', 'Organização'], ['setor', 'Setor'], ['uf', 'UF'], ['cidade', 'Cidade'],
  ['mecanismo', 'Mecanismo de fomento sugerido'],
  ['remetente', 'Seu nome'], ['cargo_remetente', 'Seu cargo'], ['telefone_remetente', 'Seu telefone'],
  ['data', 'Data de hoje por extenso'], ['evento', 'Nome do evento (campanha)'], ['data_evento', 'Data do evento (campanha)'],
];

let mecMap = null;
export async function loadMecanismos() {
  if (!mecMap) { const m = await ref('mecanismos'); mecMap = Object.fromEntries(m.itens.map(x => [x.id, x])); }
  return mecMap;
}
export const mecNome = id => mecMap?.[id]?.nome || id;
export const mecCurto = id => mecMap?.[id]?.curto || mecNome(id);

function hoje() { const d = new Date(); return `${d.getDate()} de ${MESES_LONGOS[d.getMonth()]} de ${d.getFullYear()}`; }

export function varsFor(contato, extra = {}) {
  const org = orgOf(contato) || {};
  const c = cfg();
  const nome = (contato?.nome || '').trim();
  const primeiro = nome.split(/\s+/)[0] || '';
  const trat = contato?.tratamento || 'Prezado(a)';
  const mec = (org.mecanismos || [])[0];
  return {
    saudacao: nome ? `${trat} ${/Senhor|Senhora|Excel|Ilustr/.test(trat) ? nome : primeiro}` : 'Prezados(as)',
    nome, primeiro_nome: primeiro, cargo: contato?.cargo || '',
    organizacao: org.nomeFantasia || org.nome || contato?.organizacao || 'sua organização',
    setor: org.setor || 'seu setor', uf: org.uf || '', cidade: org.cidade || '',
    mecanismo: mec ? mecNome(mec) : 'a Lei do Bem (art. 19-A, projetos com ICT)',
    remetente: c.remetenteNome || '', cargo_remetente: c.remetenteCargo || '', telefone_remetente: c.remetenteTelefone || '',
    data: hoje(), evento: '', data_evento: '',
    ...Object.fromEntries(Object.entries(extra || {}).filter(([, v]) => v)),
  };
}

/** Substitui {{variavel}}. Em HTML, os valores são escapados. */
export function merge(tpl, vars, { html = false } = {}) {
  return String(tpl || '').replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (m, k) => {
    const v = vars[k.toLowerCase()]; if (v === undefined) return m;
    return html ? esc(v) : v;
  });
}

/** Remove scripts/handlers de HTML vindo de modelos (defesa em profundidade). */
export function sanitize(html) {
  const t = document.createElement('template'); t.innerHTML = html;
  t.content.querySelectorAll('script,iframe,object,embed,form,style,link,meta').forEach(n => n.remove());
  t.content.querySelectorAll('*').forEach(n => [...n.attributes].forEach(a => {
    if (/^on/i.test(a.name) || (/^(href|src)$/i.test(a.name) && /^\s*javascript:/i.test(a.value))) n.removeAttribute(a.name);
  }));
  return t.innerHTML;
}

export function signatureHTML() {
  const c = cfg();
  if (!c.remetenteNome) return '';
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:8px;border-left:3px solid #6366F1;padding-left:12px">
  <tr><td style="font:600 14px Arial,sans-serif;color:#11142B;padding-left:12px">${esc(c.remetenteNome)}</td></tr>
  ${c.remetenteCargo ? `<tr><td style="font:13px Arial,sans-serif;color:#4A4F6A;padding-left:12px">${esc(c.remetenteCargo)}</td></tr>` : ''}
  <tr><td style="font:13px Arial,sans-serif;color:#4A4F6A;padding-left:12px">CIQuanta-PB · SECTIES · Governo da Paraíba</td></tr>
  ${c.remetenteTelefone ? `<tr><td style="font:13px Arial,sans-serif;color:#4A4F6A;padding-left:12px">${esc(c.remetenteTelefone)}</td></tr>` : ''}
  </table>`;
}

export function wrapHTML(bodyHtml, { links = [], preheader = '' } = {}) {
  const c = cfg();
  const linkBlock = links.length ? `<tr><td style="padding:0 32px 20px">
      <div style="background:#F4F6FB;border-radius:10px;padding:14px 16px">
        <div style="font:700 12px Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#4F46E5;margin-bottom:6px">Materiais institucionais</div>
        ${links.map(l => `<div style="font:14px Arial,sans-serif;margin:4px 0"><a href="${esc(l.url)}" style="color:#4F46E5">${esc(l.titulo)}</a></div>`).join('')}
      </div></td></tr>` : '';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#EEF0F7;padding:0">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF0F7;padding:24px 0">
<tr><td align="center">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:#0B1033;padding:22px 32px">
  <div style="font:700 22px Arial,sans-serif;color:#ffffff;letter-spacing:-.3px">CIQuanta<span style="color:#22D3EE">·</span>PB</div>
  <div style="font:12px Arial,sans-serif;color:#AEB3E6;margin-top:2px">Centro Internacional de Computação e Tecnologias Quânticas da Paraíba</div>
</td></tr>
<tr><td style="height:4px;background:#6366F1;background-image:linear-gradient(90deg,#22D3EE,#6366F1,#A855F7)"></td></tr>
<tr><td style="padding:28px 32px 8px;font:15px/1.6 Arial,sans-serif;color:#11142B">${bodyHtml}${signatureHTML()}</td></tr>
${linkBlock}
<tr><td style="padding:16px 32px 24px;border-top:1px solid #E3E6F0;font:11.5px/1.5 Arial,sans-serif;color:#7A7F99">
  SECTIES · Secretaria de Estado da Ciência, Tecnologia, Inovação e Ensino Superior · Governo da Paraíba<br>${esc(c.rodape || '')}
</td></tr>
</table></td></tr></table></body></html>`;
}

export function htmlToText(html) {
  const t = document.createElement('div');
  t.innerHTML = html.replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr)>/gi, '$&\n').replace(/<li>/gi, '• ');
  t.querySelectorAll('a').forEach(a => { const h = a.getAttribute('href'); if (h && h !== a.textContent) a.textContent = `${a.textContent} (${h})`; });
  return t.textContent.replace(/\n{3,}/g, '\n\n').trim();
}

// ---- MIME
const enc = new TextEncoder();
function b64(str) { const bytes = enc.encode(str); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(bin); }
const wrap76 = s => s.replace(/.{1,76}/g, '$&\r\n');
function encWord(s) {
  if (/^[\x20-\x7E]*$/.test(s)) return s;
  const chars = Array.from(s), parts = [];
  for (let i = 0; i < chars.length; i += 30) parts.push(`=?UTF-8?B?${b64(chars.slice(i, i + 30).join(''))}?=`);
  return parts.join('\r\n ');
}
const addr = (name, email) => name ? `${encWord(String(name).replace(/["\r\n]/g, ''))} <${email}>` : email;
const clean = s => String(s || '').replace(/[\r\n]+/g, ' ').trim();

/**
 * @param {{to:string,toName?:string,from?:string,fromName?:string,replyTo?:string,cc?:string,subject:string,html:string,text?:string,attachments?:{name:string,type:string,base64:string}[]}} m
 */
export function buildMime(m) {
  const B1 = 'cqm' + Math.random().toString(36).slice(2), B2 = 'cqa' + Math.random().toString(36).slice(2);
  const h = [];
  if (m.from) h.push(`From: ${addr(m.fromName, clean(m.from))}`);
  h.push(`To: ${addr(m.toName, clean(m.to))}`);
  if (m.cc) h.push(`Cc: ${clean(m.cc)}`);
  if (m.replyTo) h.push(`Reply-To: ${clean(m.replyTo)}`);
  h.push(`Subject: ${encWord(clean(m.subject))}`);
  h.push('MIME-Version: 1.0');
  if (m.from) h.push(`List-Unsubscribe: <mailto:${clean(m.replyTo || m.from)}?subject=REMOVER>`);
  const alt = [
    `--${B2}`, 'Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', wrap76(b64(m.text || htmlToText(m.html))),
    `--${B2}`, 'Content-Type: text/html; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', wrap76(b64(m.html)),
    `--${B2}--`,
  ].join('\r\n');
  if (!m.attachments?.length) return [...h, `Content-Type: multipart/alternative; boundary="${B2}"`, '', alt].join('\r\n');
  const parts = [`--${B1}`, `Content-Type: multipart/alternative; boundary="${B2}"`, '', alt];
  for (const a of m.attachments) {
    const fn = encWord(a.name.replace(/["\r\n]/g, ''));
    parts.push(`--${B1}`, `Content-Type: ${a.type || 'application/octet-stream'}; name="${fn}"`, `Content-Disposition: attachment; filename="${fn}"`, 'Content-Transfer-Encoding: base64', '', wrap76(a.base64));
  }
  parts.push(`--${B1}--`);
  return [...h, `Content-Type: multipart/mixed; boundary="${B1}"`, '', ...parts].join('\r\n');
}

/** Monta a mensagem final de uma campanha para um contato. */
export function compose(camp, contato, { materiais = [], extra = {} } = {}) {
  const vars = varsFor(contato, { ...(camp.vars || {}), ...extra });
  const subject = merge(camp.assunto, vars);
  const links = materiais.filter(m => safeUrl(m.url)).map(m => ({ titulo: m.titulo, url: safeUrl(m.url) }));
  const body = sanitize(merge(camp.corpo, vars, { html: true }));
  const html = wrapHTML(body, { links, preheader: subject });
  return { subject, html, vars };
}
