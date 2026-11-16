import * as store from '../store.js';
import * as G from '../google.js';
import { esc, toast, download, readFile, confirmDialog, isEmail, norm } from '../util.js';

export async function render(view) {
  const draw = () => {
    const c = store.cfg(); const s = G.status(); const st = store.state();
    view.innerHTML = `<div class="section-head"><div><h2>Configurações</h2><p>Remetente, integração com o Gmail, ritmo de envio, lista de descadastro e cópias de segurança.</p></div></div>
    <div class="grid g2">
      <div class="card"><h3>Remetente e assinatura</h3><form class="form-grid" id="rem">
        <label class="field">Nome<input type="text" name="remetenteNome" value="${esc(c.remetenteNome)}"></label>
        <label class="field">Cargo<input type="text" name="remetenteCargo" value="${esc(c.remetenteCargo)}" placeholder="Ex.: Coordenação de Relações Institucionais"></label>
        <label class="field">Telefone<input type="tel" name="remetenteTelefone" value="${esc(c.remetenteTelefone)}"></label>
        <label class="field">Responder para (opcional)<input type="email" name="replyTo" value="${esc(c.replyTo)}" placeholder="ciquanta@…"></label>
        <label class="field full">Rodapé dos e-mails (inclua a forma de descadastro)<textarea name="rodape">${esc(c.rodape)}</textarea></label>
        <div class="full"><button class="btn primary">Salvar</button></div></form></div>

      <div class="card"><h3>Integração Gmail ${s.conectado ? '<span class="badge ok">conectado</span>' : '<span class="badge gray">desconectado</span>'}</h3>
        <form class="form-grid" id="gm">
          <label class="field full">Client ID OAuth do Google<input type="text" name="clientId" value="${esc(c.clientId)}" placeholder="000000000000-xxxx.apps.googleusercontent.com" autocomplete="off" spellcheck="false"></label>
          <div class="field full">Permissões solicitadas
            <label class="check"><input type="checkbox" checked disabled> Enviar e-mails (obrigatório)</label>
            <label class="check"><input type="checkbox" name="rascunhos" ${c.escopos.rascunhos ? 'checked' : ''}> Criar rascunhos para revisão</label>
            <label class="check"><input type="checkbox" name="leitura" ${c.escopos.leitura ? 'checked' : ''}> Ler respostas e encontrar contatos nas conversas (somente leitura)</label>
            <label class="check"><input type="checkbox" name="drive" ${c.escopos.drive ? 'checked' : ''}> Backup no Google Drive (só arquivos criados pelo app)</label></div>
          <div class="full toolbar" style="margin:0"><button class="btn">Salvar</button>${s.conectado ? `<button type="button" class="btn" id="off">Desconectar ${esc(s.email)}</button>` : `<button type="button" class="btn grad" id="on" ${c.clientId ? '' : 'disabled'}>Conectar Gmail</button>`}</div>
        </form>
        <details style="margin-top:12px"><summary><strong>Como obter o Client ID (uma vez, ~10 min)</strong></summary><ol class="steps" style="margin-top:10px">
          <li>Acesse <a href="https://console.cloud.google.com/" target="_blank" rel="noopener">Google Cloud Console</a> com a conta institucional e crie um projeto (ex.: "CIQuanta RI").</li>
          <li>Em <em>APIs e serviços → Biblioteca</em>, ative a <strong>Gmail API</strong> (e a <strong>Google Drive API</strong>, se for usar backup).</li>
          <li>Em <em>Tela de consentimento OAuth</em>, escolha <strong>Interno</strong> (se a conta for Google Workspace) ou <strong>Externo</strong> e adicione os e-mails da equipe como usuários de teste.</li>
          <li>Em <em>Credenciais → Criar credenciais → ID do cliente OAuth</em>, tipo <strong>Aplicativo da Web</strong>. Em <em>Origens JavaScript autorizadas</em>, adicione: <code>${esc(location.origin)}</code>${location.origin.includes('github.io') ? ' e <code>https://radar.secties.pb.gov.br</code>' : ''}.</li>
          <li>Copie o <strong>ID do cliente</strong> e cole acima. Não é preciso chave secreta: o login acontece no navegador e o acesso fica só nesta aba.</li>
        </ol></details></div>

      <div class="card"><h3>Ritmo de envio</h3><form class="form-grid" id="rit">
        <label class="field">Intervalo entre e-mails (segundos)<input type="number" name="intervaloSeg" min="1" max="120" value="${esc(c.intervaloSeg)}"></label>
        <label class="field">Limite diário<input type="number" name="limiteDiario" min="1" max="2000" value="${esc(c.limiteDiario)}"></label>
        <p class="full muted small" style="margin:0">O Gmail limita o envio diário (cerca de 500 para contas pessoais e 2.000 para Google Workspace). Envios em ritmo humano e personalizados evitam bloqueios e caixa de spam.</p>
        <div class="full"><button class="btn primary">Salvar</button></div></form></div>

      <div class="card"><h3>Lista de descadastro <span class="badge gray">${st.supressao.length}</span></h3>
        <p class="muted small">E-mails desta lista nunca recebem campanhas (LGPD). Quem responder "REMOVER" deve ser incluído aqui.</p>
        <form class="toolbar" id="sup"><input type="email" class="grow" name="e" placeholder="email@dominio.com"><button class="btn">Adicionar</button></form>
        <div class="tags">${st.supressao.map(e => `<span class="badge gray">${esc(e)} <button class="btn ghost sm" style="padding:0 2px" data-unsup="${esc(e)}" aria-label="Remover">✕</button></span>`).join('') || '<span class="muted small">Vazia.</span>'}</div></div>

      <div class="card span2"><h3>Dados e cópias de segurança</h3>
        <p class="muted">Os dados ficam guardados <strong>neste navegador</strong> (${st.orgs.length} organizações, ${st.contatos.length} contatos, ${st.campanhas.length} campanhas). Faça backups regulares e use o arquivo para levar a base para outro computador ou colega.</p>
        <div class="toolbar"><button class="btn primary" id="exp">Baixar backup (.json)</button>
          <label class="btn">Restaurar backup<input type="file" accept=".json,application/json" id="imp" hidden></label>
          <label class="btn">Mesclar backup<input type="file" accept=".json,application/json" id="mer" hidden></label>
          <button class="btn" id="dsave" ${s.conectado && G.hasScope('drive') ? '' : 'disabled'}>Salvar no Google Drive</button>
          <button class="btn" id="dload" ${s.conectado && G.hasScope('drive') ? '' : 'disabled'}>Carregar do Google Drive</button>
          <button class="btn danger" id="reset" style="margin-left:auto">Apagar todos os dados</button></div>
        <p class="muted small">Materiais com arquivo anexado ficam só neste navegador (não entram no backup); materiais com link entram normalmente.</p></div>
    </div>`;

    const form = (id, fn) => view.querySelector(id).onsubmit = e => { e.preventDefault(); fn(Object.fromEntries(new FormData(e.target))); };
    form('#rem', d => { store.setConfig(d); toast('Remetente salvo.', 'ok'); });
    form('#gm', d => { store.setConfig({ clientId: (d.clientId || '').trim(), escopos: { rascunhos: !!d.rascunhos, leitura: !!d.leitura, drive: !!d.drive } }); toast('Integração salva. Reconecte para aplicar novas permissões.', 'ok'); draw(); });
    form('#rit', d => { store.setConfig({ intervaloSeg: Math.max(1, +d.intervaloSeg || 5), limiteDiario: Math.max(1, +d.limiteDiario || 400) }); toast('Ritmo salvo.', 'ok'); });
    form('#sup', d => { if (!isEmail(d.e)) { toast('E-mail inválido.', 'bad'); return; } store.suprimir(d.e, true); draw(); });
    view.querySelectorAll('[data-unsup]').forEach(b => b.onclick = () => { store.suprimir(b.dataset.unsup, false); draw(); });
    view.querySelector('#on')?.addEventListener('click', async () => { try { await G.connect(); toast('Gmail conectado.', 'ok'); draw(); } catch (e) { toast(e.message, 'bad'); } });
    view.querySelector('#off')?.addEventListener('click', () => { G.disconnect(); draw(); });
    view.querySelector('#exp').onclick = () => download(`ciquanta-backup-${new Date().toISOString().slice(0, 10)}.json`, store.exportJSON(), 'application/json');
    const imp = merge => async e => {
      const f = e.target.files[0]; if (!f) return;
      if (!merge && !await confirmDialog('Restaurar substitui todos os dados atuais por este backup. Continuar?', { ok: 'Restaurar', danger: true })) return;
      try { store.importJSON(await readFile(f), { merge }); toast(merge ? 'Backup mesclado.' : 'Backup restaurado.', 'ok'); draw(); } catch (err) { toast(err.message, 'bad'); }
    };
    view.querySelector('#imp').onchange = imp(false);
    view.querySelector('#mer').onchange = imp(true);
    view.querySelector('#dsave').onclick = async () => { try { await G.driveSave(store.exportJSON()); toast('Backup salvo no Google Drive.', 'ok'); } catch (e) { toast(e.message, 'bad'); } };
    view.querySelector('#dload').onclick = async () => {
      if (!await confirmDialog('Carregar o backup do Drive substitui os dados atuais. Continuar?', { ok: 'Carregar', danger: true })) return;
      try { store.importJSON(await G.driveLoad()); toast('Backup do Drive carregado.', 'ok'); draw(); } catch (e) { toast(e.message, 'bad'); }
    };
    view.querySelector('#reset').onclick = async () => { if (await confirmDialog('Apagar TODOS os dados (organizações, contatos, campanhas, histórico)? Faça um backup antes.', { ok: 'Apagar tudo', danger: true })) { store.resetAll(); await store.seedIfNeeded(); toast('Dados apagados.'); draw(); } };
  };
  draw();
  return G.onAuth(draw);
}
