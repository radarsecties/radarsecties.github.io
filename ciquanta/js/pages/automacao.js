// Central de automação: o que roda sozinho todos os dias, o que aconteceu e o que vem a seguir.
import * as store from '../store.js';
import { esc, fmtDateTime, relTime, num, toast } from '../util.js';
import { icon } from '../icons.js';
import * as auto from '../automacao.js';
import { sinais, carregarSinais } from '../sinais.js';
import { segBadge } from '../components.js';
import { animarNumeros, reduzMovimento } from '../motion.js';

const NOMES_ROTINA = Object.fromEntries(auto.ROTINAS.map(r => [r.id, r.nome]));

/** Esquema animado do fluxo: fontes públicas → coleta diária → base → CRM → cadências → respostas. */
function fluxo(n) {
  const etapas = [
    ['Fontes públicas', 'veículos, portais, sites, Receita', n.fontes],
    ['Coleta diária', 'servidor do GitHub, 2× ao dia', n.coleta],
    ['Base de referência', 'organizações e sinais', n.base],
    ['CRM', 'organizações e contatos', n.crm],
    ['Cadências', 'abordagem automática', n.cadencias],
    ['Respostas', 'em tempo real pelo Gmail', n.respostas],
  ];
  const W = 1100, H = 150, gap = W / etapas.length, cy = 58;
  const path = `M ${gap / 2} ${cy} L ${W - gap / 2} ${cy}`;
  const mover = !reduzMovimento();
  return `<svg class="fluxo" viewBox="0 0 ${W} ${H}" role="img" aria-label="Fluxo da automação, das fontes públicas às respostas">
    <defs><linearGradient id="fx-g" x1="0" x2="1"><stop offset="0" stop-color="var(--primary)" stop-opacity=".15"/><stop offset=".5" stop-color="var(--primary)" stop-opacity=".55"/><stop offset="1" stop-color="var(--ok)" stop-opacity=".35"/></linearGradient></defs>
    <path d="${path}" stroke="url(#fx-g)" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path class="fx-trilho" d="${path}" fill="none"/>
    ${mover ? [0, 1, 2, 3, 4, 5].map(i => `<circle r="4" class="fx-p"><animateMotion dur="6s" begin="${-i}s" repeatCount="indefinite" path="${path}"/></circle>`).join('') : ''}
    ${etapas.map(([t, d, v], i) => { const x = gap / 2 + i * gap; return `<g class="fx-no" style="--i:${i}"><circle cx="${x}" cy="${cy}" r="22" class="fx-c"/><text x="${x}" y="${cy + 5}" text-anchor="middle" class="fx-v">${esc(v)}</text>
      <text x="${x}" y="${cy + 46}" text-anchor="middle" class="fx-t">${esc(t)}</text><text x="${x}" y="${cy + 64}" text-anchor="middle" class="fx-d">${esc(d)}</text></g>`; }).join('')}
  </svg>
  <ol class="fluxo-lista">${etapas.map(([t, d, v]) => `<li><b>${esc(v)}</b><span><strong>${esc(t)}</strong><small>${esc(d)}</small></span></li>`).join('')}</ol>`;
}

