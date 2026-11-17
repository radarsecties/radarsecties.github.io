import * as store from '../store.js';
import * as G from '../google.js';
import * as monitor from '../monitor.js';
import { esc, toast, download, readFile, confirmDialog, isEmail, fmtDateTime, num } from '../util.js';
import { icon } from '../icons.js';
import * as sync from '../sync.js';

async function codigoDaPonte() {
  let chave = store.cfg().ponteChave;
  if (!chave) { chave = G.gerarChave(); store.setConfig({ ponteChave: chave }); }
  const r = await fetch('ponte/ponte.gs', { cache: 'no-cache' });
  if (!r.ok) throw new Error('Não foi possível carregar o código da ponte.');
  return (await r.text()).replace("'__CHAVE__'", `'${chave}'`);
}
async function copiar(texto, msg) {
  try { await navigator.clipboard.writeText(texto); toast(msg, 'ok'); }
  catch { download('ponte.gs', texto); toast('Código baixado como arquivo.', 'ok'); }
}

export async function render(view, { params } = {}) {
  // Link de acesso enviado pela equipe: configura a ponte neste computador e limpa o endereço
  if (params?.get('ponte') && params.get('chave')) {
    store.setConfig({ ponteUrl: params.get('ponte'), ponteChave: params.get('chave'), sincronizar: true });
    history.replaceState(null, '', '#/config');
    G.connect().then(() => { toast('E-mail do CIQUANTA conectado neste computador.', 'ok'); sync.iniciar(); }).catch(e => toast(e.message, 'bad'));
  }
  let pontos = await store.listarPontos();
  const draw = () => {
    const c = store.cfg(), s = G.status(), st = store.state(), y = sync.estado(), r = s.recursos || {};
    const pub = (c.enderecoPublico || '').trim() || (location.protocol === 'https:' ? new URL('.', location.href).href : '');
    view.innerHTML = `<div class="section-head"><div><h2>Configurações</h2></div></div>

    <div class="card conexao ${s.conectado ? 'on' : ''}" style="margin-bottom:16px">
      <div class="selo">${icon('mail', 24)}</div>
      <div><h3>${s.conectado ? esc(s.email) : 'E-mail do CIQUANTA'}</h3>
        <div class="muted small">${s.conectado
          ? `Conectado${r.cotaDiaria != null ? ` · ${num(r.cotaDiaria)} envios disponíveis hoje` : ''}${r.gmailAvancado ? '' : ' · <b style="color:var(--warn)">ative o serviço Gmail API no Apps Script</b>'}${r.agendaAvancada ? ' · reuniões com Meet' : ''}`
          : s.erro ? `<span style="color:var(--bad)">${esc(s.erro)}</span>` : 'Desconectado'}</div></div>
      <div class="toolbar" style="margin:0">${s.conectado
        ? `<button class="btn" id="link">${icon('link', 15)} Link para a equipe</button><button class="btn ghost" id="off">Desconectar</button>`
        : c.ponteUrl ? `<button class="btn primary" id="on">Conectar</button>` : ''}</div>
    </div>
    ${s.conectado ? '' : `<div class="trilha" style="margin:-4px 0 16px">
      <div><span>01</span><b>Copiar o código</b><button class="btn primary sm" id="copiar">${icon('copiar', 14)} Copiar código da ponte</button></div>
      <div><span>02</span><b>Publicar no Apps Script</b><a class="btn sm" href="https://script.google.com/home/projects/create" target="_blank" rel="noopener">${icon('externo', 13)} Abrir com a conta do CIQUANTA</a></div>
      <div><span>03</span><b>Colar o endereço</b><form id="pt" style="display:flex;gap:6px"><input type="url" name="url" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(c.ponteUrl)}" required><button class="btn primary sm">Conectar</button></form></div>
    </div>`}

    <div class="grid g2">
      <div class="card"><h3>Remetente e assinatura</h3><form class="form-grid" id="rem">
        <label class="field">Nome<input type="text" name="remetenteNome" value="${esc(c.remetenteNome)}"></label>
        <label class="field">Cargo<input type="text" name="remetenteCargo" value="${esc(c.remetenteCargo)}"></label>
        <label class="field">Telefone<input type="tel" name="remetenteTelefone" value="${esc(c.remetenteTelefone)}"></label>
        <label class="field">Responder para<input type="email" name="replyTo" value="${esc(c.replyTo)}"></label>
        <label class="field full">Endereço público do sistema<input type="url" name="enderecoPublico" value="${esc(c.enderecoPublico)}" placeholder="${esc(pub || 'https://…/')}"></label>
        <label class="field full">Rodapé dos e-mails<textarea name="rodape">${esc(c.rodape)}</textarea></label>
        <div class="full"><button class="btn primary">Salvar</button></div></form></div>

      <div class="grid" style="align-content:start">
        <div class="card"><h3>Base compartilhada ${y.ativo ? `<span class="badge ${y.fase === 'erro' ? 'bad' : 'ok'}">${y.fase === 'erro' ? 'com erro' : 'ativa'}</span>` : '<span class="badge gray">desligada</span>'}</h3>
          <label class="rotina" style="border:0;padding:0 0 10px"><span class="chave"><input type="checkbox" id="sy-on" ${c.sincronizar ? 'checked' : ''}><i></i></span><span><b>Mesma base em todos os computadores</b></span></label>
          <div class="toolbar" style="margin:0"><button class="btn sm" id="sy-now" ${y.ativo ? '' : 'disabled'}>${icon('sync', 14)} Sincronizar agora</button>
            <span class="muted small">${y.fase === 'erro' ? esc(y.erro) : y.ultimo ? `Sincronizada ${fmtDateTime(y.ultimo)}${y.motorAqui ? ' · envios automáticos neste computador' : ''}` : ''}</span></div></div>

        <div class="card"><h3>Envio e acompanhamento</h3><form class="form-grid" id="rit">
          <label class="field">Intervalo entre e-mails (s)<input type="number" name="intervaloSeg" min="1" max="120" value="${esc(c.intervaloSeg)}"></label>
          <label class="field">Limite diário<input type="number" name="limiteDiario" min="1" max="2000" value="${esc(c.limiteDiario)}"></label>
          <label class="field">Verificar a caixa a cada (s)<input type="number" name="monitorSeg" min="30" max="600" value="${esc(c.monitorSeg)}"></label>
          <label class="check" style="align-self:end"><input type="checkbox" name="notificacoes" ${c.notificacoes ? 'checked' : ''}> Notificações</label>
          <div class="full"><button class="btn primary">Salvar</button></div></form></div>
      </div>

      <div class="card"><h3>Painel CIQUANTA</h3><form class="form-grid" id="mp">
        <label class="field full">Endereço do painel<input type="url" name="painelUrl" value="${esc(c.painelUrl)}"></label>
        <label class="field full">Planilha de agendamentos de visita<input type="text" name="planilhaVisitas" value="${esc(c.planilhaVisitas)}" placeholder="https://docs.google.com/spreadsheets/d/…"></label>
        <label class="field full">Planilha de cadastros de perfis<input type="text" name="planilhaCadastros" value="${esc(c.planilhaCadastros)}" placeholder="https://docs.google.com/spreadsheets/d/…"></label>
        <div class="full"><button class="btn primary">Salvar</button></div></form></div>

      <div class="card"><h3>Descadastro <span class="badge gray">${st.supressao.length}</span></h3>
        <form class="toolbar" id="sup"><input type="email" class="grow" name="e" placeholder="email@dominio.com"><button class="btn">Adicionar</button></form>
        <div class="tags">${st.supressao.map(e => `<span class="badge gray">${esc(e)} <button class="btn ghost sm" style="padding:0 2px" data-unsup="${esc(e)}" aria-label="Remover">×</button></span>`).join('') || '<span class="muted small">Ninguém pediu descadastro.</span>'}</div></div>

      <div class="card span2"><h3>Dados e cópias <span class="muted">${num(st.orgs.length)} organizações · ${num(st.contatos.length)} contatos · ${num(st.oportunidades.length)} oportunidades</span></h3>
        <div class="toolbar"><button class="btn primary" id="exp">Baixar cópia</button>
          <label class="btn">Restaurar<input type="file" accept=".json,application/json" id="imp" hidden></label>
          <label class="btn">Mesclar<input type="file" accept=".json,application/json" id="mer" hidden></label>
          <button class="btn" id="dsave" ${s.conectado ? '' : 'disabled'}>Guardar no Drive</button>
          <button class="btn" id="dload" ${s.conectado ? '' : 'disabled'}>Trazer do Drive</button>
          <a class="btn ghost" href="docs/manual-ciquanta-crm.pdf" target="_blank" rel="noopener">${icon('modelos', 15)} Manual</a>
          <button class="btn danger ghost" id="reset" style="margin-left:auto">Apagar todos os dados</button></div>
        ${pontos.length ? `<div class="table-wrap"><table><thead><tr><th>Ponto de restauração</th><th>Motivo</th><th class="num">Organizações</th><th class="num">Contatos</th><th class="num">Oportunidades</th><th></th></tr></thead><tbody>${pontos.map(p => `<tr><td class="nowrap">${fmtDateTime(p.id)}</td><td>${esc(p.motivo)}</td><td class="num">${p.n?.orgs ?? '—'}</td><td class="num">${p.n?.contatos ?? '—'}</td><td class="num">${p.n?.oportunidades ?? '—'}</td><td><button class="btn sm" data-ponto="${esc(p.id)}">Restaurar</button></td></tr>`).join('')}</tbody></table></div>` : ''}</div>
    </div>`;

    const form = (id, fn) => view.querySelector(id).onsubmit = e => { e.preventDefault(); fn(Object.fromEntries(new FormData(e.target))); };
    const conectar = async () => {
      try { await G.connect(); toast('E-mail do CIQUANTA conectado.', 'ok'); if (!store.cfg().sincronizar) store.setConfig({ sincronizar: true }); sync.iniciar(); }
      catch (e) { toast(e.message, 'bad'); }
      draw();
    };
    view.querySelector('#pt')?.addEventListener('submit', e => {
      e.preventDefault(); const url = G.normalizarPonte(new FormData(e.target).get('url'));
      if (!/^https:\/\/script\.google(usercontent)?\.com\/.+\/exec$/.test(url)) { toast('Cole o endereço do app da Web, que termina em /exec.', 'bad'); return; }
      if (!store.cfg().ponteChave) { toast('Copie o código da ponte primeiro (passo 01).', 'bad'); return; }
      store.setConfig({ ponteUrl: url }); conectar();
    });
    view.querySelector('#copiar')?.addEventListener('click', async () => { try { await copiar(await codigoDaPonte(), 'Código copiado. Cole no Apps Script.'); } catch (e) { toast(e.message, 'bad'); } });
    view.querySelector('#on')?.addEventListener('click', conectar);
    view.querySelector('#off')?.addEventListener('click', () => { G.disconnect(); draw(); });
    view.querySelector('#link')?.addEventListener('click', () => {
      const u = `${location.origin}${location.pathname}#/config?ponte=${encodeURIComponent(c.ponteUrl)}&chave=${encodeURIComponent(c.ponteChave)}`;
      copiar(u, 'Link de acesso copiado. Envie só para a equipe: ele dá acesso ao e-mail do CIQUANTA.');
    });
    form('#rem', d => { store.setConfig(d); toast('Salvo.', 'ok'); });
    form('#mp', d => { store.setConfig({ painelUrl: d.painelUrl || 'https://painelciquanta.secties.pb.gov.br', planilhaVisitas: d.planilhaVisitas.trim(), planilhaCadastros: d.planilhaCadastros.trim() }); toast('Salvo.', 'ok'); });
    form('#rit', d => { store.setConfig({ intervaloSeg: Math.max(1, +d.intervaloSeg || 5), limiteDiario: Math.max(1, +d.limiteDiario || 400), monitorSeg: Math.max(30, +d.monitorSeg || 60), notificacoes: !!d.notificacoes }); if (monitor.estado().ativo) { monitor.parar(); monitor.iniciar(); } toast('Salvo.', 'ok'); });
    form('#sup', d => { if (!isEmail(d.e)) { toast('E-mail inválido.', 'bad'); return; } store.suprimir(d.e, true); draw(); });
    view.querySelectorAll('[data-unsup]').forEach(b => b.onclick = () => { store.suprimir(b.dataset.unsup, false); draw(); });
    view.querySelector('#sy-on').onchange = e => {
      store.setConfig({ sincronizar: e.target.checked });
      if (e.target.checked && s.conectado) sync.iniciar(); else if (!e.target.checked) sync.parar();
      toast(e.target.checked ? 'Base compartilhada ativada.' : 'Base compartilhada desligada neste computador.', 'ok'); draw();
    };
    view.querySelector('#sy-now').onclick = async () => { if (await sync.sincronizar({ manual: true })) toast('Base sincronizada.', 'ok'); };
    view.querySelectorAll('[data-ponto]').forEach(b => b.onclick = async () => {
      if (!await confirmDialog('Restaurar este ponto substitui os dados atuais. O estado de agora também fica guardado. Continuar?', { ok: 'Restaurar', danger: true })) return;
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
    view.querySelector('#dsave').onclick = async () => { try { await G.driveSave(store.exportJSON()); toast('Cópia guardada no Drive do CIQUANTA.', 'ok'); } catch (e) { toast(e.message, 'bad'); } };
    view.querySelector('#dload').onclick = async () => {
      if (!await confirmDialog('Trazer a cópia do Drive substitui os dados atuais. Continuar?', { ok: 'Trazer', danger: true })) return;
      try { store.importJSON(await G.driveLoad()); toast('Cópia do Drive restaurada.', 'ok'); draw(); } catch (e) { toast(e.message, 'bad'); }
    };
    view.querySelector('#reset').onclick = async () => { if (await confirmDialog('Apagar todos os dados (organizações, contatos, oportunidades, campanhas e histórico)? Baixe uma cópia antes.', { ok: 'Apagar tudo', danger: true })) { store.resetAll(); await store.seedIfNeeded(); toast('Dados apagados.'); draw(); } };
  };
  draw();
  const offs = [G.onAuth(draw), sync.onSync(() => { if (!view.contains(document.activeElement) || document.activeElement === document.body) draw(); })];
  return () => offs.forEach(f => f());
}
