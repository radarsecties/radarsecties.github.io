// Componentes reutilizáveis: formulários (organização, contato, interação, oportunidade, reunião) e mapa do Brasil
import * as store from './store.js';
import * as G from './google.js';
import { esc, modal, formData, options, toast, UFS, SEGMENTOS, RELACIONAMENTO, FUNIL, MODALIDADES, BLOCOS, EVIDENCIA, TIPOS_INTERACAO, TRATAMENTOS,
  isEmail, fmtCNPJ, validCNPJ, onlyDigits, safeUrl, isoDay, money } from './util.js';
import { loadMecanismos } from './email.js';

export const AREAS = ['P&D e inovação', 'Diretoria executiva', 'Relações governamentais e institucionais', 'Gabinete', 'Tecnologia e engenharia', 'Jurídico e tributário', 'Comunicação', 'Pesquisa acadêmica', 'Outra'];

export const segBadge = s => `<span class="badge ${s === 'Empresa' || s === 'Startup' ? '' : s === 'Fomentador' ? 'ok' : s === 'Autoridade' ? 'marinho' : s === 'Academia/ICT' ? 'info' : 'gray'}">${esc(s || '—')}</span>`;
export const relBadge = id => { const e = RELACIONAMENTO.find(x => x.id === id) || RELACIONAMENTO[0]; return `<span class="badge gray"><span class="dot-i" style="background:${e.cor}"></span>${esc(e.nome)}</span>`; };
export const funilBadge = id => { const e = FUNIL.find(x => x.id === id) || FUNIL[0]; return `<span class="badge gray"><span class="dot-i" style="background:${e.cor}"></span>${esc(e.nome)}</span>`; };
export const evBadge = ev => { const [l, k] = EVIDENCIA[ev] || EVIDENCIA.potencial; return `<span class="badge ${k}" title="${esc(l)}">${esc(l)}</span>`; };
const setorOpts = sel => options(store.setoresLista().map(s => ({ id: s.id, nome: s.nome })), sel, { empty: 'Selecione…' });

export async function mecCheckboxes(selected = []) {
  const m = await loadMecanismos();
  return `<div class="tags" style="gap:6px 14px">${Object.values(m).map(x => `<label class="check small"><input type="checkbox" name="mecanismos" data-multi="1" value="${esc(x.id)}" ${selected.includes(x.id) ? 'checked' : ''}>${esc(x.curto || x.nome)}</label>`).join('')}</div>`;
}

