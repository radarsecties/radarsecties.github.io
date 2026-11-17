import * as store from '../store.js';
import { esc, toast, modal, formData, options, safeUrl, fileSize, download, confirmDialog, uid } from '../util.js';

const CATS = ['Apresentação institucional', 'One-pager / folder', 'Nota técnica', 'Proposta de parceria', 'Ofício / carta', 'Vídeo', 'Release / imprensa', 'Edital / chamada', 'Outro'];
const MAX = 10 * 1024 * 1024;

export async function render(view) {
  const draw = () => {
    const mats = [...store.list('materiais')].sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));
    view.innerHTML = `<div class="section-head"><div><h2>Materiais institucionais</h2></div>
      <div class="toolbar" style="margin:0"><a class="btn" href="#/apresentacoes">Apresentações</a><button class="btn primary" id="novo">+ Novo material</button></div></div>
      ${mats.length ? `<div class="grid g3">${mats.map(m => `<div class="card" style="display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;justify-content:space-between;gap:8px"><span class="badge">${esc(m.categoria || 'Outro')}</span><span class="muted small">${new Date(m.criadoEm).toLocaleDateString('pt-BR')}</span></div>
        <h4 style="font-size:15px">${esc(m.titulo)}</h4><p class="muted small" style="margin:0;flex:1">${esc(m.descricao || '')}</p>
        <div class="small">${m.url ? `<a href="${esc(m.url)}" target="_blank" rel="noopener">Abrir link ↗</a>` : ''} ${m.arquivoId ? `<span class="muted">· ${esc(m.nomeArquivo)} (${fileSize(m.tamanho || 0)})</span>` : ''}</div>
        <div class="toolbar" style="margin:0">${m.arquivoId ? `<button class="btn sm" data-dl="${esc(m.id)}">Baixar</button>` : ''}${m.url ? `<button class="btn sm" data-copy="${esc(m.id)}">Copiar link</button>` : ''}<button class="btn sm" data-edit="${esc(m.id)}">Editar</button><button class="btn sm ghost danger" data-del="${esc(m.id)}" aria-label="Excluir">✕</button></div>
      </div>`).join('')}</div>` : '<div class="card"><div class="empty">Nenhum material ainda. Inclua as apresentações on-line (página Apresentações), arquivos do Google Drive ou documentos próprios.</div></div>'}`;
    view.querySelector('#novo').onclick = () => form({}, draw);
    view.querySelector('.grid')?.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      const m = store.get('materiais', b.dataset.dl || b.dataset.copy || b.dataset.edit || b.dataset.del);
      if (b.dataset.dl) { const f = await store.fileGet(m.arquivoId); if (f) download(f.name, f.blob); else toast('Arquivo não encontrado neste navegador.', 'bad'); }
      if (b.dataset.copy) { try { await navigator.clipboard.writeText(m.url); toast('Link copiado.', 'ok'); } catch { toast(m.url); } }
      if (b.dataset.edit) form(m, draw);
      if (b.dataset.del && await confirmDialog(`Excluir "${m.titulo}"?`, { ok: 'Excluir', danger: true })) { if (m.arquivoId) await store.fileDel(m.arquivoId); store.remove('materiais', m.id); draw(); }
    });
  };
  draw();
}

function form(m, done) {
  const { el, close } = modal({ title: m.id ? 'Editar material' : 'Novo material', body: `<form class="form-grid" id="f">
    <label class="field full">Título *<input type="text" name="titulo" required value="${esc(m.titulo)}"></label>
    <label class="field">Categoria<select name="categoria">${options(CATS, m.categoria || CATS[0])}</select></label>
    <label class="field">Link público (Drive, site, YouTube)<input type="url" name="url" value="${esc(m.url)}" placeholder="https://"></label>
    <label class="field full">Descrição<textarea name="descricao">${esc(m.descricao)}</textarea></label>
    <label class="field full">Arquivo para anexar (até 10 MB, fica guardado neste navegador)<input type="file" name="arquivo" accept=".pdf,.pptx,.ppt,.docx,.doc,.png,.jpg,.jpeg,.xlsx"></label>
    ${m.arquivoId ? `<div class="full muted small">Arquivo atual: ${esc(m.nomeArquivo)}. Envie outro para substituir.</div>` : ''}
  </form>`, footer: '<button class="btn" data-close>Cancelar</button><button class="btn primary" id="ok">Salvar</button>' });
  el.querySelector('#ok').onclick = async () => {
    const f = el.querySelector('#f'); if (!f.reportValidity()) return;
    const d = formData(f); const file = f.arquivo.files[0];
    if (d.url && !safeUrl(d.url)) { toast('Link inválido.', 'bad'); return; }
    if (!d.url && !file && !m.arquivoId) { toast('Informe um link ou envie um arquivo.', 'bad'); return; }
    const out = { ...m, titulo: d.titulo, categoria: d.categoria, url: safeUrl(d.url), descricao: d.descricao };
    if (file) {
      if (file.size > MAX) { toast('Arquivo maior que 10 MB. Use um link do Drive.', 'bad'); return; }
      const fid = m.arquivoId || uid('arq');
      await store.fileput(fid, { blob: file, name: file.name, type: file.type || 'application/octet-stream' });
      Object.assign(out, { arquivoId: fid, nomeArquivo: file.name, tamanho: file.size, tipo: file.type });
    }
    store.upsert('materiais', out, 'mat'); toast('Material salvo.', 'ok'); close(); done();
  };
}
