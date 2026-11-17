// Integração com o Painel CIQUANTA (painelciquanta.secties.pb.gov.br): visitas à réplica e cadastros de perfis.
// Lê as planilhas do painel pelo e-mail do CIQUANTA conectado. Documentos e telefones não são gravados no CRM.
import * as store from '../store.js';
import * as G from '../google.js';
import { esc, toast, norm, options, isEmail, fmtDate, isoDay, uid, debounce } from '../util.js';
import { chart } from '../charts.js';
import { icon } from '../icons.js';

const NOMES = { visitas: 'CIQUANTA | Agendamentos de visita', cadastros: 'CIQUANTA | Cadastros de perfis' };
let mem = { visitas: [], cadastros: [] }; // linhas completas ficam só na memória da aba

const col = (r, ...ks) => { for (const k of Object.keys(r)) if (ks.some(x => norm(k).startsWith(norm(x)))) return r[k]; return ''; };
const dataISO = v => { const m = String(v).match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : ''; };
const sim = v => /^sim/i.test(String(v));

export async function sincronizar() {
  if (!G.hasScope('planilhas')) throw new Error('Conecte o e-mail do CIQUANTA em Configurações.');
  const conf = store.cfg(); const ids = { visitas: G.sheetId(conf.planilhaVisitas), cadastros: G.sheetId(conf.planilhaCadastros) };
  for (const k of ['visitas', 'cadastros']) if (!ids[k]) { try { ids[k] = await G.driveFindByName(NOMES[k]); } catch {} }
  if (!ids.visitas && !ids.cadastros) throw new Error('Informe em Configurações os links das planilhas do painel (agendamentos de visita e cadastros de perfis).');
  store.setConfig({ planilhaVisitas: ids.visitas || conf.planilhaVisitas, planilhaCadastros: ids.cadastros || conf.planilhaCadastros });
  mem = { visitas: [], cadastros: [] };
  if (ids.visitas) for (const rows of Object.values(await G.sheetRead(ids.visitas))) for (const r of rows) {
    const data = dataISO(col(r, 'Data da visita')); if (!data) continue;
    mem.visitas.push({ protocolo: col(r, 'Protocolo'), situacao: col(r, 'Situação') || 'Pendente', tipo: col(r, 'Tipo de visita') || 'Visita', data, sessao: col(r, 'Sessão'), pessoas: Number(col(r, 'Pessoas')) || 1,
      instituicao: col(r, 'Instituição'), responsavel: col(r, 'Responsável'), email: col(r, 'E-mail').toLowerCase(), noticias: sim(col(r, 'Aceita receber notícias')), escolaridade: col(r, 'Escolaridade'), area: col(r, 'Área de formação') });
  }
  if (ids.cadastros) for (const [aba, rows] of Object.entries(await G.sheetRead(ids.cadastros))) for (const r of rows) {
    const nome = col(r, 'Nome completo', 'Nome da instituição', 'Razão social', 'Nome'); if (!nome) continue;
    mem.cadastros.push({ aba, protocolo: col(r, 'Protocolo'), situacao: col(r, 'Situação') || 'Pendente', categoria: col(r, 'Categoria') || aba, nome, email: col(r, 'E-mail').toLowerCase(), cidade: col(r, 'Cidade'), uf: col(r, 'UF').toUpperCase().slice(0, 2),
      instituicao: col(r, 'Instituição ou empresa', 'Instituição', 'Empresa'), cargo: col(r, 'Cargo'), titulacao: col(r, 'Maior titulação'), area: col(r, 'Grande área'), temas: col(r, 'Temas de interesse'), experiencia: col(r, 'Experiência com computação quântica'),
      linkedin: col(r, 'LinkedIn ou site'), lattes: col(r, 'Currículo Lattes'), noticias: sim(col(r, 'Aceita receber notícias')), recebido: dataISO(col(r, 'Recebido em')) });
  }
  // Resumo persistido: só agregados e visitas institucionais, sem dados pessoais de visitantes individuais
  const cat = {}, temas = {}; mem.cadastros.forEach(c => { cat[c.categoria] = (cat[c.categoria] || 0) + 1; c.temas.split(/[;,]/).map(t => t.trim()).filter(Boolean).forEach(t => temas[t] = (temas[t] || 0) + 1); });
  const porDia = {}; mem.visitas.filter(v => !/cancel/i.test(v.situacao)).forEach(v => { const d = (porDia[v.data] ||= { data: v.data, visitas: 0, pessoas: 0, grupos: [] }); d.visitas++; d.pessoas += v.pessoas; if (v.instituicao && !/individual/i.test(v.tipo)) d.grupos.push(v.instituicao); });
  const hoje = isoDay(), validas = mem.visitas.filter(v => !/cancel/i.test(v.situacao));
  store.state().painel = { atualizadoEm: new Date().toISOString(), fonte: 'planilhas', publico: store.state().painel?.publico, visitas: Object.values(porDia).sort((a, b) => a.data.localeCompare(b.data)), cadastros: cat, temas,
    totais: { visitas: validas.length, pessoas: validas.reduce((a, v) => a + v.pessoas, 0), futuras: validas.filter(v => v.data >= hoje).length, canceladas: mem.visitas.length - validas.length, cadastros: mem.cadastros.length, comConsentimento: mem.cadastros.filter(c => c.noticias).length } };
  store.touch('painel');
  return store.state().painel;
}

