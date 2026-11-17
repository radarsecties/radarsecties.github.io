import * as store from '../store.js';
import * as G from '../google.js';
import * as monitor from '../monitor.js';
import * as cad from '../cadencia.js';
import { esc, num, money, pct, relTime, FUNIL, isoDay, fmtDateTime, MESES_LONGOS } from '../util.js';
import { chart } from '../charts.js';
import { mapaFluxo } from '../components.js';
import { sinais, TEMAS } from '../sinais.js';
import * as auto from '../automacao.js';
import { loadMecanismos } from '../email.js';
import { proximasAcoes, receitaPorFonte, pontuar, contexto } from '../score.js';
import { icon } from '../icons.js';
import { palavras } from '../motion.js';

const DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const saudacao = () => { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; };

const compacto = v => v >= 1e9 ? `R$ ${(v / 1e9).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} bi` : v >= 1e6 ? `R$ ${(v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi` : v >= 1e3 ? `R$ ${Math.round(v / 1e3)} mil` : money(v);
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const TIPO_COR = { Responder: 'ok', Atrasado: 'red', Proposta: '', Edital: 'warn', Oportunidade: '', Cadência: 'info', Contato: 'gray', Retomar: 'warn', Pesquisa: '' };

/** Primeiros passos: some quando tudo está feito ou quando a pessoa oculta. */
function guia(s, g) {
  const c = s.config; if (c.guiaOculto) return '';
  const passos = [
    [g.conectado || !!c.clientId && s.envios.length > 0, 'Conectar a conta Google', 'E-mails, agenda, Drive e planilhas do painel', '#/config'],
    [s.orgs.length > 0, 'Importar o mapeamento', '471 organizações com nível de evidência', '#/busca?aba=referencia'],
    [s.contatos.some(x => x.email), 'Cadastrar contatos', 'Busca ativa, Gmail ou cadastros do painel', '#/busca'],
    [Number(c.metaAnual) > 0, 'Definir a meta de captação', 'Meta anual e metas por frente', '#/captacao'],
    [s.inscricoes.length > 0 || s.envios.length > 0, 'Iniciar a primeira cadência', 'Sequência automática por público', '#/cadencias'],
    [s.oportunidades.length > 0, 'Registrar uma oportunidade', 'Valor, etapa e mecanismo de fomento', '#/oportunidades'],
    [!!c.sincronizar, 'Ativar a base compartilhada', 'Mesma base em todos os computadores', '#/config'],
  ];
  const feitos = passos.filter(p => p[0]).length; if (feitos === passos.length) return '';
  return `<div class="card guia"><h3>Primeiros passos <span class="muted">${feitos} de ${passos.length} concluídos</span><button class="btn ghost sm" id="guia-x">Ocultar</button></h3>
    <div class="meta-bar"><i style="width:${feitos / passos.length * 100}%"></i></div>
    <div class="passos">${passos.map(([ok, t, d, h], i) => `<a class="passo ${ok ? 'ok' : ''}" href="${h}"><span class="n">${ok ? '✓' : i + 1}</span><span><b>${t}</b><small>${d}</small></span></a>`).join('')}</div></div>`;
}

