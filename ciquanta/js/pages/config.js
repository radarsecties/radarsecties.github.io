import * as store from '../store.js';
import * as G from '../google.js';
import * as monitor from '../monitor.js';
import { esc, toast, download, readFile, confirmDialog, isEmail, fmtDateTime } from '../util.js';
import * as sync from '../sync.js';

export async function render(view) {
  let pontos = await store.listarPontos();
  const draw = () => {
    const c = store.cfg(); const s = G.status(); const st = store.state(), y = sync.estado();
    const pub = (c.enderecoPublico || '').trim() || (location.protocol === 'https:' ? new URL('.', location.href).href : '');
    view.innerHTML = `<div class="section-head"><div><h2>Configurações</h2><p>Conta Google do CIQUANTA, remetente, ritmo de envio, lista de descadastro e cópias de segurança.</p></div></div>
    <div class="grid g2">
      <div class="card"><h3>Conta Google do CIQUANTA ${s.conectado ? '<span class="badge ok">conectada</span>' : '<span class="badge gray">desconectada</span>'}</h3>
        <form class="form-grid" id="gm">
          <label class="field full">Client ID OAuth do Google<input type="text" name="clientId" value="${esc(c.clientId)}" placeholder="000000000000-xxxx.apps.googleusercontent.com" autocomplete="off" spellcheck="false"></label>
          <div class="field full">Permissões solicitadas
            <label class="check"><input type="checkbox" checked disabled> Enviar e-mails pelo Gmail (obrigatória)</label>
            <label class="check"><input type="checkbox" name="leitura" ${c.escopos.leitura ? 'checked' : ''}> Ler respostas e acompanhar interações em tempo real (somente leitura)</label>
            <label class="check"><input type="checkbox" name="rascunhos" ${c.escopos.rascunhos ? 'checked' : ''}> Criar rascunhos para revisão antes do envio</label>
            <label class="check"><input type="checkbox" name="agenda" ${c.escopos.agenda ? 'checked' : ''}> Agendar reuniões e ler eventos no Google Agenda</label>
            <label class="check"><input type="checkbox" name="drive" ${c.escopos.drive ? 'checked' : ''}> Buscar arquivos e apresentações no Google Drive (somente nomes e links)</label>
            <label class="check"><input type="checkbox" name="planilhas" ${c.escopos.planilhas ? 'checked' : ''}> Ler as planilhas do Painel CIQUANTA (visitas e cadastros)</label>
            <label class="check"><input type="checkbox" name="backup" ${c.escopos.backup ? 'checked' : ''}> Guardar cópia de segurança no Google Drive</label></div>
          <div class="full toolbar" style="margin:0"><button class="btn">Salvar</button>${s.conectado ? `<button type="button" class="btn" id="off">Desconectar ${esc(s.email)}</button>` : `<button type="button" class="btn primary" id="on" ${c.clientId ? '' : 'disabled'}>Conectar conta Google</button>`}</div>
          ${s.conectado ? `<p class="full muted small" style="margin:0">Permissões concedidas: ${['send', 'read', 'compose', 'calendar', 'drive', 'planilhas', 'backup'].filter(G.hasScope).map(x => ({ send: 'envio', read: 'leitura', compose: 'rascunhos', calendar: 'agenda', drive: 'Drive', planilhas: 'planilhas', backup: 'cópia no Drive' })[x]).join(', ')}.</p>` : ''}
        </form>
        <details style="margin-top:12px"><summary><strong>Como obter o Client ID (uma vez, cerca de 10 minutos)</strong></summary><ol class="steps" style="margin-top:10px">
          <li>No <a href="https://console.cloud.google.com/" target="_blank" rel="noopener">Google Cloud Console</a>, com a conta institucional, crie um projeto (por exemplo, "CIQUANTA CRM").</li>
          <li>Em APIs e serviços, Biblioteca, ative <strong>Gmail API</strong>, <strong>Google Calendar API</strong>, <strong>Google Drive API</strong> e <strong>Google Sheets API</strong>.</li>
          <li>Na tela de consentimento OAuth, escolha <strong>Interno</strong> se a conta for Google Workspace; caso contrário, Externo, com os e-mails da equipe como usuários de teste.</li>
          <li>Em Credenciais, crie um <strong>ID do cliente OAuth</strong> do tipo Aplicativo da Web, com a origem JavaScript autorizada <code>${esc(location.origin)}</code> e a do endereço definitivo do sistema.</li>
          <li>Cole o ID do cliente acima. Não há chave secreta: o login acontece no navegador e o acesso vale só para a aba aberta.</li>
        </ol></details></div>

      <div class="card"><h3>Remetente e assinatura</h3><form class="form-grid" id="rem">
        <label class="field">Nome<input type="text" name="remetenteNome" value="${esc(c.remetenteNome)}"></label>
        <label class="field">Cargo<input type="text" name="remetenteCargo" value="${esc(c.remetenteCargo)}" placeholder="Ex.: Relações Institucionais"></label>
        <label class="field">Telefone<input type="tel" name="remetenteTelefone" value="${esc(c.remetenteTelefone)}"></label>
        <label class="field">Responder para<input type="email" name="replyTo" value="${esc(c.replyTo)}"></label>
        <label class="field full">Endereço público do sistema<input type="url" name="enderecoPublico" value="${esc(c.enderecoPublico)}" placeholder="${esc(pub || 'https://…/')}"></label>
        <p class="full muted small" style="margin:-6px 0 0">Usado nos links das apresentações e nas imagens do cabeçalho dos e-mails. Em branco, o sistema usa o endereço atual quando ele é público (${esc(pub || 'não detectado')}).</p>
        <label class="field full">Rodapé dos e-mails (inclua a forma de descadastro)<textarea name="rodape">${esc(c.rodape)}</textarea></label>
        <div class="full"><button class="btn primary">Salvar</button></div></form></div>

      <div class="card"><h3>Metas e Painel CIQUANTA</h3><form class="form-grid" id="mp">
        <label class="field">Meta anual de captação (R$)<input type="number" name="metaAnual" min="0" step="10000" value="${esc(c.metaAnual || '')}"></label>
        <label class="field">Endereço do Painel CIQUANTA<input type="url" name="painelUrl" value="${esc(c.painelUrl)}"></label>
        <label class="field full">Planilha de agendamentos de visita (link)<input type="text" name="planilhaVisitas" value="${esc(c.planilhaVisitas)}" placeholder="https://docs.google.com/spreadsheets/d/…"></label>
        <label class="field full">Planilha de cadastros de perfis (link)<input type="text" name="planilhaCadastros" value="${esc(c.planilhaCadastros)}" placeholder="https://docs.google.com/spreadsheets/d/…"></label>
        <p class="full muted small" style="margin:0">Com a busca no Drive ativada, as planilhas "CIQUANTA | Agendamentos de visita" e "CIQUANTA | Cadastros de perfis" são localizadas automaticamente.</p>
        <div class="full"><button class="btn primary">Salvar</button></div></form></div>

      <div class="card"><h3>Envio e acompanhamento</h3><form class="form-grid" id="rit">
        <label class="field">Intervalo entre e-mails (segundos)<input type="number" name="intervaloSeg" min="1" max="120" value="${esc(c.intervaloSeg)}"></label>
        <label class="field">Limite diário de envios<input type="number" name="limiteDiario" min="1" max="2000" value="${esc(c.limiteDiario)}"></label>
        <label class="field">Verificar a caixa a cada (segundos)<input type="number" name="monitorSeg" min="15" max="600" value="${esc(c.monitorSeg)}"></label>
        <label class="check" style="align-self:end"><input type="checkbox" name="notificacoes" ${c.notificacoes ? 'checked' : ''}> Notificações na área de trabalho</label>
        <p class="full muted small" style="margin:0">O Gmail limita o envio diário (cerca de 500 mensagens em contas pessoais e 2.000 no Google Workspace). Envios em ritmo humano e personalizados reduzem o risco de bloqueio e de caixa de spam.</p>
        <div class="full"><button class="btn primary">Salvar</button></div></form></div>

      <div class="card"><h3>Lista de descadastro <span class="badge gray">${st.supressao.length}</span></h3>
        <p class="muted small">E-mails desta lista nunca recebem campanhas (LGPD). Inclua aqui quem responder "REMOVER".</p>
        <form class="toolbar" id="sup"><input type="email" class="grow" name="e" placeholder="email@dominio.com"><button class="btn">Adicionar</button></form>
        <div class="tags">${st.supressao.map(e => `<span class="badge gray">${esc(e)} <button class="btn ghost sm" style="padding:0 2px" data-unsup="${esc(e)}" aria-label="Remover">×</button></span>`).join('') || '<span class="muted small">Vazia.</span>'}</div></div>

      <div class="card span2 acento"><h3>Base compartilhada ${y.ativo ? `<span class="badge ${y.fase === 'erro' ? 'bad' : 'ok'}">${y.fase === 'erro' ? 'com erro' : 'ativa'}</span>` : '<span class="badge gray">desligada</span>'}</h3>
        <p class="muted">Mantém uma única base do CRM no Google Drive da conta do CIQUANTA. Todo computador conectado com essa conta trabalha sobre os mesmos dados: as mudanças são mescladas registro a registro, a cada dois minutos e logo após cada alteração. Só um computador por vez executa cadências e campanhas agendadas, para nenhum e-mail sair em duplicidade.</p>
        <div class="toolbar" style="margin:0"><label class="check"><input type="checkbox" id="sy-on" ${c.sincronizar ? 'checked' : ''}> Usar a base compartilhada no Google Drive</label>
          <button class="btn" id="sy-now" ${y.ativo ? '' : 'disabled'}>Sincronizar agora</button>
          <span class="muted small">${!c.sincronizar ? '' : !s.conectado ? 'Conecte a conta Google para sincronizar.' : !G.hasScope('backup') ? 'Reconecte a conta para conceder a permissão de guardar no Drive.' : y.fase === 'erro' ? esc(y.erro) : y.ultimo ? `Última sincronização: ${fmtDateTime(y.ultimo)}. ${y.motorAqui ? 'Este computador executa os envios automáticos.' : 'Os envios automáticos estão a cargo de outro computador.'}` : 'Aguardando a primeira sincronização.'}</span></div></div>

      <div class="card span2"><h3>Dados e cópias de segurança</h3>
        <p class="muted">Os dados ficam guardados <strong>neste navegador</strong>${c.sincronizar ? ' e na base compartilhada' : ''}: ${st.orgs.length} organizações, ${st.contatos.length} contatos, ${st.oportunidades.length} oportunidades, ${st.campanhas.length} campanhas.</p>
        <div class="toolbar"><button class="btn primary" id="exp">Baixar cópia (.json)</button>
          <label class="btn">Restaurar cópia<input type="file" accept=".json,application/json" id="imp" hidden></label>
          <label class="btn">Mesclar cópia<input type="file" accept=".json,application/json" id="mer" hidden></label>
          <button class="btn" id="dsave" ${s.conectado && G.hasScope('backup') ? '' : 'disabled'}>Salvar no Google Drive</button>
          <button class="btn" id="dload" ${s.conectado && G.hasScope('backup') ? '' : 'disabled'}>Carregar do Google Drive</button>
          <button class="btn danger" id="reset" style="margin-left:auto">Apagar todos os dados</button></div>
        <p class="muted small">Arquivos anexados aos materiais ficam só neste navegador e não entram na cópia; materiais com link entram normalmente.</p>
        <h3 style="margin-top:18px">Pontos de restauração <span class="muted">cópias automáticas neste navegador</span></h3>
        ${pontos.length ? `<div class="table-wrap"><table><thead><tr><th>Quando</th><th>Motivo</th><th class="num">Organizações</th><th class="num">Contatos</th><th class="num">Oportunidades</th><th></th></tr></thead><tbody>${pontos.map(p => `<tr><td class="nowrap">${fmtDateTime(p.id)}</td><td>${esc(p.motivo)}</td><td class="num">${p.n?.orgs ?? '—'}</td><td class="num">${p.n?.contatos ?? '—'}</td><td class="num">${p.n?.oportunidades ?? '—'}</td><td><button class="btn sm" data-ponto="${esc(p.id)}">Restaurar</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted small">O sistema guarda uma cópia por dia de uso e antes de operações que substituem dados. Ainda não há cópias.</p>'}</div>
    </div>`;
    const form = (id, fn) => view.querySelector(id).onsubmit = e => { e.preventDefault(); fn(Object.fromEntries(new FormData(e.target))); };
    form('#rem', d => { store.setConfig(d); toast('Remetente salvo.', 'ok'); });
    form('#mp', d => { store.setConfig({ metaAnual: Math.max(0, +d.metaAnual || 0), painelUrl: d.painelUrl || 'https://painelciquanta.secties.pb.gov.br', planilhaVisitas: d.planilhaVisitas.trim(), planilhaCadastros: d.planilhaCadastros.trim() }); toast('Salvo.', 'ok'); });
    form('#gm', d => { const p = d.clientId?.trim() && G.problemaClientId(d.clientId); if (p) { toast(p, 'bad'); return; } store.setConfig({ clientId: (d.clientId || '').trim(), escopos: { rascunhos: !!d.rascunhos, leitura: !!d.leitura, agenda: !!d.agenda, drive: !!d.drive, backup: !!d.backup, planilhas: !!d.planilhas } }); toast('Salvo. Reconecte a conta para aplicar novas permissões.', 'ok'); draw(); });
    form('#rit', d => { store.setConfig({ intervaloSeg: Math.max(1, +d.intervaloSeg || 5), limiteDiario: Math.max(1, +d.limiteDiario || 400), monitorSeg: Math.max(15, +d.monitorSeg || 30), notificacoes: !!d.notificacoes }); if (monitor.estado().ativo) { monitor.parar(); monitor.iniciar(); } toast('Salvo.', 'ok'); });
    form('#sup', d => { if (!isEmail(d.e)) { toast('E-mail inválido.', 'bad'); return; } store.suprimir(d.e, true); draw(); });
    view.querySelectorAll('[data-unsup]').forEach(b => b.onclick = () => { store.suprimir(b.dataset.unsup, false); draw(); });
    view.querySelector('#on')?.addEventListener('click', async () => { try { await G.connect(); toast('Conta Google conectada.', 'ok'); draw(); } catch (e) { toast(e.message, 'bad'); } });
    view.querySelector('#off')?.addEventListener('click', () => { G.disconnect(); draw(); });
    view.querySelector('#sy-on').onchange = e => {
      store.setConfig({ sincronizar: e.target.checked, escopos: { ...store.cfg().escopos, ...(e.target.checked ? { backup: true } : {}) } });
      if (e.target.checked && s.conectado && G.hasScope('backup')) sync.iniciar(); else if (!e.target.checked) sync.parar();
      toast(e.target.checked ? (G.hasScope('backup') ? 'Base compartilhada ativada.' : 'Ativada. Reconecte a conta Google para conceder a permissão de guardar no Drive.') : 'Base compartilhada desligada neste computador.', 'ok'); draw();
    };
    view.querySelector('#sy-now').onclick = async () => { if (await sync.sincronizar({ manual: true })) toast('Base sincronizada.', 'ok'); };
    view.querySelectorAll('[data-ponto]').forEach(b => b.onclick = async () => {
      if (!await confirmDialog('Restaurar este ponto substitui os dados atuais. O estado de agora também fica guardado como ponto de restauração. Continuar?', { ok: 'Restaurar', danger: true })) return;
      try { await store.restaurarPonto(b.dataset.ponto); pontos = await store.listarPontos(); toast('Ponto restaurado.', 'ok'); draw(); } catch (err) { toast(err.message, 'bad'); }
    });
    view.querySelector('#exp').onclick = () => download(`ciquanta-crm-${new Date().toISOString().slice(0, 10)}.json`, store.exportJSON(), 'application/json');
    const imp = merge => async e => {
      const f = e.target.files[0]; if (!f) return;
      if (!merge && !await confirmDialog('Restaurar substitui todos os dados atuais por esta cópia. Continuar?', { ok: 'Restaurar', danger: true })) return;
      try { store.importJSON(await readFile(f), { merge }); toast(merge ? 'Cópia mesclada.' : 'Cópia restaurada.', 'ok'); draw(); } catch (err) { toast(err.message, 'bad'); }
    };
    view.querySelector('#imp').onchange = imp(false);
    view.querySelector('#mer').onchange = imp(true);
    view.querySelector('#dsave').onclick = async () => { try { await G.driveSave(store.exportJSON()); toast('Cópia salva no Google Drive.', 'ok'); } catch (e) { toast(e.message, 'bad'); } };
    view.querySelector('#dload').onclick = async () => {
      if (!await confirmDialog('Carregar a cópia do Drive substitui os dados atuais. Continuar?', { ok: 'Carregar', danger: true })) return;
      try { store.importJSON(await G.driveLoad()); toast('Cópia do Drive carregada.', 'ok'); draw(); } catch (e) { toast(e.message, 'bad'); }
    };
    view.querySelector('#reset').onclick = async () => { if (await confirmDialog('Apagar todos os dados (organizações, contatos, oportunidades, campanhas e histórico)? Baixe uma cópia antes.', { ok: 'Apagar tudo', danger: true })) { store.resetAll(); await store.seedIfNeeded(); toast('Dados apagados.'); draw(); } };
  };
  draw();
  const offs = [G.onAuth(draw), sync.onSync(() => { if (!view.contains(document.activeElement) || document.activeElement === document.body) draw(); })];
  return () => offs.forEach(f => f());
}