const SEG = c => /empreend|empres|invest|startup/i.test(c) ? 'Empresa' : /pesquis|docente|professor|estudante|pós|gradua/i.test(c) ? 'Academia/ICT' : /gestor|servidor|govern|públic/i.test(c) ? 'Autoridade' : 'Outro';
function levarAoCRM(c) {
  if (!isEmail(c.email)) return 'sem e-mail';
  if (store.list('contatos').some(x => norm(x.email) === c.email)) return 'existente';
  const nomeOrg = c.instituicao || 'Cadastros individuais do Painel CIQUANTA';
  let org = store.findOrgByName(nomeOrg);
  if (!org) { org = { id: uid('org'), nome: nomeOrg, segmento: SEG(c.categoria), setor: SEG(c.categoria) === 'Academia/ICT' ? 'ecossistema' : '', uf: c.uf, cidade: c.cidade, relacionamento: 'contato', evidencia: /sim|já|tenho|trabalh/i.test(c.experiencia) && !/não/i.test(c.experiencia) ? 'indicios' : 'potencial', prioridade: 'B', bloco: SEG(c.categoria) === 'Academia/ICT' ? 'academico' : 'industrial', mecanismos: [], tags: ['painel'], origem: 'Painel CIQUANTA', criadoEm: new Date().toISOString() }; store.list('orgs').push(org); }
  store.list('contatos').push({ id: uid('ct'), nome: c.nome, email: c.email, orgId: org.id, cargo: c.cargo, tratamento: 'Prezado(a)', linkedin: /^https?:/.test(c.linkedin) ? c.linkedin : '', fonte: `Painel CIQUANTA, cadastro ${c.protocolo}`, notas: [c.categoria, c.titulacao, c.area, c.temas && 'Interesses: ' + c.temas].filter(Boolean).join(' · '), optout: !c.noticias, tags: ['painel', c.categoria], criadoEm: new Date().toISOString() });
  return 'novo';
}

