// Componentes reutilizáveis: formulários de organização, contato e interação; mapa do Brasil
import * as store from './store.js';
import { esc, modal, formData, options, toast, UFS, SEGMENTOS, ESTAGIOS, TIPOS_INTERACAO, isEmail, fmtCNPJ, validCNPJ, onlyDigits, safeUrl, isoDay } from './util.js';
import { loadMecanismos } from './email.js';

export const TRATAMENTOS = ['Prezado(a)', 'Prezado', 'Prezada', 'Caro', 'Cara', 'Senhor', 'Senhora', 'Ilustríssimo Senhor', 'Ilustríssima Senhora', 'Excelentíssimo Senhor', 'Excelentíssima Senhora'];
export const AREAS = ['P&D / Inovação', 'Diretoria / C-level', 'Relações Governamentais', 'Gabinete', 'Técnica / Engenharia', 'Jurídico / Tributário', 'Comunicação', 'Outra'];

export const segBadge = s => `<span class="badge ${s === 'Empresa' ? '' : s === 'Fomentador' ? 'ok' : s === 'Autoridade' ? 'warn' : s === 'Academia/ICT' ? 'info' : 'gray'}">${esc(s || '—')}</span>`;
export const estBadge = id => { const e = ESTAGIOS.find(x => x.id === id) || ESTAGIOS[0]; return `<span class="badge gray" style="border-color:${e.cor}55"><span style="width:7px;height:7px;border-radius:50%;background:${e.cor}"></span>${esc(e.nome)}</span>`; };

export async function mecCheckboxes(selected = []) {
  const m = await loadMecanismos();
  return `<div class="tags" style="gap:6px 12px">${Object.values(m).map(x => `<label class="check small"><input type="checkbox" name="mecanismos" data-multi="1" value="${esc(x.id)}" ${selected.includes(x.id) ? 'checked' : ''}>${esc(x.nome)}</label>`).join('')}</div>`;
}

export async function openOrgForm(org = {}, onSave) {
  const isNew = !org.id;
  const body = `<form class="form-grid" id="org-form" autocomplete="off">
    <label class="field full">Nome / Razão social *<input type="text" name="nome" required value="${esc(org.nome)}"></label>
    <label class="field">Nome fantasia<input type="text" name="nomeFantasia" value="${esc(org.nomeFantasia)}"></label>
    <label class="field">CNPJ<input type="text" name="cnpj" value="${esc(org.cnpj ? fmtCNPJ(org.cnpj) : '')}" placeholder="00.000.000/0000-00"></label>
    <label class="field">Segmento<select name="segmento">${options(SEGMENTOS, org.segmento || 'Empresa')}</select></label>
    <label class="field">Setor<input type="text" name="setor" value="${esc(org.setor)}" list="setores-list"></label>
    <label class="field">UF<select name="uf">${options(UFS, org.uf, { empty: '—' })}</select></label>
    <label class="field">Cidade<input type="text" name="cidade" value="${esc(org.cidade)}"></label>
    <label class="field">Site<input type="url" name="site" value="${esc(org.site)}" placeholder="https://"></label>
    <label class="field">E-mail institucional<input type="email" name="email" value="${esc(org.email)}"></label>
    <label class="field">Telefone<input type="tel" name="telefone" value="${esc(org.telefone)}"></label>
    <label class="field">Estágio no funil<select name="estagio">${options(ESTAGIOS, org.estagio || 'prospeccao')}</select></label>
    <label class="field">Potencial estimado (R$)<input type="number" min="0" step="1000" name="potencial" value="${esc(org.potencial || '')}"></label>
    <label class="field">Responsável no CIQuanta<input type="text" name="responsavel" value="${esc(org.responsavel)}"></label>
    <label class="field">Tags (separadas por vírgula)<input type="text" name="tags" value="${esc((org.tags || []).join(', '))}"></label>
    <div class="field full">Mecanismos de fomento aplicáveis<div id="mec-box" class="callout" style="padding:10px">Carregando…</div></div>
    <label class="field full">Notas<textarea name="notas">${esc(org.notas)}</textarea></label>
    <datalist id="setores-list">${[...new Set(store.list('orgs').map(o => o.setor).filter(Boolean))].map(s => `<option value="${esc(s)}">`).join('')}</datalist>
  </form>`;
  const { el, close } = modal({ title: isNew ? 'Nova organização' : 'Editar organização', body, wide: true,
    footer: `<button class="btn" data-close>Cancelar</button><button class="btn primary" id="org-save">Salvar</button>` });
  el.querySelector('#mec-box').innerHTML = await mecCheckboxes(org.mecanismos || []);
  el.querySelector('#org-save').onclick = () => {
    const f = el.querySelector('#org-form');
    if (!f.reportValidity()) return;
    const d = formData(f);
    if (d.cnpj && !validCNPJ(d.cnpj)) { toast('CNPJ inválido.', 'bad'); return; }
    if (d.email && !isEmail(d.email)) { toast('E-mail inválido.', 'bad'); return; }
    d.cnpj = onlyDigits(d.cnpj); d.site = safeUrl(d.site) || '';
    d.tags = d.tags ? d.tags.split(',').map(s => s.trim()).filter(Boolean) : [];
    d.potencial = Number(d.potencial) || 0;
    d.mecanismos ||= [];
    const dup = d.cnpj && store.findOrgByCNPJ(d.cnpj);
    if (dup && dup.id !== org.id) { toast(`Já existe uma organização com este CNPJ: ${dup.nome}`, 'bad'); return; }
    const saved = store.upsert('orgs', { ...org, ...d }, 'org');
    toast(isNew ? 'Organização criada.' : 'Organização atualizada.', 'ok');
    close(); onSave?.(saved);
  };
}