export async function render(view) {
  await store.loadSetores(); await carregarSinais();
  const [coleta, empresas, desc, editais, canais, receita] = await Promise.all(['coleta', 'empresas', 'descobertas', 'editais-auto', 'canais', 'receita'].map(n => store.ref(n).catch(() => null)));
  const offs = [];
  const draw = () => {
    const s = store.state(), c = s.config, ult = coleta?.ultima, est = auto.estado();
    const auto_ = s.orgs.filter(o => o.auto).length, ctAuto = s.contatos.filter(x => x.auto).length;
    const n = {
      fontes: num(new Set(sinais().itens.map(x => x.fonte)).size + 4), coleta: ult ? `${ult.etapas.filter(e => e.ok).length}/${ult.etapas.length}` : '—',
      base: num((empresas?.itens?.length || 0) + (desc?.itens?.length || 0)), crm: num(s.orgs.length),
      cadencias: num(s.inscricoes.filter(i => i.status === 'ativa').length), respostas: num(s.recebidos.filter(r => r.direcao === 'entrada').length),
    };
    const canaisN = canais?.porOrg ? Object.values(canais.porOrg).filter(x => x.emails?.length).length : 0;
    const cand = auto.candidatosPiloto(8);
    const log = auto.registro().slice(0, 40);
    view.innerHTML = `<div class="section-head"><div><h2>Central de automação</h2><p>A coleta diária roda sozinha no servidor do GitHub e publica as bases em <code>data/</code>. Ao abrir, o CRM aplica as novidades: organizações, contatos institucionais, dados da Receita, notícias, editais e os totais do Painel CIQUANTA. Com o piloto automático ligado, a abordagem também começa sozinha.</p></div>
      <div class="toolbar" style="margin:0"><button class="btn primary" id="agora" ${est.rodando ? 'disabled' : ''}>${icon('sync', 15)} ${est.rodando ? 'Executando…' : 'Executar agora'}</button></div></div>

      <div class="card fluxo-card">${fluxo(n)}</div>

      <div class="grid g4" style="margin:18px 0">
        <div class="card kpi"><span class="label">Última coleta</span><span class="value" style="font-size:24px">${ult ? relTime(ult.em) : 'ainda não rodou'}</span><span class="sub">${ult ? `${fmtDateTime(ult.em)} · ${ult.segundos}s · integridade ${ult.integridade === 'ok' ? 'ok' : 'com erro'}` : 'publique o repositório e ative o GitHub Actions'}</span></div>
        <div class="card kpi"><span class="label">Organizações automáticas</span><span class="value" data-contar="${auto_}">${num(auto_)}</span><span class="sub">${num(desc?.itens?.length || 0)} descobertas em notícias</span></div>
        <div class="card kpi"><span class="label">Contatos automáticos</span><span class="value" data-contar="${ctAuto}">${num(ctAuto)}</span><span class="sub">${num(canaisN)} sites com canal institucional</span></div>
        <div class="card kpi"><span class="label">Sinais e editais</span><span class="value" data-contar="${sinais().itens.length}">${num(sinais().itens.length)}</span><span class="sub">${num(editais?.itens?.length || 0)} chamadas identificadas · ${num(Object.keys(receita?.porOrg || {}).length)} CNPJ consultados</span></div>
      </div>

      <div class="grid g2" style="margin-bottom:18px">
        <div class="card"><h3>Coleta diária no servidor <span class="muted">${ult ? 'última execução' : ''}</span></h3>
          ${ult ? `<div class="list">${ult.etapas.map(e => `<div class="list-item"><span class="estado ${e.ok ? (e.ignorada ? 'neutro' : 'ok') : 'bad'}"></span><div style="flex:1;min-width:0"><div class="title">${esc(e.nome)}</div><div class="meta">${esc(e.msg || '')}</div></div><span class="muted small nowrap">${e.segundos}s</span></div>`).join('')}</div>
            <p class="muted small" style="margin-bottom:0">Roda às 6h17 todos os dias e às 15h47 nos dias úteis. ${coleta.execucoes?.length > 1 ? `${coleta.execucoes.filter(x => x.etapas.every(e => e.ok)).length} de ${coleta.execucoes.length} execuções recentes sem falha.` : ''}</p>`
            : '<div class="empty">Quando o sistema estiver publicado com o GitHub Actions ativo, o resultado de cada coleta aparece aqui. Veja PUBLICACAO.md.</div>'}</div>
        <div class="card"><h3>Rotinas do aplicativo <span class="muted">${est.ultima ? 'última: ' + relTime(est.ultima) : ''}</span></h3>
          <div class="rotinas">${auto.ROTINAS.map(r => `<label class="rotina"><span class="chave"><input type="checkbox" data-chave="${r.chave}" ${c[r.chave] ? 'checked' : ''}><i></i></span><span><b>${esc(r.nome)}</b><small>${esc(r.desc)}</small></span></label>`).join('')}</div></div>
      </div>

      <div class="card piloto ${c.pilotoAutomatico ? 'on' : ''}" style="margin-bottom:18px"><h3>${icon('robo', 17)} Piloto automático de abordagem <span class="badge ${c.pilotoAutomatico ? 'ok' : 'gray'}">${c.pilotoAutomatico ? 'ligado' : 'desligado'}</span></h3>
        <p class="muted" style="margin-top:0">Todo dia, escolhe as organizações de maior potencial com contato de e-mail que ainda não receberam nenhuma mensagem e as inscreve na cadência do seu segmento. Os envios respeitam o horário comercial, o limite diário do Gmail e a lista de descadastro, e param na primeira resposta. Com a base compartilhada ativa, só um computador conduz os envios.</p>
        <div class="toolbar"><label class="field" style="width:200px">Organizações por dia<input type="number" id="pl-lim" min="1" max="60" value="${esc(c.pilotoLimite)}"></label>
          <label class="field" style="width:200px">Potencial mínimo<input type="number" id="pl-min" min="0" max="100" value="${esc(c.pilotoMinimo)}"></label>
          <span class="muted small" style="align-self:end">${c.remetenteNome ? '' : 'Preencha o remetente em Configurações antes de ligar. '}${s.config.cadenciasAtivas ? '' : 'O envio automático das cadências está desligado. '}</span></div>
        <h3 style="margin-top:14px">Próximas organizações <span class="muted">${cand.length ? 'em ordem de potencial' : ''}</span></h3>
        ${cand.length ? `<div class="table-wrap"><table><thead><tr><th>Organização</th><th>Segmento</th><th>Contato</th><th>Cadência</th><th class="num">Potencial</th></tr></thead><tbody>${cand.map(x => `<tr><td class="title"><a href="#/org/${esc(x.org.id)}">${esc(x.org.nome)}</a></td><td>${segBadge(x.org.segmento)}</td><td class="small">${esc(x.contato.canal ? x.contato.area + ' (canal institucional)' : x.contato.nome)}<div class="muted">${esc(x.contato.email)}</div></td><td class="small">${esc(x.cadencia.nome)}</td><td class="num"><span class="pot"><i><b style="width:${x.pontos}%"></b></i>${x.pontos}</span></td></tr>`).join('')}</tbody></table></div>`
          : '<div class="empty">Nenhuma organização elegível agora: faltam contatos com e-mail nas organizações de maior potencial, ou todas já foram abordadas.</div>'}</div>

      <div class="card"><h3>Registro <span class="muted">neste navegador</span></h3>
        ${log.length ? `<div class="table-wrap"><table><thead><tr><th>Quando</th><th>Rotina</th><th>Resultado</th></tr></thead><tbody>${log.map(l => `<tr><td class="nowrap small">${fmtDateTime(l.em)}</td><td>${esc(NOMES_ROTINA[l.rotina] || l.rotina)}</td><td class="small"><span class="estado ${l.ok ? 'ok' : 'bad'}"></span> ${esc(l.msg)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">As rotinas ainda não registraram mudanças neste navegador.</div>'}</div>`;

    animarNumeros(view);
    view.querySelector('#agora').onclick = () => auto.executar({ manual: true });
    view.querySelectorAll('[data-chave]').forEach(i => i.onchange = () => {
      if (i.dataset.chave === 'pilotoAutomatico' && i.checked && !store.cfg().remetenteNome) { i.checked = false; toast('Preencha o nome do remetente em Configurações antes de ligar o piloto automático.', 'bad'); return; }
      store.setConfig({ [i.dataset.chave]: i.checked }); toast(`${auto.ROTINAS.find(r => r.chave === i.dataset.chave).nome}: ${i.checked ? 'ligado' : 'desligado'}.`, 'ok');
      if (i.checked) auto.executar(); else draw();
    });
    const num_ = (id, k, min, max) => view.querySelector(id).onchange = e => { store.setConfig({ [k]: Math.min(max, Math.max(min, +e.target.value || min)) }); draw(); };
    num_('#pl-lim', 'pilotoLimite', 1, 60); num_('#pl-min', 'pilotoMinimo', 0, 100);
  };
  draw();
  offs.push(auto.onAutomacao(draw));
  return () => offs.forEach(f => f());
}