export async function openOrgForm(org = {}, onSave) {
  await store.loadSetores();
  const isNew = !org.id;
  const body = `<form class="form-grid" id="org-form" autocomplete="off">
    <label class="field full">Nome ou razão social *<input type="text" name="nome" required value="${esc(org.nome)}"></label>
    <label class="field">Nome fantasia<input type="text" name="nomeFantasia" value="${esc(org.nomeFantasia)}"></label>
    <label class="field">CNPJ<input type="text" name="cnpj" value="${esc(org.cnpj ? fmtCNPJ(org.cnpj) : '')}" placeholder="00.000.000/0000-00"></label>
    <label class="field">Segmento<select name="segmento">${options(SEGMENTOS, org.segmento || 'Empresa')}</select></label>
    <label class="field">Setor<select name="setor">${setorOpts(org.setor)}</select></label>
    <label class="field">Bloco de parceria<select name="bloco">${options(BLOCOS, org.bloco || 'industrial')}</select></label>
    <label class="field">Relacionamento<select name="relacionamento">${options(RELACIONAMENTO, org.relacionamento || 'mapeada')}</select></label>
    <label class="field">Atuação quântica<select name="evidencia">${options(Object.entries(EVIDENCIA).map(([id, [nome]]) => ({ id, nome })), org.evidencia || 'potencial')}</select></label>
    <label class="field">Prioridade<select name="prioridade">${options([{ id: 'A', nome: 'A, alta' }, { id: 'B', nome: 'B, média' }, { id: 'C', nome: 'C, baixa' }], org.prioridade || 'B')}</select></label>
    <label class="field">UF<select name="uf">${options(UFS, org.uf, { empty: '—' })}</select></label>
    <label class="field">Cidade<input type="text" name="cidade" value="${esc(org.cidade)}"></label>
    <label class="field">Site<input type="url" name="site" value="${esc(org.site)}" placeholder="https://"></label>
    <label class="field">E-mail institucional<input type="email" name="email" value="${esc(org.email)}"></label>
    <label class="field">Telefone<input type="tel" name="telefone" value="${esc(org.telefone)}"></label>
    <label class="field">Responsável no CIQUANTA<input type="text" name="responsavel" value="${esc(org.responsavel)}"></label>
    <label class="field full">Atuação em P&D ou quântica (com fonte)<textarea name="atuacao" style="min-height:60px">${esc(org.atuacao)}</textarea></label>
    <label class="field full">Tags (separadas por vírgula)<input type="text" name="tags" value="${esc((org.tags || []).join(', '))}"></label>
    <div class="field full">Mecanismos de fomento aplicáveis<div id="mec-box" class="callout" style="padding:10px">Carregando…</div></div>
    <label class="field full">Notas<textarea name="notas">${esc(org.notas)}</textarea></label>
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
    <label class="field">Tratamento<select name="tratamento">${options(TRATAMENTOS.map(t => ({ id: t.id, nome: `${t.id} (${t.pron})` })), c.tratamento || 'Prezado(a)')}</select></label>
    <label class="field full">Organização *<select name="orgId" required>${options(orgs.map(o => ({ id: o.id, nome: `${o.nome}${o.uf ? ' · ' + o.uf : ''}` })), c.orgId, { empty: 'Selecione…' })}</select></label>
    <label class="field">Cargo<input type="text" name="cargo" value="${esc(c.cargo)}"></label>
    <label class="field">Área<select name="area">${options(AREAS, c.area, { empty: '—' })}</select></label>
    <label class="field">E-mail<input type="email" name="email" value="${esc(c.email)}"></label>
    <label class="field">Telefone<input type="tel" name="telefone" value="${esc(c.telefone)}"></label>
    <label class="field full">LinkedIn ou página pública<input type="url" name="linkedin" value="${esc(c.linkedin)}" placeholder="https://"></label>
    <label class="field full">Fonte da informação<input type="text" name="fonte" value="${esc(c.fonte)}" placeholder="Ex.: site oficial, evento, indicação, Receita Federal"></label>
    <label class="field full">Notas<textarea name="notas">${esc(c.notas)}</textarea></label>
    <label class="check full"><input type="checkbox" name="optout" ${c.optout ? 'checked' : ''}> Pediu para não receber e-mails</label>
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
    <label class="field full">Descrição e encaminhamentos<textarea name="descricao">${esc(i.descricao)}</textarea></label>
    <label class="field">Próximo passo até<input type="date" name="venc" value="${esc(i.venc || '')}"></label>
    <label class="check" style="align-self:end"><input type="checkbox" name="concluida" ${i.concluida ? 'checked' : ''}> Concluído</label>
  </form>`;
  const { el, close } = modal({ title: i.id ? 'Editar registro' : 'Registrar interação', body,
    footer: `<button class="btn" data-close>Cancelar</button><button class="btn primary" id="in-save">Salvar</button>` });
  el.querySelector('#in-save').onclick = () => {
    const f = el.querySelector('#in-form'); if (!f.reportValidity()) return;
    const saved = store.upsert('interacoes', { ...i, ...formData(f) }, 'int');
    close(); onSave?.(saved); toast('Registro salvo.', 'ok');
  };
}