export async function render(view) {
  let aba = 'visitas', ch = [];
  const f = { cat: '', q: '', consent: true };
  const draw = () => {
    ch.forEach(c => c.destroy()); ch = [];
    const p = store.state().painel, t = p.totais || {}, conf = store.cfg(), g = G.status(), hoje = isoDay();
    const pronto = g.conectado;
    view.innerHTML = `<div class="section-head"><div><h2>Visitas e cadastros</h2></div>
      <div class="toolbar" style="margin:0"><a class="btn" href="${esc(conf.painelUrl)}" target="_blank" rel="noopener">${icon('externo', 14)} Abrir o painel</a><button class="btn primary" id="sync" ${pronto ? '' : 'disabled'}>Atualizar dados</button></div></div>
      
      <div class="grid g4" style="margin-bottom:16px">
        <div class="card kpi"><span class="label">${p.fonte === 'publico' ? 'Sessões com agendamento' : 'Visitas agendadas'}</span><span class="value" data-contar="${t.visitas || 0}">${t.visitas ?? '—'}</span><span class="sub">${t.futuras ?? 0} a partir de hoje${t.canceladas ? ` · ${t.canceladas} cancelada(s) fora da conta` : ''}</span></div>
        <div class="card kpi"><span class="label">Visitantes</span><span class="value" data-contar="${t.pessoas || 0}">${t.pessoas ?? '—'}</span><span class="sub">${t.recebidos ? `${t.recebidos} já recebidos · ` : ''}pessoas nos agendamentos</span></div>
        <div class="card kpi"><span class="label">Cadastros de perfis</span><span class="value" data-contar="${t.cadastros || 0}">${t.cadastros ?? '—'}</span><span class="sub">${t.ufs ? `${t.ufs} estados · ${t.instituicoes || 0} instituições · ` : ''}${t.comConsentimento ?? 0} aceitam receber notícias</span></div>
        <div class="card kpi"><span class="label">Atualizado</span><span class="value" style="font-size:22px">${p.atualizadoEm ? new Date(p.atualizadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'nunca'}</span><span class="sub">${mem.visitas.length || mem.cadastros.length ? 'linhas carregadas nesta sessão' : 'atualize para ver as listas'}</span></div>
      </div>
      <div class="grid g3" style="margin-bottom:16px">
        <div class="card span2"><h3>Visitantes por dia</h3><div class="chart-box"><canvas id="c-dia"></canvas></div></div>
        <div class="card"><h3>Cadastros por categoria</h3><div class="chart-box"><canvas id="c-cat"></canvas></div></div>
      </div>
      <div class="grid g2" style="margin-bottom:16px">
        <div class="card"><h3>Temas de interesse dos cadastrados</h3>${Object.keys(p.temas || {}).length ? `<div class="tags">${Object.entries(p.temas).sort((a, b) => b[1] - a[1]).slice(0, 18).map(([k, v]) => `<span class="badge gray">${esc(k)} <b>${v}</b></span>`).join('')}</div>` : '<div class="empty">Sem dados.</div>'}</div>
        <div class="card"><h3>Próximas visitas de grupos</h3><div class="list">${(p.visitas || []).filter(v => v.data >= hoje && v.grupos.length).slice(0, 6).map(v => `<div class="list-item"><div class="date-chip">${v.data.slice(8)}<small>${['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][+v.data.slice(5, 7) - 1]}</small></div><div><div class="title">${esc(v.grupos.join(', '))}</div><div class="meta">${v.visitas} agendamento(s) · ${v.pessoas} pessoas no dia</div></div></div>`).join('') || '<div class="empty">Nenhuma visita de grupo agendada.</div>'}</div></div>
      </div>
      <div class="tabs"><button data-aba="visitas" class="${aba === 'visitas' ? 'active' : ''}">Agendamentos (${mem.visitas.length})</button><button data-aba="cadastros" class="${aba === 'cadastros' ? 'active' : ''}">Cadastros (${mem.cadastros.length})</button></div><div id="lista"></div>`;
    const dias = (p.visitas || []).slice(-30);
    const vazio = (sel, msg) => { view.querySelector(sel).parentElement.outerHTML = `<div class="empty">${msg}</div>`; };
    if (!dias.length) vazio('#c-dia', 'Os agendamentos aparecem aqui depois da primeira atualização.');
    else ch.push(chart(view.querySelector('#c-dia'), { type: 'bar', data: { labels: dias.map(d => d.data.slice(8) + '/' + d.data.slice(5, 7)), datasets: [{ label: 'Pessoas', data: dias.map(d => d.pessoas), backgroundColor: dias.map(d => d.data >= hoje ? '#3056D5' : '#C9D3F3'), borderRadius: 4 }] }, options: { plugins: { legend: { display: false } } } }));
    const cats = Object.entries(p.cadastros || {}).sort((a, b) => b[1] - a[1]);
    if (!cats.length) vazio('#c-cat', 'Sem cadastros lidos.');
    else ch.push(chart(view.querySelector('#c-cat'), { type: 'bar', data: { labels: cats.map(c => c[0]), datasets: [{ data: cats.map(c => c[1]), backgroundColor: '#3056D5', borderRadius: 4 }] }, options: { indexAxis: 'y', plugins: { legend: { display: false } } } }));
    lista();
    view.querySelectorAll('[data-aba]').forEach(b => b.onclick = () => { aba = b.dataset.aba; draw(); });
    view.querySelector('#sync').onclick = async e => { e.target.disabled = true; e.target.textContent = 'Lendo planilhas…'; try { await sincronizar(); toast('Dados do painel atualizados.', 'ok'); } catch (err) { toast(err.message, 'bad'); } draw(); };
  };
  const lista = () => {
    const L = view.querySelector('#lista');
    if (!mem.visitas.length && !mem.cadastros.length) { L.innerHTML = '<div class="card"><div class="empty">As listas ficam disponíveis depois de "Atualizar dados". Por segurança, as linhas completas não são guardadas no navegador.</div></div>'; return; }
    if (aba === 'visitas') {
      const hoje = isoDay(), l = [...mem.visitas].sort((a, b) => (a.data < hoje) - (b.data < hoje) || a.data.localeCompare(b.data));
      L.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Data</th><th>Sessão</th><th>Tipo</th><th>Instituição ou responsável</th><th class="num">Pessoas</th><th>Situação</th><th></th></tr></thead><tbody>${l.slice(0, 400).map((v, i) => `<tr style="${v.data < hoje ? 'opacity:.6' : ''}"><td class="nowrap">${fmtDate(v.data)}</td><td>${esc(v.sessao)}</td><td class="small">${esc(v.tipo)}</td><td class="title">${esc(v.instituicao || v.responsavel)}</td><td class="num">${v.pessoas}</td><td><span class="badge ${/confirm/i.test(v.situacao) ? 'ok' : /cancel/i.test(v.situacao) ? 'bad' : 'warn'}">${esc(v.situacao)}</span></td>
        <td>${v.instituicao && !/individual/i.test(v.tipo) && !/cancel/i.test(v.situacao) ? `<button class="btn sm" data-org="${esc(v.protocolo)}">Registrar no CRM</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
      L.onclick = e => {
        const v = mem.visitas.find(x => x.protocolo === e.target.dataset.org); if (!v) return;
        let org = store.findOrgByName(v.instituicao);
        if (!org) org = store.upsert('orgs', { nome: v.instituicao, segmento: 'Academia/ICT', setor: 'ecossistema', relacionamento: 'contato', evidencia: 'potencial', prioridade: 'C', bloco: 'academico', mecanismos: [], tags: ['visita'], origem: 'Painel CIQUANTA' }, 'org');
        if (!store.list('interacoes').some(i => i.protocolo === v.protocolo)) store.logInteracao({ orgId: org.id, tipo: 'visita', titulo: `Visita à réplica do computador quântico (${v.pessoas} pessoas)`, data: v.data + 'T12:00:00', descricao: `${v.tipo}, sessão ${v.sessao}. Protocolo ${v.protocolo}.`, protocolo: v.protocolo });
        toast(`Visita registrada em ${org.nome}.`, 'ok'); location.hash = `#/org/${org.id}?aba=historico`;
      };
    } else {
      const cats = [...new Set(mem.cadastros.map(c => c.categoria))].sort();
      const l = () => { const q = norm(f.q); return mem.cadastros.filter(c => (!f.cat || c.categoria === f.cat) && (!f.consent || c.noticias) && (!q || norm([c.nome, c.instituicao, c.temas, c.cidade].join(' ')).includes(q))); };
      L.innerHTML = `<div class="toolbar"><input type="search" class="grow" id="cq" placeholder="Nome, instituição, tema" value="${esc(f.q)}"><select id="ccat">${options(cats, f.cat, { empty: 'Todas as categorias' })}</select><label class="check"><input type="checkbox" id="cons" ${f.consent ? 'checked' : ''}> Só quem aceita receber notícias</label><button class="btn primary" id="imp">Levar os filtrados ao CRM</button></div>
        <div class="table-wrap"><table><thead><tr><th>Nome</th><th>Categoria</th><th>Instituição ou empresa</th><th>Local</th><th>Temas de interesse</th><th>Notícias</th></tr></thead><tbody>${l().slice(0, 400).map(c => `<tr><td class="title">${esc(c.nome)}<div class="muted small">${esc(c.cargo)}</div></td><td><span class="badge">${esc(c.categoria)}</span></td><td>${esc(c.instituicao || '—')}</td><td class="small">${esc([c.cidade, c.uf].filter(Boolean).join('/'))}</td><td class="small">${esc(c.temas)}</td><td>${c.noticias ? '<span class="badge ok">aceita</span>' : '<span class="badge gray">não</span>'}</td></tr>`).join('') || '<tr><td colspan="6"><div class="empty">Nenhum cadastro neste filtro.</div></td></tr>'}</tbody></table></div>
        `;
      L.querySelector('#cq').addEventListener('input', debounce(e => { f.q = e.target.value; lista(); const i = L.querySelector('#cq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 300));
      L.querySelector('#ccat').onchange = e => { f.cat = e.target.value; lista(); };
      L.querySelector('#cons').onchange = e => { f.consent = e.target.checked; lista(); };
      L.querySelector('#imp').onclick = () => { const r = { novo: 0, existente: 0, 'sem e-mail': 0 }; l().forEach(c => r[levarAoCRM(c)]++); store.touch('orgs'); store.touch('contatos'); toast(`${r.novo} contato(s) criado(s), ${r.existente} já existiam, ${r['sem e-mail']} sem e-mail.`, 'ok'); };
    }
  };
  draw();
  const onT = () => draw(); window.addEventListener('themechange', onT);
  return () => { ch.forEach(c => c.destroy()); window.removeEventListener('themechange', onT); };
}