export async function render(view) {
  await loadMecanismos();
  const charts = []; let gcal = [], modoMapa = 'orgs';
  await import('../sinais.js').then(m => m.carregarSinais());
  const draw = () => {
    charts.splice(0).forEach(c => c.destroy());
    const s = store.state(), conf = s.config, hoje = isoDay(), d = new Date();
    const abertas = s.oportunidades.filter(o => !['contratada', 'perdida'].includes(o.etapa));
    const ponderado = abertas.reduce((a, o) => a + store.pipelineValor(o), 0);
    const contratado = s.oportunidades.filter(o => o.etapa === 'contratada').reduce((a, o) => a + (Number(o.valor) || 0), 0);
    const enviados = s.envios.filter(e => e.status === 'enviado'), resp = enviados.filter(e => e.respondido).length;
    const ativas = s.orgs.filter(o => o.relacionamento && o.relacionamento !== 'mapeada').length;
    const insAtivas = s.inscricoes.filter(i => i.status === 'ativa').length, insResp = s.inscricoes.filter(i => i.status === 'respondeu').length;
    const g = G.status(), live = monitor.estado(), p = s.painel || {}, t = p.totais || {};
    const meta = Number(conf.metaAnual) || 0;
    const acoes = proximasAcoes(7);
    // agenda unificada
    const ag = [
      ...s.eventos.filter(e => e.data >= hoje).map(e => ({ data: e.data, hora: e.hora, titulo: e.titulo, tipo: ({ potencial: 'Evento potencial', prazo: 'Prazo', setorial: 'Data do setor', reuniao: 'Reunião' })[e.tipo] || 'Institucional', k: e.tipo === 'prazo' ? 'red' : e.tipo === 'potencial' ? 'gray' : '', conf: e.aConfirmar })),
      ...s.editais.filter(e => e.prazo && e.prazo >= hoje && ['aberto', 'preparacao'].includes(e.status)).map(e => ({ data: e.prazo, titulo: e.titulo, tipo: 'Edital', k: 'warn' })),
      ...(p.visitas || []).filter(v => v.data >= hoje).map(v => ({ data: v.data, titulo: v.grupos.length ? `Visita: ${v.grupos.slice(0, 2).join(', ')}${v.grupos.length > 2 ? ' e outras' : ''}` : `${v.visitas} visita(s) agendada(s)`, tipo: `${v.pessoas} visitantes`, k: 'info' })),
      ...gcal,
    ].sort((a, b) => (a.data + (a.hora || '')).localeCompare(b.data + (b.hora || ''))).slice(0, 8);
    const fontes = receitaPorFonte();
    const fmax = Math.max(1, ...FUNIL.map(f => s.oportunidades.filter(o => (o.etapa || 'qualificacao') === f.id).reduce((a, o) => a + (Number(o.valor) || 0), 0)));

    view.innerHTML = `
    <header class="hoje">
      <div>
        <div class="data">${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES_LONGOS[d.getMonth()]}</div>
        <h2>${(() => { const n = acoes.length, pre = saudacao() + '.'; if (!n) return `${palavras(pre)} ${palavras('Tudo em dia por aqui.', 2)}`; const qtd = n === 1 ? 'Uma ação' : `${n} ações`; return `${palavras(pre)} <em>${palavras(qtd, 2)}</em> ${palavras(n === 1 ? 'pede atenção hoje.' : 'pedem atenção hoje.', 4)}`; })()}</h2>
        <div class="estado-linha"><span class="${g.conectado ? 'on' : ''}">${g.conectado ? esc(g.email || 'E-mail conectado') : 'E-mail desconectado'}</span><span class="${live.ativo ? 'on' : ''}">${live.ativo ? 'Respostas ao vivo' : 'Respostas em pausa'}</span><span class="${g.conectado && conf.cadenciasAtivas && insAtivas ? 'on' : ''}">${insAtivas} em cadência</span></div>
      </div>
      <div class="toolbar">${g.conectado ? '' : '<a class="btn primary" href="#/config">Conectar e-mail</a>'}
        <a class="btn" href="#/oportunidades">Nova oportunidade</a><a class="btn" href="#/campanhas">Nova campanha</a><button class="btn ghost" id="kbtn">Buscar <kbd>Ctrl K</kbd></button></div>
    </header>

    <div class="regua">
      <a class="kpi" href="#/oportunidades"><span class="label">Pipeline ponderado</span><span class="value" data-contar="${Math.round(ponderado)}" data-formato="moeda">${compacto(ponderado)}</span><span class="sub">${abertas.length} oportunidade(s) em aberto</span></a>
      <a class="kpi" href="#/captacao"><span class="label">Contratado</span><span class="value" data-contar="${Math.round(contratado)}" data-formato="moeda">${compacto(contratado)}</span><span class="sub">${meta ? `${pct(contratado, meta)}% da meta de ${compacto(meta)}` : 'defina a meta no plano de captação'}</span>${meta ? `<span class="meta-bar"><i style="width:${Math.min(100, pct(contratado, meta))}%"></i><b style="width:${Math.min(100 - Math.min(100, pct(contratado, meta)), pct(ponderado, meta))}%"></b></span>` : ''}</a>
      <a class="kpi" href="#/organizacoes"><span class="label">Em relacionamento</span><span class="value" data-contar="${ativas}">${num(ativas)}</span><span class="sub">de ${num(s.orgs.length)} organizações mapeadas</span></a>
      <a class="kpi" href="#/interacoes"><span class="label">Taxa de resposta</span><span class="value" data-contar="${enviados.length ? pct(resp, enviados.length) : 0}" data-sufixo="%">${enviados.length ? pct(resp, enviados.length) + '%' : '—'}</span><span class="sub">${resp} resposta(s) a ${enviados.length} e-mail(s)</span></a>
      <a class="kpi" href="#/visitas"><span class="label">Visitantes da réplica</span><span class="value" data-contar="${t.pessoas || 0}">${t.pessoas ?? '—'}</span><span class="sub">${t.visitas === undefined ? 'aguardando o Painel CIQUANTA' : `${t.recebidos ? num(t.recebidos) + ' já recebidos · ' : ''}${num(t.cadastros)} cadastros`}</span></a>
    </div>

    <div class="grid dash-a" style="margin-bottom:18px">
      <div class="card"><h3>Próximas ações <span class="muted">ordenadas por impacto</span></h3><div class="acoes">${acoes.length ? acoes.map(a => `<a class="acao" href="${esc(a.href)}"><span class="badge ${TIPO_COR[a.tipo] || ''}">${esc(a.tipo)}</span><span class="tx"><b>${esc(a.titulo)}</b><small>${esc(a.detalhe || '')}</small></span>${icon('direita', 16)}</a>`).join('') : `<div class="empty">Nada pendente. ${s.orgs.length ? 'Cadastre contatos nas organizações de maior potencial para iniciar as cadências.' : 'Comece importando o mapeamento setorial.'}</div>`}</div></div>
      <div class="card"><h3>Agenda <a class="small" href="#/agenda">abrir</a></h3><div class="list">${ag.length ? ag.map(e => `<div class="list-item"><div class="date-chip">${e.data.slice(8)}<small>${MES[+e.data.slice(5, 7) - 1]}</small></div><div style="min-width:0"><div class="title">${esc(e.titulo)}</div><div class="meta"><span class="badge ${e.k}">${esc(e.tipo)}</span> ${e.hora ? esc(e.hora) + ' · ' : ''}${relTime(e.data)}${e.conf ? ' · a confirmar' : ''}</div></div></div>`).join('') : '<div class="empty">Sem compromissos futuros.</div>'}</div></div>
    </div>

    <div class="grid g3" style="margin-bottom:18px">
      <div class="card"><h3>Funil de oportunidades</h3><div class="funil">${FUNIL.filter(f => f.id !== 'perdida').map(f => { const os = s.oportunidades.filter(o => (o.etapa || 'qualificacao') === f.id), v = os.reduce((a, o) => a + (Number(o.valor) || 0), 0); return `<a href="#/oportunidades"><span class="l">${esc(f.nome)}</span><span class="b"><i style="width:${Math.max(v ? 6 : 0, 100 * v / fmax)}%;background:${f.cor}"></i></span><span class="v">${os.length} · ${compacto(v)}</span></a>`; }).join('')}</div></div>
      <div class="card"><h3>Receita por fonte <span class="muted">contratado e ponderado</span></h3>${Object.keys(fontes).length ? `<div class="funil">${Object.entries(fontes).map(([k, v]) => { const mx = Math.max(1, ...Object.values(fontes).map(x => x.contratado + x.ponderado)); return `<div><span class="l">${esc(k)}</span><span class="b"><i style="width:${100 * v.contratado / mx}%;background:var(--ok)"></i><i style="width:${100 * v.ponderado / mx}%;background:var(--acento)"></i></span><span class="v">${compacto(v.contratado)} · ${compacto(v.ponderado)}</span></div>`; }).join('')}</div><p class="muted small" style="margin:10px 0 0"><span class="dot-i" style="background:var(--ok)"></span> contratado <span class="dot-i" style="background:var(--acento);margin-left:10px"></span> ponderado em aberto</p>` : '<div class="empty">As três fontes da política de sustentabilidade (financiamento público, receita contratual e parcerias) aparecem aqui conforme as oportunidades são registradas.</div>'}</div>
      <div class="card"><h3>Rede pelo Brasil <span class="seg-mini"><button data-mapa="orgs" class="${modoMapa === 'orgs' ? 'on' : ''}">Organizações</button><button data-mapa="painel" class="${modoMapa === 'painel' ? 'on' : ''}">Cadastros no Painel</button></span></h3><div id="map"></div></div>
    </div>

    <div class="grid g3" style="margin-bottom:18px">
      <div class="card span2"><h3>Potencial por setor <span class="muted">organizações com potencial alto e pipeline ponderado</span></h3><div class="chart-box"><canvas id="c-setor"></canvas></div></div>
      <div class="card"><h3>Interações recentes <a class="small" href="#/interacoes">${live.ativo ? '<span class="badge ok">ao vivo</span>' : 'abrir'}</a></h3><div class="list" id="feed"></div></div>
    </div>

    <div class="grid g3">
      <div class="card span2"><h3>Sinais do mercado <a class="small" href="#/sinais">ver todos</a></h3>${(() => {
        const l = sinais().itens.filter(x => x.orgs.length || x.temas.includes('quantica') || x.temas.includes('ciquanta') || x.edital).slice(0, 6);
        return l.length ? `<div class="sinais compacto">${l.map(x => `<article class="sinal"><div class="quando">${relTime(x.data)}<small>${esc(x.fonte)}</small></div><div><a class="title" href="${esc(x.link)}" target="_blank" rel="noopener">${esc(x.titulo)}</a><div class="tags">${x.edital ? '<span class="badge warn">Chamada aberta</span>' : ''}${x.temas.slice(0, 2).map(t => `<span class="badge gray">${esc(TEMAS[t] || t)}</span>`).join('')}${x.orgs.map(id => store.get('orgs', 'org-' + id.replace(/^(ref|auto)-/, ''))).filter(Boolean).slice(0, 3).map(o => `<a class="badge" href="#/org/${esc(o.id)}">${esc(o.nomeFantasia || o.nome)}</a>`).join('')}</div></div></article>`).join('')}</div>` : '<div class="empty">Os sinais aparecem depois da primeira coleta diária.</div>';
      })()}</div>
      <div class="card"><h3>Automação <a class="small" href="#/automacao">central</a></h3>${(() => {
        const hojeLog = auto.registro().filter(x => x.em.slice(0, 10) === hoje && x.n);
        const est = auto.estado();
        return `<div class="auto-resumo"><span class="estado ${est.rodando ? 'girando' : 'ok'}"></span><span>${est.rodando ? 'Executando as rotinas…' : est.ultima ? 'Rotinas executadas ' + relTime(est.ultima) : 'Rotinas aguardando a primeira execução'}</span></div>
          ${hojeLog.length ? `<div class="list">${hojeLog.slice(0, 6).map(x => `<div class="list-item"><div><div class="title">${esc(auto.ROTINAS.find(r => r.id === x.rotina)?.nome || x.rotina)}</div><div class="meta">${esc(x.msg)}</div></div></div>`).join('')}</div>` : '<p class="muted small">Nenhuma novidade aplicada hoje.</p>'}
          <p class="muted small" style="margin-bottom:0">Piloto automático ${s.config.pilotoAutomatico ? '<b>ligado</b>' : 'desligado'} · ${num(s.inscricoes.filter(i => i.origem === 'piloto').length)} abordagens iniciadas por ele.</p>`;
      })()}</div>
    </div>`;

    const ufCount = {};
    if (modoMapa === 'painel') (p.publico?.porUf || []).forEach(u => { ufCount[u.uf] = u.total; });
    else s.orgs.forEach(o => { if (o.uf) ufCount[o.uf] = (ufCount[o.uf] || 0) + 1; });
    view.querySelector('#map').appendChild(mapaFluxo(ufCount, { label: modoMapa === 'painel' ? 'cadastros no Painel CIQUANTA' : 'organizações', onClick: uf => location.hash = modoMapa === 'painel' ? '#/visitas' : `#/organizacoes?uf=${uf}` }));
    view.querySelectorAll('[data-mapa]').forEach(b => b.onclick = () => { modoMapa = b.dataset.mapa; draw(); });
    view.querySelector('#kbtn').onclick = () => window.dispatchEvent(new Event('ciq:paleta'));
    view.querySelector('#guia-x')?.addEventListener('click', () => { store.setConfig({ guiaOculto: true }); draw(); });
    const l = [...s.interacoes].sort((a, b) => (b.data || '').localeCompare(a.data || '')).slice(0, 6);
    view.querySelector('#feed').innerHTML = l.length ? l.map(i => { const o = store.get('orgs', i.orgId); return `<div class="list-item"><span class="badge ${i.tipo === 'recebido' ? 'ok' : i.tipo === 'reuniao' || i.tipo === 'visita' ? 'info' : 'gray'}">${esc(i.tipo === 'recebido' ? 'recebido' : i.tipo === 'email' ? 'enviado' : i.tipo)}</span><div style="min-width:0"><div class="title" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(i.titulo)}</div><div class="meta">${o ? `<a href="#/org/${esc(o.id)}">${esc(o.nomeFantasia || o.nome)}</a> · ` : ''}${fmtDateTime(i.data)}</div></div></div>`; }).join('') : '<div class="empty">Nenhuma interação registrada.</div>';
    // potencial por setor
    const ctx = contexto(), por = {};
    s.orgs.forEach(o => { const k = o.setor || ''; if (!k) return; (por[k] ||= { alto: 0, pipe: 0 }); if (pontuar(o, ctx).total >= 65) por[k].alto++; });
    abertas.forEach(o => { if (o.setor) (por[o.setor] ||= { alto: 0, pipe: 0 }).pipe += store.pipelineValor(o); });
    const top = Object.entries(por).filter(([, v]) => v.alto || v.pipe).sort((a, b) => b[1].pipe - a[1].pipe || b[1].alto - a[1].alto).slice(0, 12);
    if (!top.length) view.querySelector('#c-setor').parentElement.outerHTML = '<div class="empty">As organizações de potencial alto e o pipeline por setor aparecem aqui conforme os contatos e as oportunidades são registrados.</div>';
    else charts.push(chart(view.querySelector('#c-setor'), { data: { labels: top.length ? top.map(([k]) => store.setorCurto(k)) : ['Sem dados'], datasets: [
      { type: 'bar', label: 'Organizações com potencial alto', data: top.map(([, v]) => v.alto), backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--sobre').trim() || '#E4E4DC', borderRadius: 2, yAxisID: 'y' },
      { type: 'bar', label: 'Pipeline ponderado (R$)', data: top.map(([, v]) => Math.round(v.pipe)), backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--acento').trim() || '#2F55D4', borderRadius: 2, yAxisID: 'y1' }] },
      options: { scales: { y1: { position: 'right', beginAtZero: true, grid: { display: false }, ticks: { callback: v => compacto(v) } } }, onClick: (_, el) => { if (el[0] && top[el[0].index]) location.hash = `#/setores/${top[el[0].index][0]}`; } } }));
  };
  draw();
  if (G.status().conectado && G.hasScope('calendar')) G.calendarEvents({ dias: 14, passado: 0 }).then(r => { gcal = (r.items || []).filter(e => e.status !== 'cancelled').map(e => ({ data: (e.start.dateTime || e.start.date).slice(0, 10), hora: e.start.dateTime ? new Date(e.start.dateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '', titulo: e.summary || '(sem título)', tipo: 'Google Agenda', k: 'ok' })); if (view.isConnected) draw(); }).catch(() => {});
  const off = [store.onChange(w => { if (['recebidos', 'inscricoes', 'painel'].includes(w) && !document.querySelector('.modal-back, .paleta')) draw(); }), monitor.onLive(e => { if (e.tipo === 'estado') draw(); }), cad.onCadencia(() => {}), auto.onAutomacao(res => { if (!res || !res.some(x => x.n)) draw(); })];
  const onTheme = () => draw(); window.addEventListener('themechange', onTheme);
  return () => { charts.forEach(c => c.destroy()); window.removeEventListener('themechange', onTheme); off.forEach(f => f()); };
}