export async function openOportunidadeForm(op = {}, onSave) {
  const m = await loadMecanismos();
  const orgs = [...store.list('orgs')].sort((a, b) => a.nome.localeCompare(b.nome));
  const org = op.orgId && store.get('orgs', op.orgId);
  const setor = op.setor || org?.setor || '';
  const linhas = store.setoresLista().find(s => s.id === setor)?.linhas || [];
  const body = `<form class="form-grid" id="op-form" autocomplete="off">
    <label class="field full">Título da oportunidade *<input type="text" name="titulo" required value="${esc(op.titulo)}" placeholder="Ex.: validação aplicada em otimização de carteiras"></label>
    <label class="field full">Organização *<select name="orgId" required>${options(orgs.map(o => ({ id: o.id, nome: o.nome })), op.orgId, { empty: 'Selecione…' })}</select></label>
    <label class="field">Setor<select name="setor">${setorOpts(setor)}</select></label>
    <label class="field">Linha de pesquisa<select name="linha">${options(linhas.map(l => ({ id: l.id, nome: l.nome })), op.linha, { empty: '—' })}</select></label>
    <label class="field">Modalidade<select name="modalidade">${options(MODALIDADES, op.modalidade || 'validacao')}</select></label>
    <label class="field">Mecanismo de financiamento<select name="mecanismo">${options(Object.values(m).map(x => ({ id: x.id, nome: x.curto || x.nome })), op.mecanismo, { empty: '—' })}</select></label>
    <label class="field">Etapa<select name="etapa">${options(FUNIL, op.etapa || 'qualificacao')}</select></label>
    <label class="field">Probabilidade (%)<input type="number" min="0" max="100" name="probabilidade" value="${esc(op.probabilidade ?? FUNIL[0].prob)}"></label>
    <label class="field">Valor estimado (R$)<input type="number" min="0" step="1000" name="valor" value="${esc(op.valor || '')}"></label>
    <label class="field">Previsão de fechamento<input type="date" name="previsao" value="${esc(op.previsao || '')}"></label>
    <label class="field">Responsável<input type="text" name="responsavel" value="${esc(op.responsavel || store.cfg().remetenteNome)}"></label>
    <label class="field">Próximo passo até<input type="date" name="proximoEm" value="${esc(op.proximoEm || '')}"></label>
    <label class="field full">Próximo passo<input type="text" name="proximoPasso" value="${esc(op.proximoPasso)}"></label>
    <label class="field full">Notas<textarea name="notas">${esc(op.notas)}</textarea></label>
  </form>`;
  const { el, close } = modal({ title: op.id ? 'Editar oportunidade' : 'Nova oportunidade', body, wide: true,
    footer: `${op.id ? '<button class="btn" id="op-prop" style="margin-right:auto">Gerar proposta em PDF</button>' : ''}<button class="btn" data-close>Cancelar</button><button class="btn primary" id="op-save">Salvar</button>` });
  const f = el.querySelector('#op-form');
  el.querySelector('#op-prop')?.addEventListener('click', async () => { const { gerarProposta } = await import('./proposta.js'); gerarProposta(op.id); });
  f.etapa.onchange = () => { f.probabilidade.value = (FUNIL.find(x => x.id === f.etapa.value) || FUNIL[0]).prob; };
  f.orgId.onchange = () => { const o = store.get('orgs', f.orgId.value); if (o?.setor && !f.setor.value) { f.setor.value = o.setor; f.setor.dispatchEvent(new Event('change')); } };
  f.setor.onchange = () => { const ls = store.setoresLista().find(s => s.id === f.setor.value)?.linhas || []; f.linha.innerHTML = options(ls.map(l => ({ id: l.id, nome: l.nome })), '', { empty: '—' }); };
  el.querySelector('#op-save').onclick = () => {
    if (!f.reportValidity()) return;
    const d = formData(f); d.valor = Number(d.valor) || 0; d.probabilidade = Math.min(100, Math.max(0, Number(d.probabilidade) || 0));
    const antes = op.etapa;
    const saved = store.upsert('oportunidades', { ...op, ...d }, 'opp');
    if (antes !== d.etapa) {
      store.logInteracao({ orgId: d.orgId, tipo: 'nota', titulo: `Oportunidade "${d.titulo}": ${FUNIL.find(x => x.id === d.etapa).nome}` });
      const o = store.get('orgs', d.orgId);
      if (o) { if (d.etapa === 'contratada') o.relacionamento = 'parceira'; else if (['mapeada', 'contato'].includes(o.relacionamento || 'mapeada') && d.etapa !== 'perdida') o.relacionamento = 'engajada'; store.touch('orgs'); }
    }
    toast(op.id ? 'Oportunidade atualizada.' : `Oportunidade criada: ${money(d.valor)}.`, 'ok'); close(); onSave?.(saved);
  };
}

