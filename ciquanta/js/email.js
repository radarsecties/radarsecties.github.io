// Montagem de e-mails: variáveis, layout institucional CIQUANTA em HTML e mensagem MIME
import { cfg, orgOf, ref, setorRef, loadSetores } from './store.js';
import { esc, MESES_LONGOS, safeUrl, tratamento } from './util.js';
import { deckUrl } from './deck.js';

export const VARIAVEIS = [
  ['saudacao', 'Saudação com tratamento (ex.: "Excelentíssimo Senhor João Silva")'],
  ['pronome', 'Pronome de tratamento (Vossa Excelência, Vossa Magnificência, Vossa Senhoria)'],
  ['nome', 'Nome do contato'], ['primeiro_nome', 'Primeiro nome'], ['cargo', 'Cargo'],
  ['organizacao', 'Organização'], ['setor', 'Setor da organização'], ['uf', 'UF'], ['cidade', 'Cidade'],
  ['mecanismo', 'Mecanismo de fomento associado'], ['apresentacao', 'Link da apresentação setorial'], ['institucional', 'Link da apresentação institucional'],
  ['remetente', 'Seu nome'], ['cargo_remetente', 'Seu cargo'], ['telefone_remetente', 'Seu telefone'],
  ['data', 'Data de hoje por extenso'], ['evento', 'Nome do evento (campanha)'], ['data_evento', 'Data do evento (campanha)'],
];

let mecMap = null;
export async function loadMecanismos() {
  if (!mecMap) { const m = await ref('mecanismos'); mecMap = Object.fromEntries(m.itens.map(x => [x.id, x])); }
  await loadSetores();
  return mecMap;
}
export const mecNome = id => mecMap?.[id]?.nome || id;
export const mecCurto = id => mecMap?.[id]?.curto || mecNome(id);

function hoje() { const d = new Date(); return `${d.getDate()} de ${MESES_LONGOS[d.getMonth()]} de ${d.getFullYear()}`; }

/** Endereço público do sistema (para links de apresentações e imagens no e-mail). */
export function enderecoPublico() {
  const c = (cfg().enderecoPublico || '').trim();
  if (c) return c.endsWith('/') ? c : c + '/';
  if (location.protocol === 'https:' && !/localhost|127\.0\.0\.1/.test(location.hostname)) return new URL('.', location.href).href;
  return '';
}
export function linkApresentacao(setorId) {
  const base = enderecoPublico();
  const s = setorId || 'institucional';
  const rel = deckUrl(s).replace(new URL('../', import.meta.url).href, '');
  return base ? base + rel : deckUrl(s);
}

export function varsFor(contato, extra = {}) {
  const org = orgOf(contato) || {};
  const c = cfg();
  const nome = (contato?.nome || '').trim();
  const primeiro = nome.split(/\s+/)[0] || '';
  const t = tratamento(contato?.tratamento);
  const formal = /Excel|Magn|Ilustr|Senhor|Senhora/.test(t.saud);
  const mec = (org.mecanismos || [])[0];
  return {
    saudacao: contato?.canal ? 'Prezados senhores e senhoras' : nome ? `${t.saud} ${formal ? nome : primeiro}` : 'Prezados',
    pronome: contato?.canal ? 'Vossas Senhorias' : t.pron,
    nome: contato?.canal ? '' : nome, primeiro_nome: contato?.canal ? '' : primeiro, cargo: contato?.cargo || '',
    organizacao: org.nomeFantasia || org.nome || 'sua organização',
    setor: org.setor ? setorRef(org.setor) : 'o seu setor',
    uf: org.uf || '', cidade: org.cidade || '',
    mecanismo: mec ? mecNome(mec) : 'a Lei do Bem (art. 19-A, projetos executados por ICT)',
    apresentacao: linkApresentacao(org.setor),
    institucional: linkApresentacao('institucional'),
    remetente: c.remetenteNome || '', cargo_remetente: c.remetenteCargo || '', telefone_remetente: c.remetenteTelefone || '',
    data: hoje(), evento: '', data_evento: '',
    ...Object.fromEntries(Object.entries(extra || {}).filter(([, v]) => v)),
  };
}