export function openContatoForm(c = {}, onSave) {
  const isNew = !c.id;
  const orgs = [...store.list('orgs')].sort((a, b) => a.nome.localeCompare(b.nome));
  const body = `<form class="form-grid" id="ct-form" autocomplete="off">
    <label class="field">Nome *<input type="text" name="nome" required value="${esc(c.nome)}"></label>
    <label class="field">Tratamento<select name="tratamento">${options(TRATAMENTOS, c.tratamento || 'Prezado(a)')}</select></label>
    <label class="field full">Organização *<select name="orgId" required>${options(orgs.map(o => ({ id: o.id, nome: `${o.nome}${o.uf ? ' · ' + o.uf : ''}` })), c.orgId, { empty: 'Selecione…' })}</select></label>
    <label class="field">Cargo<input type="text" name="cargo" value="${esc(c.cargo)}"></label>
    <label class="field">Área<select name="area">${options(AREAS, c.area, { empty: '—' })}</select></label>
    <label class="field">E-mail<input type="email" name="email" value="${esc(c.email)}"></label>
    <label class="field">Telefone<input type="tel" name="telefone" value="${esc(c.telefone)}"></label>
    <label class="field full">LinkedIn / página pública<input type="url" name="linkedin" value="${esc(c.linkedin)}" placeholder="https://"></label>
    <label class="field full">Fonte da informação<input type="text" name="fonte" value="${esc(c.fonte)}" placeholder="Ex.: site oficial, evento, indicação, Receita Federal"></label>
    <label class="field full">Notas<textarea name="notas">${esc(c.notas)}</textarea></label>
    <label class="check full"><input type="checkbox" name="optout" ${c.optout ? 'checked' : ''}> Não deseja receber e-mails (descadastrado)</label>
  </form>`;
  const { el, close } = modal({ title: isNew ? 'Novo contato' : 'Editar contato', body,
    footer: `<button class="btn" data-close>Cancelar</button><button class="btn primary" id="ct-save">Salvar</button>` });
  el.querySelector('#ct-save').onclick = () => {
    const f = el.querySelector('#ct-form');
    if (!f.reportValidity()) return;
    const d = formData(f);
    if (d.email && !isEmail(d.email)) { toast('E-mail inválido.', 'bad'); return; }
    d.linkedin = safeUrl(d.linkedin) || '';
    const saved = store.upsert('contatos', { ...c, ...d }, 'ct');
    if (d.email) store.suprimir(d.email, !!d.optout);
    toast(isNew ? 'Contato criado.' : 'Contato atualizado.', 'ok');
    close(); onSave?.(saved);
  };
}