/** Agenda uma reunião no Google Agenda com convite aos contatos e link do Meet. */
export function openReuniaoForm({ orgId, contatoIds = [], oportunidadeId = '', titulo = '' } = {}, onSave) {
  const org = orgId && store.get('orgs', orgId);
  const contatos = orgId ? store.contatosDe(orgId) : [];
  const amanha = new Date(Date.now() + 864e5); amanha.setHours(10, 0, 0, 0);
  const pad = n => String(n).padStart(2, '0');
  const local = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const body = `<form class="form-grid" id="re-form">
    <label class="field full">Título *<input type="text" name="titulo" required value="${esc(titulo || (org ? `CIQUANTA e ${org.nomeFantasia || org.nome}: reunião técnica` : 'Reunião CIQUANTA'))}"></label>
    <label class="field">Início *<input type="datetime-local" name="inicio" required value="${local(amanha)}"></label>
    <label class="field">Duração<select name="duracao"><option value="30">30 min</option><option value="45">45 min</option><option value="60" selected>1 hora</option><option value="90">1h30</option><option value="120">2 horas</option></select></label>
    <div class="field full">Convidados<div class="tags" style="gap:4px 14px">${contatos.filter(c => isEmail(c.email)).map(c => `<label class="check small"><input type="checkbox" name="conv" data-multi="1" value="${esc(c.email)}" ${contatoIds.includes(c.id) ? 'checked' : ''}>${esc(c.nome)} &lt;${esc(c.email)}&gt;</label>`).join('') || '<span class="muted small">Organização sem contatos com e-mail.</span>'}</div></div>
    <label class="field full">Outros convidados (separados por vírgula)<input type="text" name="outros" placeholder="equipe@secties.pb.gov.br"></label>
    <label class="field full">Local<input type="text" name="local" placeholder="Videoconferência ou endereço"></label>
    <label class="field full">Pauta<textarea name="descricao">Apresentação do CIQUANTA e da agenda de pesquisa aplicada${org?.setor ? ' para ' + store.setorRef(org.setor) : ''}.\nIdentificação de um primeiro projeto e do instrumento de financiamento.</textarea></label>
    <label class="check full"><input type="checkbox" name="meet" checked> Criar link do Google Meet</label>
  </form>`;
  const { el, close } = modal({ title: 'Agendar reunião no Google Agenda', body,
    footer: `<button class="btn" data-close>Cancelar</button><button class="btn primary" id="re-save">Agendar e enviar convites</button>` });
  el.querySelector('#re-save').onclick = async ev => {
    const f = el.querySelector('#re-form'); if (!f.reportValidity()) return;
    const d = formData(f);
    const convidados = [...(d.conv || []), ...d.outros.split(',').map(s => s.trim()).filter(isEmail)];
    const inicio = new Date(d.inicio), fim = new Date(inicio.getTime() + Number(d.duracao) * 60000);
    ev.target.disabled = true;
    try {
      if (!G.status().conectado) await G.connect();
      if (!G.hasScope('calendar')) throw new Error('Ative a Agenda em Configurações e reconecte a conta Google.');
      const r = await G.createEvent({ titulo: d.titulo, descricao: d.descricao, inicio, fim, convidados, local: d.local, meet: !!d.meet });
      if (orgId) {
        store.logInteracao({ orgId, tipo: 'reuniao', titulo: d.titulo, data: inicio.toISOString(), descricao: `${d.descricao}\nConvidados: ${convidados.join(', ') || '—'}`, link: r.htmlLink, meet: r.hangoutLink || '', calendarId: r.id, oportunidadeId });
        const o = store.get('orgs', orgId); if (o && ['mapeada', 'contato'].includes(o.relacionamento || 'mapeada')) { o.relacionamento = 'engajada'; store.touch('orgs'); }
      }
      toast('Reunião criada no Google Agenda e convites enviados.', 'ok'); close(); onSave?.(r);
    } catch (e) { toast(e.message, 'bad'); ev.target.disabled = false; }
  };
}

// Mapa do Brasil em grade
const TILES = { RR: [0, 2], AP: [0, 4], AM: [1, 1], PA: [1, 3], MA: [1, 4], CE: [1, 5], RN: [1, 6], AC: [2, 0], RO: [2, 1], MT: [2, 2], TO: [2, 3], PI: [2, 4], PE: [2, 5], PB: [2, 6], MS: [3, 2], GO: [3, 3], DF: [3, 4], BA: [3, 5], AL: [3, 6], SP: [4, 3], MG: [4, 4], ES: [4, 5], SE: [4, 6], PR: [5, 3], RJ: [5, 4], SC: [6, 3], RS: [7, 3] };
export function brMap(counts, { onClick, label = 'organizações' } = {}) {
  const max = Math.max(1, ...Object.values(counts));
  const cells = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 7; c++) {
    const uf = Object.keys(TILES).find(k => TILES[k][0] === r && TILES[k][1] === c);
    if (!uf) { cells.push('<div></div>'); continue; }
    const n = counts[uf] || 0; const a = n ? 0.2 + 0.8 * (n / max) : 0;
    const style = n ? `background:rgba(48,86,213,${a.toFixed(2)});color:${a > .5 ? '#fff' : 'var(--text)'};border-color:transparent` : '';
    cells.push(`<button type="button" class="uf" data-uf="${uf}" style="${style}" title="${uf}: ${n} ${label}">${uf}${n ? `<small>${n}</small>` : ''}</button>`);
  }
  const wrap = document.createElement('div');
  wrap.className = 'br-map'; wrap.innerHTML = cells.join('');
  if (onClick) wrap.addEventListener('click', e => { const b = e.target.closest('[data-uf]'); if (b) onClick(b.dataset.uf); });
  return wrap;
}

