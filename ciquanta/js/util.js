// Utilitários compartilhados
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export const uid = (p = 'id') => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export const onlyDigits = s => String(s ?? '').replace(/\D/g, '');
export const isEmail = s => /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[a-z]{2,}$/i.test(String(s || '').trim());
export const safeUrl = u => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch { return ''; } };

export function debounce(fn, ms = 200) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
export const sleep = ms => new Promise(r => setTimeout(r, ms));

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export function parseDate(d) { if (!d) return null; if (d instanceof Date) return d; const s = String(d); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T12:00:00') : new Date(s); }
export function fmtDate(d, opts = {}) { const x = parseDate(d); if (!x || isNaN(x)) return '—'; return x.toLocaleDateString('pt-BR', opts.long ? { day: '2-digit', month: 'long', year: 'numeric' } : { day: '2-digit', month: '2-digit', year: 'numeric' }); }
export function fmtDateTime(d) { const x = parseDate(d); if (!x || isNaN(x)) return '—'; return x.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }); }
export function dayChip(d) { const x = parseDate(d); return x ? `<div class="date-chip">${x.getDate()}<small>${MESES[x.getMonth()]}</small></div>` : ''; }
export const isoDay = (d = new Date()) => { const x = parseDate(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
export function relTime(d) {
  const x = parseDate(d); if (!x) return '';
  const dia = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const r = Math.round((dia(x) - dia(new Date())) / 86400000);
  if (r === 0) return 'hoje';
  if (r === 1) return 'amanhã'; if (r === -1) return 'ontem';
  return r > 0 ? `em ${r} dias` : `há ${-r} dias`;
}
export const money = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
export const num = v => (Number(v) || 0).toLocaleString('pt-BR');
export const pct = (a, b) => b ? Math.round((a / b) * 100) : 0;

export function fmtCNPJ(c) { const d = onlyDigits(c); return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : c; }
export function validCNPJ(c) {
  const d = onlyDigits(c); if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calc = len => { let s = 0, p = len - 7; for (let i = 0; i < len; i++) { s += +d[i] * p--; if (p < 2) p = 9; } const r = s % 11; return r < 2 ? 0 : 11 - r; };
  return calc(12) === +d[12] && calc(13) === +d[13];
}

// ---- Constantes de domínio
export const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
export const REGIAO = { AC:'Norte',AP:'Norte',AM:'Norte',PA:'Norte',RO:'Norte',RR:'Norte',TO:'Norte', AL:'Nordeste',BA:'Nordeste',CE:'Nordeste',MA:'Nordeste',PB:'Nordeste',PE:'Nordeste',PI:'Nordeste',RN:'Nordeste',SE:'Nordeste', DF:'Centro-Oeste',GO:'Centro-Oeste',MT:'Centro-Oeste',MS:'Centro-Oeste', ES:'Sudeste',MG:'Sudeste',RJ:'Sudeste',SP:'Sudeste', PR:'Sul',RS:'Sul',SC:'Sul' };
export const SEGMENTOS = ['Empresa', 'Startup', 'Investidor', 'Fomentador', 'Autoridade', 'Academia/ICT', 'Associação/Rede', 'Imprensa', 'Outro'];
// Relacionamento com a organização (independente das oportunidades)
export const RELACIONAMENTO = [
  { id: 'mapeada', nome: 'Mapeada', cor: '#C2C3BA' },
  { id: 'contato', nome: 'Em contato', cor: '#8EA0E6' },
  { id: 'engajada', nome: 'Engajada', cor: '#2F55D4' },
  { id: 'parceira', nome: 'Parceira', cor: '#2B7A57' },
  { id: 'pausada', nome: 'Pausada', cor: '#858A9A' },
];
export const relNome = id => (RELACIONAMENTO.find(e => e.id === id) || RELACIONAMENTO[0]).nome;
// Funil de oportunidades de negócio, com probabilidade padrão por etapa
export const FUNIL = [
  { id: 'qualificacao', nome: 'Qualificação', prob: 10, cor: '#C2C3BA' },
  { id: 'reuniao', nome: 'Reunião técnica', prob: 25, cor: '#8EA0E6' },
  { id: 'proposta', nome: 'Proposta técnica', prob: 45, cor: '#2F55D4' },
  { id: 'negociacao', nome: 'Negociação e instrumento jurídico', prob: 70, cor: 'var(--tinta)' },
  { id: 'contratada', nome: 'Contratada', prob: 100, cor: '#2B7A57' },
  { id: 'perdida', nome: 'Não avançou', prob: 0, cor: '#B02F46' },
];
export const funilNome = id => (FUNIL.find(e => e.id === id) || FUNIL[0]).nome;
export const MODALIDADES = [
  { id: 'pesquisa', nome: 'Pesquisa conjunta' }, { id: 'validacao', nome: 'Validação aplicada (6 a 10 semanas)' },
  { id: 'capacitacao', nome: 'Capacitação e residência' }, { id: 'acesso', nome: 'Acesso à infraestrutura' },
  { id: 'institucional', nome: 'Cooperação institucional' }, { id: 'patrocinio', nome: 'Patrocínio ou naming rights' },
];
export const modNome = id => (MODALIDADES.find(e => e.id === id) || { nome: id || '—' }).nome;
export const BLOCOS = [ { id: 'institucional', nome: 'Institucional' }, { id: 'industrial', nome: 'Industrial e tecnológico' }, { id: 'academico', nome: 'Acadêmico' } ];
export const blocoNome = id => (BLOCOS.find(e => e.id === id) || { nome: '—' }).nome;
export const EVIDENCIA = { confirmada: ['Atuação quântica confirmada', 'ok'], indicios: ['Indícios públicos', 'info'], potencial: ['Perfil compatível', 'gray'] };
export const TIPOS_INTERACAO = { email: 'E-mail enviado', recebido: 'E-mail recebido', reuniao: 'Reunião', ligacao: 'Ligação', visita: 'Visita', evento: 'Evento', nota: 'Anotação', tarefa: 'Tarefa' };
// Formas de tratamento (mesmo padrão da planilha de convites da equipe)
export const TRATAMENTOS = [
  { id: 'Prezado(a)', saud: 'Prezado(a)', pron: 'Vossa Senhoria' },
  { id: 'Prezado Senhor', saud: 'Prezado Senhor', pron: 'Vossa Senhoria' },
  { id: 'Prezada Senhora', saud: 'Prezada Senhora', pron: 'Vossa Senhoria' },
  { id: 'Excelentíssimo Senhor', saud: 'Excelentíssimo Senhor', pron: 'Vossa Excelência' },
  { id: 'Excelentíssima Senhora', saud: 'Excelentíssima Senhora', pron: 'Vossa Excelência' },
  { id: 'Magnífico Reitor', saud: 'Magnífico Reitor', pron: 'Vossa Magnificência' },
  { id: 'Magnífica Reitora', saud: 'Magnífica Reitora', pron: 'Vossa Magnificência' },
  { id: 'Ilustríssimo Senhor', saud: 'Ilustríssimo Senhor', pron: 'Vossa Senhoria' },
  { id: 'Ilustríssima Senhora', saud: 'Ilustríssima Senhora', pron: 'Vossa Senhoria' },
  { id: 'Caro', saud: 'Caro', pron: 'você' }, { id: 'Cara', saud: 'Cara', pron: 'você' },
];
export const tratamento = id => TRATAMENTOS.find(t => t.id === id) || TRATAMENTOS[0];

// ---- UI: toast, modal
/** Aviso rápido. Com `acao`, mostra um botão (por exemplo, "Desfazer") e fica mais tempo na tela. */
export function toast(msg, kind = '', { acao, onAcao } = {}) {
  const el = document.createElement('div');
  el.className = 'toast ' + kind; el.textContent = msg;
  el.setAttribute('role', kind === 'bad' ? 'alert' : 'status');
  if (acao) { const b = document.createElement('button'); b.type = 'button'; b.textContent = acao; b.onclick = () => { el.remove(); onAcao?.(); }; el.appendChild(b); }
  $('#toasts').appendChild(el);
  const sair = () => { el.classList.add('saindo'); setTimeout(() => el.remove(), 260); };
  setTimeout(sair, acao ? 9000 : kind === 'bad' ? 7000 : 3800);
}

export function modal({ title, body, footer = '', wide = false, onMount }) {
  const root = $('#modal-root');
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <header><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Fechar">✕</button></header>
    <div class="body">${body}</div>${footer ? `<footer>${footer}</footer>` : ''}</div>`;
  const close = () => { document.removeEventListener('keydown', onKey); if (back.classList.contains('saindo')) return; back.classList.add('saindo'); setTimeout(() => back.remove(), 200); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  back.addEventListener('mousedown', e => { if (e.target === back) close(); });
  back.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', onKey);
  root.appendChild(back);
  const m = back.querySelector('.modal');
  onMount?.(m, close);
  const first = m.querySelector('input,select,textarea'); first?.focus();
  return { el: m, close };
}

export function confirmDialog(msg, { ok = 'Confirmar', danger = false } = {}) {
  return new Promise(res => {
    let done = false;
    const { el, close } = modal({ title: 'Confirmação', body: `<p>${esc(msg)}</p>`,
      footer: `<button class="btn" data-close>Cancelar</button><button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(ok)}</button>` });
    el.querySelector('[data-ok]').onclick = () => { done = true; close(); res(true); };
    const obs = new MutationObserver(() => { if (!document.body.contains(el)) { obs.disconnect(); if (!done) res(false); } });
    obs.observe($('#modal-root'), { childList: true });
  });
}

export function formData(form) {
  const o = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') { if (el.dataset.multi) { (o[el.name] ||= []); if (el.checked) o[el.name].push(el.value); } else o[el.name] = el.checked; }
    else if (el.multiple) o[el.name] = Array.from(el.selectedOptions).map(x => x.value);
    else o[el.name] = el.value.trim();
  }
  return o;
}

export const options = (list, sel, { empty } = {}) =>
  (empty !== undefined ? `<option value="">${esc(empty)}</option>` : '') +
  list.map(x => { const v = typeof x === 'object' ? x.id : x; const l = typeof x === 'object' ? x.nome : x; return `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(l)}</option>`; }).join('');

// ---- CSV
export function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/)[0] || '';
  const delim = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : (firstLine.includes('\t') ? '\t' : ',');
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const clean = rows.filter(r => r.some(x => x.trim()));
  if (!clean.length) return [];
  const head = clean[0].map(h => norm(h));
  return clean.slice(1).map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}
export function toCSV(rows, cols) {
  const e = v => { const s = Array.isArray(v) ? v.join('; ') : String(v ?? ''); return /[";\n,]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return '﻿' + [cols.map(c => e(c.label)).join(';'), ...rows.map(r => cols.map(c => e(typeof c.get === 'function' ? c.get(r) : r[c.key])).join(';'))].join('\r\n');
}
export function download(name, content, type = 'text/plain;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
/** Abre a janela do documento. Deve ser chamada direto no clique, antes de qualquer espera, para não ser barrada como pop-up. */
export function abrirJanela() {
  const w = window.open('', '_blank');
  if (!w) toast('Permita janelas pop-up neste endereço para abrir o documento.', 'bad');
  return w;
}
/** Mostra o HTML na janela aberta. Botões com `data-imprimir` acionam a impressão; `imprimir` abre o diálogo sozinho. */
export function mostrarDocumento(w, html, { imprimir = false } = {}) {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  w.location.replace(url);
  let n = 0;
  const liga = () => {
    try {
      if (w.closed) return;
      if (w.location.href !== url || w.document.readyState !== 'complete') { if (n++ < 80) setTimeout(liga, 150); return; }
      w.document.querySelectorAll('[data-imprimir]').forEach(b => { b.onclick = () => w.print(); });
      if (imprimir) setTimeout(() => w.print(), 500);
    } catch (e) { console.warn(e); }
  };
  setTimeout(liga, 150); setTimeout(() => URL.revokeObjectURL(url), 180000);
}
export function readFile(file, as = 'text') {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; as === 'dataurl' ? r.readAsDataURL(file) : as === 'buffer' ? r.readAsArrayBuffer(file) : r.readAsText(file); });
}
export const fileSize = b => b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