/** Substitui {{variavel}}. Em HTML os valores são escapados e links viram âncoras. */
export function merge(tpl, vars, { html = false } = {}) {
  return String(tpl || '').replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (m, k) => {
    const v = vars[k.toLowerCase()]; if (v === undefined) return m;
    if (html && /^https?:\/\//.test(v)) return `<a href="${esc(v)}" style="color:#3056D5">${esc(v)}</a>`;
    return html ? esc(v) : v;
  });
}

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
  const l = (t, w = 400, cor = '#5B6680') => `<tr><td style="font:${w} 13px Arial,Helvetica,sans-serif;color:${cor};padding:1px 0 1px 12px">${t}</td></tr>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:14px;border-left:3px solid #3056D5">
  ${l(esc(c.remetenteNome), 700, '#14224A')}${c.remetenteCargo ? l(esc(c.remetenteCargo)) : ''}
  ${l('CIQUANTA · Centro Internacional de Computação e Tecnologias Quânticas do Estado da Paraíba')}
  ${c.remetenteTelefone ? l(esc(c.remetenteTelefone)) : ''}${c.replyTo ? l(`<a href="mailto:${esc(c.replyTo)}" style="color:#3056D5">${esc(c.replyTo)}</a>`) : ''}</table>`;
}

export function wrapHTML(bodyHtml, { links = [], preheader = '' } = {}) {
  const c = cfg();
  const base = enderecoPublico();
  const logo = base ? `<img src="${esc(base)}assets/logo-azul.png" width="250" alt="CIQUANTA" style="display:block;width:250px;height:auto;border:0">` : `<div style="font:700 24px Arial,sans-serif;color:#3056D5;letter-spacing:2px">CIQUANTA</div>`;
  const gov = base ? `<img src="${esc(base)}assets/secties-govpb.png" width="190" alt="Secretaria de Estado da Ciência, Tecnologia, Inovação e Ensino Superior · Governo da Paraíba" style="display:block;width:190px;height:auto;border:0">` : '';
  const parceiros = base ? `<img src="${esc(base)}assets/parceiros-marinho.png" width="480" alt="CETC · Ministério da Ciência, Tecnologia e Inovação · Governo do Brasil · SECTIES · Governo da Paraíba" style="display:block;width:480px;max-width:100%;height:auto;border:0;margin:0 0 12px">` : '';
  const linkBlock = links.length ? `<tr><td style="padding:0 36px 22px">
      <div style="background:#EEF2FB;border-radius:8px;padding:16px 20px">
        <div style="font:700 12px Arial,sans-serif;color:#C8232C;margin-bottom:6px">Materiais</div>
        ${links.map(l => `<div style="font:14px Arial,sans-serif;margin:5px 0"><a href="${esc(l.url)}" style="color:#3056D5;font-weight:700">${esc(l.titulo)}</a></div>`).join('')}
      </div></td></tr>` : '';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#EEF2FB;padding:0">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF2FB;padding:26px 0">
<tr><td align="center">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden">
<tr><td style="padding:28px 36px 22px;border-bottom:3px solid #3056D5">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td valign="middle">${logo}</td><td valign="middle" align="right">${gov}</td></tr></table>
  <div style="font:700 13px Arial,sans-serif;color:#14224A;margin-top:14px">Centro Internacional de Computação e Tecnologias Quânticas do Estado da Paraíba</div>
</td></tr>
<tr><td style="padding:30px 36px 10px;font:15px/1.6 Arial,Helvetica,sans-serif;color:#14224A">${bodyHtml}${signatureHTML()}</td></tr>
${linkBlock}
<tr><td style="padding:20px 36px 26px;border-top:1px solid #D5DCEA;font:11.5px/1.55 Arial,sans-serif;color:#5B6680">
  ${parceiros}Estação das Artes Luciano Agra, Altiplano Cabo Branco, João Pessoa (PB) · <a href="https://ciquanta.secties.pb.gov.br" style="color:#3056D5">ciquanta.secties.pb.gov.br</a><br>${esc(c.rodape || '')}
</td></tr>
</table></td></tr></table></body></html>`;
}

export function htmlToText(html) {
  const t = document.createElement('div');
  t.innerHTML = html.replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr)>/gi, '$&\n').replace(/<li>/gi, '• ');
  t.querySelectorAll('img').forEach(i => i.replaceWith(i.alt || ''));
  t.querySelectorAll('a').forEach(a => { const h = a.getAttribute('href'); if (h && h !== a.textContent && !h.startsWith('mailto:')) a.textContent = `${a.textContent} (${h})`; });
  return t.textContent.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
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

export function compose(camp, contato, { materiais = [], extra = {} } = {}) {
  const vars = varsFor(contato, { ...(camp.vars || {}), ...extra });
  const subject = merge(camp.assunto, vars);
  const links = materiais.filter(m => safeUrl(m.url)).map(m => ({ titulo: m.titulo, url: safeUrl(m.url) }));
  const body = sanitize(merge(camp.corpo, vars, { html: true }));
  const html = wrapHTML(body, { links, preheader: subject });
  return { subject, html, vars };
}