/**
 * Mapa de fluxo: cada estado é um bloco do mapa em grade e uma linha animada o liga à Paraíba, sede do CIQUANTA.
 * A espessura da linha e a cor do bloco seguem a quantidade. Clique em um estado para filtrar.
 */
export function mapaFluxo(counts, { onClick, label = 'organizações' } = {}) {
  const T = 46, P = 4, max = Math.max(1, ...Object.values(counts));
  const centro = uf => { const [r, c] = TILES[uf]; return [c * T + T / 2, r * T + T / 2]; };
  const [px, py] = centro('PB');
  const ufs = Object.keys(TILES);
  const arcos = ufs.filter(uf => uf !== 'PB' && counts[uf]).sort((a, b) => counts[a] - counts[b]).map((uf, i) => {
    const [x, y] = centro(uf), mx = (x + px) / 2, my = (y + py) / 2, dx = px - x, dy = py - y, k = 0.22;
    const d = `M${x} ${y} Q${mx - dy * k} ${my + dx * k} ${px} ${py}`;
    const w = (1 + 3.5 * Math.sqrt(counts[uf] / max)).toFixed(2);
    return `<path class="arco" d="${d}" style="--w:${w};--i:${i}"/><path class="arco-luz" d="${d}" style="--w:${w};--i:${i};--dur:${(2.4 + (i % 5) * 0.35).toFixed(2)}s"/>`;
  }).join('');
  const blocos = ufs.map(uf => {
    const [r, c] = TILES[uf], n = counts[uf] || 0, a = n ? 0.18 + 0.82 * Math.sqrt(n / max) : 0;
    return `<g class="uf ${uf === 'PB' ? 'sede' : ''}" data-uf="${uf}" tabindex="0" role="button" aria-label="${uf}: ${n} ${label}">
      <rect x="${c * T + P / 2}" y="${r * T + P / 2}" width="${T - P}" height="${T - P}" rx="7" style="--a:${a.toFixed(2)}" class="${n ? 'com' : ''} ${a > .55 ? 'forte' : ''}"/>
      <title>${uf}: ${n} ${label}</title></g>`;
  }).join('');
  const rotulos = ufs.map(uf => {
    const [r, c] = TILES[uf], n = counts[uf] || 0, forte = uf === 'PB' || (n && 0.18 + 0.82 * Math.sqrt(n / max) > .55);
    return `<text class="${forte ? 'claro' : ''}" x="${c * T + T / 2}" y="${r * T + T / 2 - (n ? 3 : -4)}" text-anchor="middle">${uf}</text>${n ? `<text class="n ${forte ? 'claro' : ''}" x="${c * T + T / 2}" y="${r * T + T / 2 + 11}" text-anchor="middle">${n}</text>` : ''}`;
  }).join('');
  const wrap = document.createElement('div');
  wrap.className = 'mapa-fluxo';
  wrap.innerHTML = `<svg viewBox="0 0 ${7 * T} ${8 * T}" role="img" aria-label="Distribuição de ${label} por estado, ligadas à Paraíba">${blocos}<g class="arcos">${arcos}</g><circle class="pulso" cx="${px}" cy="${py}" r="9"/><circle class="pulso p2" cx="${px}" cy="${py}" r="9"/><g class="rotulos">${rotulos}</g></svg>`;
  if (onClick) {
    const ir = e => { const g = e.target.closest('[data-uf]'); if (g) onClick(g.dataset.uf); };
    wrap.addEventListener('click', ir);
    wrap.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ir(e); } });
  }
  return wrap;
}
