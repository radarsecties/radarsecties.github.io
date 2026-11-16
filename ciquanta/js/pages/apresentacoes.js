import * as store from '../store.js';
import * as G from '../google.js';
import { esc, toast, fmtDate, isEmail } from '../util.js';
import { listDecks, buildDeck, mountViewer, present, printDeck } from '../deck.js';
import { linkApresentacao } from '../email.js';
import { icon } from '../icons.js';

export async function render(view, { arg }) {
  return arg ? visualizar(view, arg) : biblioteca(view);
}

async function biblioteca(view) {
  const decks = await listDecks();
  const mats = store.list('materiais').filter(m => m.deckId);
  view.innerHTML = `<div class="section-head"><div><h2>Apresentações</h2><p>Apresentação institucional e agendas setoriais com a identidade do CIQUANTA. Cada uma tem um link público que pode seguir nas campanhas e nos e-mails; o destinatário vê os slides no navegador e pode salvar em PDF.</p></div></div>
    <div class="deck-grid" id="decks">${decks.map(d => `<div class="deck-thumb" data-id="${esc(d.id)}">
      ${d.capa ? `<div class="cover img" style="background-image:url('${esc(d.capa)}')"></div>` : `<div class="cover"><img src="assets/logo-azul.png" alt="CIQUANTA"><div><div class="kicker">Agenda de pesquisa aplicada</div><b>${esc(d.setor.nome)}</b><div class="small muted">${d.setor.linhas.length} linhas de pesquisa</div></div></div>`}
      <div class="info"><div class="title">${esc(d.titulo)}</div><div class="small muted" style="flex:1">${esc(d.sub)}</div>
        <div class="tags">${d.id === 'institucional' ? '<span class="badge ok">apresentação oficial</span>' : d.oficial ? '<span class="badge ok">baseada em material oficial</span>' : '<span class="badge gray">formato da agenda oficial</span>'}<span class="badge gray">${d.slides} slides</span>${mats.some(m => m.deckId === d.id) ? '<span class="badge">nos materiais</span>' : ''}</div>
        <div class="toolbar" style="margin:0"><a class="btn sm primary" href="#/apresentacoes/${esc(d.id)}">Abrir</a><button class="btn sm" data-play="${esc(d.id)}">${icon('play', 13)} Apresentar</button><button class="btn sm" data-link="${esc(d.id)}">${icon('link', 13)} Link</button></div></div></div>`).join('')}</div>
    <div class="card" style="margin-top:20px"><h3>Apresentações no Google Drive <span class="muted">arquivos com "CIQUANTA" no nome ou no conteúdo</span></h3><div id="drive"></div></div>`;
  view.querySelector('#decks').addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.play) present(await buildDeck(b.dataset.play));
    if (b.dataset.link) { const u = linkApresentacao(b.dataset.link); try { await navigator.clipboard.writeText(u); toast('Link público copiado.', 'ok'); } catch { toast(u); } }
  });
  drive(view.querySelector('#drive'));
}

function drive(el) {
  const s = G.status();
  if (!s.conectado || !G.hasScope('drive')) {
    el.innerHTML = `<p class="muted">Para listar as apresentações da equipe guardadas no Google Drive (deck final, reunião executiva, agendas setoriais), ative "Listar apresentações do Google Drive" em <a href="#/config">Configurações</a> e conecte a conta Google.</p>`;
    return;
  }
  el.innerHTML = '<div class="toolbar"><input type="search" class="grow" id="dq" value="CIQUANTA"><button class="btn" id="dbusca">Buscar no Drive</button></div><div id="dres"><div class="empty">Carregando…</div></div>';
  const buscar = async () => {
    const R = el.querySelector('#dres'); R.innerHTML = '<div class="empty">Buscando…</div>';
    try {
      const r = await G.driveSearchPresentations(el.querySelector('#dq').value.trim() || 'CIQUANTA');
      const fs = r.files || [];
      const tipo = m => m.includes('google-apps.presentation') ? 'Google Apresentações' : m.includes('pdf') ? 'PDF' : 'PowerPoint';
      R.innerHTML = fs.length ? `<div class="table-wrap"><table><thead><tr><th>Arquivo</th><th>Tipo</th><th>Atualizado</th><th></th></tr></thead><tbody>${fs.map(f => `<tr><td class="title">${esc(f.name)}<div class="muted small">${esc(f.owners?.[0]?.displayName || '')}</div></td><td class="small">${tipo(f.mimeType)}</td><td class="small">${fmtDate(f.modifiedTime)}</td>
        <td class="nowrap"><a class="btn sm" href="${esc(f.webViewLink)}" target="_blank" rel="noopener">${icon('externo', 13)} Abrir</a> <button class="btn sm" data-mat="${esc(f.id)}">Adicionar aos materiais</button></td></tr>`).join('')}</tbody></table></div>
        <p class="muted small">O link do Drive só abre para quem tem permissão no arquivo. Para enviar a empresas, ajuste o compartilhamento no Drive ou use o link público das apresentações acima.</p>` : '<div class="empty">Nenhum arquivo encontrado.</div>';
      R.onclick = e => {
        const id = e.target.dataset.mat; if (!id) return;
        const f = fs.find(x => x.id === id);
        if (store.list('materiais').some(m => m.driveId === id)) { toast('Já está nos materiais.'); return; }
        store.upsert('materiais', { titulo: f.name, categoria: 'Apresentação institucional', url: f.webViewLink, driveId: id, descricao: `${tipo(f.mimeType)} no Google Drive` }, 'mat');
        toast('Adicionado aos materiais.', 'ok');
      };
    } catch (err) { R.innerHTML = `<div class="callout warn">${esc(err.message)}</div>`; }
  };
  el.querySelector('#dbusca').onclick = buscar;
  buscar();
}

