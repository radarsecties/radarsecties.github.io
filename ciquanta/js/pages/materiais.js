import * as store from '../store.js';
import { esc, toast, modal, formData, options, safeUrl, fileSize, download, confirmDialog, uid } from '../util.js';
import { loadMecanismos } from '../email.js';

const CATS = ['Apresentação institucional', 'One-pager / folder', 'Nota técnica', 'Proposta de parceria', 'Ofício / carta', 'Vídeo', 'Release / imprensa', 'Edital / chamada', 'Outro'];
const MAX = 10 * 1024 * 1024;

export async function render(view) {
  const draw = () => {
    const mats = [...store.list('materiais')].sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));
    view.innerHTML = `<div class="section-head"><div><h2>Materiais institucionais</h2><p>Apresentações, folders, notas técnicas e vídeos do CIQuanta, prontos para acompanhar campanhas (como link ou anexo). Para materiais pesados, prefira links do Google Drive ou do site oficial.</p></div>
      <div class="toolbar" style="margin:0"><button class="btn" id="onepager">Gerar one-pager do CIQuanta</button><button class="btn primary" id="novo">+ Novo material</button></div></div>
      ${mats.length ? `<div class="grid g3">${mats.map(m => `<div class="card" style="display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;justify-content:space-between;gap:8px"><span class="badge">${esc(m.categoria || 'Outro')}</span><span class="muted small">${new Date(m.criadoEm).toLocaleDateString('pt-BR')}</span></div>
        <h4 style="font-size:15px">${esc(m.titulo)}</h4><p class="muted small" style="margin:0;flex:1">${esc(m.descricao || '')}</p>
        <div class="small">${m.url ? `<a href="${esc(m.url)}" target="_blank" rel="noopener">Abrir link ↗</a>` : ''} ${m.arquivoId ? `<span class="muted">· ${esc(m.nomeArquivo)} (${fileSize(m.tamanho || 0)})</span>` : ''}</div>
        <div class="toolbar" style="margin:0">${m.arquivoId ? `<button class="btn sm" data-dl="${esc(m.id)}">Baixar</button>` : ''}${m.url ? `<button class="btn sm" data-copy="${esc(m.id)}">Copiar link</button>` : ''}<button class="btn sm" data-edit="${esc(m.id)}">Editar</button><button class="btn sm ghost danger" data-del="${esc(m.id)}" aria-label="Excluir">✕</button></div>
      </div>`).join('')}</div>` : '<div class="card"><div class="empty">Nenhum material ainda. Cadastre a apresentação institucional, o folder e as notas técnicas, ou gere o one-pager automático.</div></div>'}`;
    view.querySelector('#novo').onclick = () => form({}, draw);
    view.querySelector('#onepager').onclick = onePager;
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

async function onePager() {
  const mecs = Object.values(await loadMecanismos()).filter(m => m.prioridade === 1);
  const logo = new URL('assets/logo.svg', location.href).href;
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>CIQuanta-PB · One-pager</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Space+Grotesk:wght@600;700&display=swap" rel="stylesheet">
  <style>@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;font:12.5px/1.5 Inter,Arial,sans-serif;color:#11142B;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .p{width:210mm;min-height:297mm;margin:auto;display:flex;flex-direction:column}
  header{background:#0B1033;color:#fff;padding:26px 30px;background-image:radial-gradient(400px 200px at 95% -10%,rgba(168,85,247,.6),transparent 60%),radial-gradient(400px 200px at 0% 140%,rgba(34,211,238,.4),transparent 60%)}
  header img{width:46px;vertical-align:middle;margin-right:12px}h1{font:700 28px 'Space Grotesk',sans-serif;margin:0;display:inline;vertical-align:middle}
  header p{color:#C9CDF2;margin:10px 0 0;font-size:13.5px;max-width:150mm}.bar{height:5px;background:linear-gradient(90deg,#22D3EE,#6366F1,#A855F7)}
  main{padding:20px 30px;flex:1}h2{font:700 15px 'Space Grotesk',sans-serif;color:#4F46E5;margin:16px 0 8px;text-transform:uppercase;letter-spacing:.06em}
  .g{display:grid;grid-template-columns:1fr 1fr;gap:10px}.c{border:1px solid #E3E6F0;border-radius:10px;padding:10px 12px}.c b{display:block;margin-bottom:2px}
  .m{border-left:3px solid #6366F1;padding:4px 10px;margin-bottom:8px}.m b{font-size:13px}.m div{color:#4A4F6A}
  footer{background:#F4F6FB;padding:14px 30px;font-size:11px;color:#4A4F6A}</style></head><body><div class="p">
  <header><img src="${logo}" alt=""><h1>CIQuanta-PB</h1><p>Centro Internacional de Computação e Tecnologias Quânticas da Paraíba: infraestrutura de computação quântica aberta a empresas, ICTs e governo para pesquisa, desenvolvimento e inovação.</p></header><div class="bar"></div>
  <main><h2>O que oferecemos</h2><div class="g">
    <div class="c"><b>Acesso a computadores quânticos</b>Horas de processamento e compartilhamento de laboratório (Lei 10.973/2004, art. 4º).</div>
    <div class="c"><b>Projetos de PD&I em parceria</b>Acordos de parceria com empresas (art. 9º) e equipes conjuntas.</div>
    <div class="c"><b>Formação</b>Residência e capacitação em tecnologias quânticas para equipes técnicas.</div>
    <div class="c"><b>Hub nacional</b>Ponto de experimentação ligado à Iniciativa Brasileira para Tecnologias Quânticas.</div></div>
  <h2>Aplicações</h2><div class="g">
    <div class="c"><b>Energia e petróleo</b>Otimização de redes, despacho, logística offshore, simulação de reservatórios.</div>
    <div class="c"><b>Química, materiais e farma</b>Catalisadores, baterias, captura de carbono, descoberta de fármacos.</div>
    <div class="c"><b>Finanças e telecom</b>Otimização de portfólio, risco, criptografia pós-quântica, comunicação segura.</div>
    <div class="c"><b>Indústria e mobilidade</b>Planejamento de produção, roteirização, IA e aprendizado de máquina quântico.</div></div>
  <h2>Como financiar sua parceria</h2>${mecs.map(m => `<div class="m"><b>${esc(m.nome)}</b><div>${esc(m.encaixeCiquanta)}</div></div>`).join('')}
  </main><footer><b>SECTIES</b> · Secretaria de Estado da Ciência, Tecnologia, Inovação e Ensino Superior · Governo da Paraíba · Estação Ciência Cabo Branco, João Pessoa (PB)<br>${esc(store.cfg().remetenteNome || '')} ${store.cfg().replyTo ? '· ' + esc(store.cfg().replyTo) : ''}</footer></div>
  <script>window.onload=()=>setTimeout(()=>print(),400)<\/script></body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  const w = window.open(url, '_blank');
  if (!w) download('ciquanta-one-pager.html', html, 'text/html');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
