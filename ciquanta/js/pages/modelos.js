import * as store from '../store.js';
import { esc, toast, confirmDialog } from '../util.js';
import { compose, loadMecanismos, VARIAVEIS } from '../email.js';

export async function render(view) {
  await loadMecanismos();
  let curId = store.list('modelos')[0]?.id || null;
  const draw = () => {
    const mods = store.list('modelos');
    const m = store.get('modelos', curId);
    view.innerHTML = `<div class="section-head"><div><h2>Modelos de e-mail</h2><p>Textos-base para empresas, autoridades e fomentadores. Use variáveis como <code>{{saudacao}}</code> e <code>{{organizacao}}</code>: cada destinatário recebe a versão personalizada, no layout institucional do CIQUANTA.</p></div>
      <div class="toolbar" style="margin:0"><button class="btn" id="restore">Restaurar modelos padrão</button><button class="btn primary" id="novo">+ Novo modelo</button></div></div>
      <div class="grid split">
        <div class="card" style="padding:8px"><div class="list">${mods.map(x => `<button class="list-item btn ghost" style="justify-content:flex-start;text-align:left;border-radius:8px;${x.id === curId ? 'background:var(--primary-soft)' : ''}" data-id="${esc(x.id)}"><div><div class="title">${esc(x.nome)}</div><div class="meta">${esc(x.categoria || 'Geral')}</div></div></button>`).join('') || '<div class="empty">Sem modelos.</div>'}</div></div>
        ${m ? `<div class="grid g2">
          <div class="card"><div class="form-grid">
            <label class="field">Nome<input type="text" id="nome" value="${esc(m.nome)}"></label>
            <label class="field">Categoria<input type="text" id="categoria" value="${esc(m.categoria || '')}" list="cats"></label>
            <datalist id="cats"><option value="Empresas"><option value="Autoridades"><option value="Fomentadores"><option value="Geral"></datalist>
            <label class="field full">Assunto<input type="text" id="assunto" value="${esc(m.assunto)}"></label>
            <div class="field full">Variáveis<div class="var-chips">${VARIAVEIS.map(([k, d]) => `<button type="button" title="${esc(d)}" data-var="${k}">{{${k}}}</button>`).join('')}</div></div>
            <label class="field full">Corpo (HTML)<textarea id="corpo" style="min-height:340px;font-family:ui-monospace,monospace;font-size:12.5px">${esc(m.corpo)}</textarea></label>
          </div>
          <div class="toolbar" style="margin:12px 0 0"><button class="btn" id="dup">Duplicar</button><button class="btn danger" id="del">Excluir</button><a class="btn primary" href="#/campanhas" id="usar">Usar em campanha</a></div></div>
          <div class="card"><div class="small" style="margin-bottom:6px"><strong>Assunto:</strong> <span id="pv-s"></span></div><iframe class="preview-frame" id="pv" sandbox title="Pré-visualização"></iframe>
          <p class="muted small">Exemplo com um contato fictício. A assinatura vem de Configurações.</p></div></div>` : '<div class="card"><div class="empty">Selecione ou crie um modelo.</div></div>'}
      </div>`;
    view.querySelectorAll('[data-id]').forEach(b => b.onclick = () => { curId = b.dataset.id; draw(); });
    view.querySelector('#novo').onclick = () => { const n = store.upsert('modelos', { nome: 'Novo modelo', categoria: 'Geral', assunto: '', corpo: '<p>{{saudacao}},</p>\n<p></p>\n<p>Atenciosamente,</p>' }, 'mod'); curId = n.id; draw(); };
    view.querySelector('#restore').onclick = async () => {
      const ref = await store.ref('modelos'); let n = 0;
      ref.itens.forEach(x => { if (!store.get('modelos', x.id)) { store.list('modelos').push({ ...x, padrao: true, criadoEm: new Date().toISOString() }); n++; } });
      store.touch('modelos'); toast(n ? `${n} modelo(s) restaurado(s).` : 'Todos os modelos padrão já estão presentes.', 'ok'); draw();
    };
    if (!m) return;
    const preview = () => {
      const c = compose({ assunto: m.assunto, corpo: m.corpo, vars: { evento: 'Encontro CIQUANTA de Tecnologias Quânticas', data_evento: '10 de março de 2027' } },
        { nome: 'Ana Souza', tratamento: 'Prezada Senhora', cargo: 'Gerente de P&D', orgId: store.list('orgs')[0]?.id });
      view.querySelector('#pv').srcdoc = c.html; view.querySelector('#pv-s').textContent = c.subject;
    };
    preview();
    ['nome', 'categoria', 'assunto', 'corpo'].forEach(k => view.querySelector('#' + k).addEventListener('input', e => { m[k] = e.target.value; store.touch('modelos'); preview(); if (k === 'nome') { const b = view.querySelector(`[data-id="${CSS.escape(m.id)}"] .title`); if (b) b.textContent = m.nome; } }));
    let last = view.querySelector('#corpo');
    ['assunto', 'corpo'].forEach(k => view.querySelector('#' + k).addEventListener('focus', e => last = e.target));
    view.querySelector('.var-chips').onclick = e => { const k = e.target.dataset.var; if (!k) return; const s = last.selectionStart; last.value = last.value.slice(0, s) + `{{${k}}}` + last.value.slice(last.selectionEnd); last.dispatchEvent(new Event('input')); last.focus(); };
    view.querySelector('#dup').onclick = () => { const n = store.upsert('modelos', { nome: m.nome + ' (cópia)', categoria: m.categoria, assunto: m.assunto, corpo: m.corpo }, 'mod'); curId = n.id; draw(); };
    view.querySelector('#del').onclick = async () => { if (await confirmDialog(`Excluir o modelo "${m.nome}"?`, { ok: 'Excluir', danger: true })) { store.remove('modelos', m.id); curId = store.list('modelos')[0]?.id; draw(); } };
    view.querySelector('#usar').onclick = e => { e.preventDefault(); const c = store.upsert('campanhas', { nome: m.nome, modeloId: m.id, assunto: m.assunto, corpo: m.corpo, status: 'rascunho', modo: 'enviar', destinatarios: [], materiais: [], vars: {} }, 'cmp'); location.hash = `#/campanhas/${c.id}`; };
  };
  draw();
}