async function visualizar(view, id) {
  const deck = await buildDeck(id);
  const setor = store.setoresLista().find(s => s.id === id);
  document.querySelector('#page-title').textContent = deck.titulo;
  const link = linkApresentacao(id);
  view.innerHTML = `<div class="toolbar"><a class="btn ghost" href="#/apresentacoes">${icon('esquerda', 16)} Apresentações</a></div>
    <div class="grid split-21"><div class="card" style="padding:14px"><div id="viewer"></div></div>
    <div class="card"><h3>${esc(deck.titulo)}</h3><p class="small muted">Fonte: ${esc(deck.fonte)}</p>
      <label class="field">Link público<input type="text" readonly value="${esc(link)}" id="lk"></label>
      <div class="toolbar" style="margin-top:10px"><button class="btn sm" id="copy">${icon('link', 13)} Copiar</button><a class="btn sm" href="${esc(link)}" target="_blank" rel="noopener">${icon('externo', 13)} Abrir</a></div>
      <div class="list" style="margin-top:6px">
        <div class="list-item"><button class="btn" id="mat">${icon('materiais', 15)} Incluir nos materiais das campanhas</button></div>
        ${setor ? `<div class="list-item"><button class="btn" id="camp">${icon('campanhas', 15)} Campanha para contatos do setor</button></div><div class="list-item"><a class="btn" href="#/setores/${esc(id)}">${icon('setores', 15)} Ver setor e organizações</a></div>` : ''}
        <div class="list-item"><button class="btn" id="pdf">${icon('imprimir', 15)} ${deck.pdf ? 'Baixar PDF oficial' : 'Gerar PDF'}</button></div>
      </div>
      <p class="muted small">Use as setas do teclado para navegar. Em tela cheia, clique na metade direita para avançar e na esquerda para voltar.</p></div></div>`;
  const off = mountViewer(view.querySelector('#viewer'), deck);
  view.querySelector('#copy').onclick = async () => { try { await navigator.clipboard.writeText(link); toast('Link copiado.', 'ok'); } catch { view.querySelector('#lk').select(); } };
  view.querySelector('#pdf').onclick = () => printDeck(deck);
  view.querySelector('#mat').onclick = () => {
    if (store.list('materiais').some(m => m.deckId === id)) { toast('Esta apresentação já está nos materiais.'); return; }
    store.upsert('materiais', { titulo: deck.titulo.replace('CIQUANTA: ', 'Apresentação CIQUANTA: '), categoria: 'Apresentação institucional', url: link, deckId: id, descricao: deck.pdf ? 'Apresentação oficial, com versão em PDF.' : 'Apresentação on-line no template oficial do CIQUANTA.' }, 'mat');
    toast('Incluída nos materiais. Selecione-a ao montar uma campanha.', 'ok');
  };
  view.querySelector('#camp')?.addEventListener('click', () => {
    const ids = store.list('contatos').filter(c => store.orgOf(c)?.setor === id && isEmail(c.email) && !c.optout).map(c => c.id);
    let mat = store.list('materiais').find(m => m.deckId === id);
    if (!mat) mat = store.upsert('materiais', { titulo: deck.titulo.replace('CIQUANTA: ', 'Apresentação CIQUANTA: '), categoria: 'Apresentação institucional', url: link, deckId: id }, 'mat');
    const mod = store.get('modelos', 'mod-empresa-agenda');
    const c = store.upsert('campanhas', { nome: `Agenda ${setor.curto}`, modeloId: mod?.id, assunto: mod?.assunto || '', corpo: mod?.corpo || '', destinatarios: ids, materiais: [mat.id], status: 'rascunho', modo: 'enviar', vars: {} }, 'cmp');
    location.hash = `#/campanhas/${c.id}`;
  });
  return off;
}