export function openInteracaoForm(i = {}, onSave) {
  const contatos = i.orgId ? store.contatosDe(i.orgId) : [];
  const body = `<form class="form-grid" id="in-form">
    <label class="field">Tipo<select name="tipo">${options(Object.entries(TIPOS_INTERACAO).map(([id, nome]) => ({ id, nome })), i.tipo || 'reuniao')}</select></label>
    <label class="field">Data<input type="date" name="data" value="${esc((i.data || isoDay()).slice(0, 10))}"></label>
    <label class="field full">Título *<input type="text" name="titulo" required value="${esc(i.titulo)}"></label>
    <label class="field full">Contato<select name="contatoId">${options(contatos.map(c => ({ id: c.id, nome: c.nome })), i.contatoId, { empty: '—' })}</select></label>
    <label class="field full">Descrição / encaminhamentos<textarea name="descricao">${esc(i.descricao)}</textarea></label>
    <label class="field">Próximo passo até (follow-up)<input type="date" name="venc" value="${esc(i.venc || '')}"></label>
    <label class="check" style="align-self:end"><input type="checkbox" name="concluida" ${i.concluida ? 'checked' : ''}> Concluída</label>
  </form>`;
  const { el, close } = modal({ title: i.id ? 'Editar registro' : 'Registrar interação', body,
    footer: `<button class="btn" data-close>Cancelar</button><button class="btn primary" id="in-save">Salvar</button>` });
  el.querySelector('#in-save').onclick = () => {
    const f = el.querySelector('#in-form'); if (!f.reportValidity()) return;
    const d = formData(f);
    const saved = store.upsert('interacoes', { ...i, ...d }, 'int');
    close(); onSave?.(saved); toast('Registro salvo.', 'ok');
  };
}

// Mapa do Brasil em grade (cartograma)
const TILES = { RR: [0, 2], AP: [0, 4], AM: [1, 1], PA: [1, 3], MA: [1, 4], CE: [1, 5], RN: [1, 6], AC: [2, 0], RO: [2, 1], MT: [2, 2], TO: [2, 3], PI: [2, 4], PE: [2, 5], PB: [2, 6], MS: [3, 2], GO: [3, 3], DF: [3, 4], BA: [3, 5], AL: [3, 6], SP: [4, 3], MG: [4, 4], ES: [4, 5], SE: [4, 6], PR: [5, 3], RJ: [5, 4], SC: [6, 3], RS: [7, 3] };
export function brMap(counts, { onClick, label = 'organizações' } = {}) {
  const max = Math.max(1, ...Object.values(counts));
  const cells = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 7; c++) {
    const uf = Object.keys(TILES).find(k => TILES[k][0] === r && TILES[k][1] === c);
    if (!uf) { cells.push('<div></div>'); continue; }
    const n = counts[uf] || 0; const a = n ? 0.18 + 0.82 * (n / max) : 0;
    const style = n ? `background:rgba(99,102,241,${a.toFixed(2)});color:${a > .55 ? '#fff' : 'var(--text)'};border-color:transparent` : '';
    cells.push(`<button type="button" class="uf" data-uf="${uf}" style="${style}" title="${uf}: ${n} ${label}">${uf}${n ? `<small>${n}</small>` : ''}</button>`);
  }
  const wrap = document.createElement('div');
  wrap.className = 'br-map'; wrap.innerHTML = cells.join('');
  if (onClick) wrap.addEventListener('click', e => { const b = e.target.closest('[data-uf]'); if (b) onClick(b.dataset.uf); });
  return wrap;
}
