// Motor de apresentações do CIQUANTA: deck institucional e decks setoriais gerados a partir de data/setores.json
const BASE = new URL('../', import.meta.url).href;
const A = p => BASE + p;
const e = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ul = arr => `<ul>${(arr || []).map(x => `<li>${e(x)}</li>`).join('')}</ul>`;
const CONTATO = 'ciquanta@secties.pb.gov.br';
// Primeira frase, sem cortar em abreviações como "art.", "nº." ou "ex."
function primeiraFrase(t = '') {
  const re = /\.\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/g; let m;
  while ((m = re.exec(t))) { const antes = t.slice(Math.max(0, m.index - 5), m.index).toLowerCase(); if (!/(art|nº|ex|inc|sr|sra)$/.test(antes.trim().split(/\s/).pop())) return t.slice(0, m.index + 1); }
  return t;
}

const cache = {};
const load = n => (cache[n] ||= fetch(A(`data/${n}.json`), { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error('Falha ao carregar ' + n); return r.json(); }));

export const deckUrl = id => A(`apresentacao.html?d=${encodeURIComponent(id)}`);

export async function listDecks() {
  const [set, inst] = await Promise.all([load('setores'), load('institucional')]);
  return [
    { id: 'institucional', titulo: 'Apresentação institucional', sub: 'Centro, infraestrutura, programas e parceiros', slides: inst.slides.length, oficial: true },
    ...set.itens.filter(s => s.deck).map(s => ({ id: s.id, titulo: `Agenda para ${s.ref || s.nome.toLowerCase()}`, sub: s.resumo, slides: 9 + s.linhas.length, setor: s, oficial: !!s.oficial })),
  ];
}

const foot = (n, total, escuro) => `<div class="s-foot"><img src="${A(escuro ? 'assets/logo-branco.png' : 'assets/logo-azul.png')}" alt="CIQUANTA"><span>${n} / ${total}</span></div>`;
const wrap = (cls, inner) => ({ cls, inner });

// ---------- Tipos de slide
const T = {
  capa: s => wrap('s-capa', `${s.tag ? `<div class="tag">${e(s.tag)}</div>` : ''}<img class="logo" src="${A('assets/logo-branco.png')}" alt="CIQUANTA"><div class="t">${e(s.titulo)}</div>${s.sub ? `<div class="sub">${e(s.sub)}</div>` : ''}<img class="parc" src="${A('assets/parceiros-branco.png')}" alt="Parceiros">`),
  numeros: s => wrap('', `<div class="s-pad"><h2>${e(s.titulo)}</h2><div class="s-two"><div class="s-text">${(s.texto || []).map(p => `<p>${e(p)}</p>`).join('')}</div><div class="s-nums">${s.numeros.map(n => `<div><b>${e(n.n)}</b><span>${e(n.d)}</span>${n.f ? `<span style="display:block;font-size:12px;color:#727892;margin-top:2px">Fonte: ${e(n.f)}</span>` : ''}</div>`).join('')}</div></div></div>`),
  cards: s => wrap(s.escuro ? 's-escuro' : '', `<div class="s-pad">${s.kicker ? `<div class="s-kicker">${e(s.kicker)}</div>` : ''}<h2>${e(s.titulo)}</h2>${s.lead ? `<p class="s-lead">${e(s.lead)}</p>` : ''}
    <div style="display:flex;gap:28px;flex:1;align-items:flex-start"><div class="s-cards ${s.cards.length === 4 ? 'c4' : s.cards.length === 2 ? 'c2' : ''}" style="flex:1">${s.cards.map((c, i) => `<div class="s-card ${s.cores ? s.cores[i] || '' : (s.cards.length === 3 && i === 1 ? '' : (s.cards.length === 3 ? 'azul' : ''))}"><h4>${e(c.t)}</h4>${c.l ? ul(c.l) : `<p>${e(c.d)}</p>`}</div>`).join('')}</div>${s.imagem ? `<img src="${A(s.imagem)}" alt="" style="width:260px;height:auto;align-self:center">` : ''}</div></div>`),
  foto: s => wrap('', `<div class="s-foto"><div class="img" style="background-image:url('${A(s.imagem)}')"></div><div class="tx"><h2>${e(s.titulo)}</h2><p class="s-lead" style="font-size:17px">${e(s.texto)}</p>${(s.itens || []).map(i => `<div class="s-card" style="padding:14px 18px"><h4 style="font-size:16px;margin:0 0 2px">${e(i.t)}</h4><p style="font-size:14px">${e(i.d)}</p></div>`).join('')}</div></div>`),
  hardware: s => wrap('s-escuro', `<div class="s-pad"><h2>${e(s.titulo)}</h2><p class="s-lead">${e(s.lead)}</p><div class="s-cards c4">${s.blocos.map((b, i) => `<div class="s-card ${i % 2 ? 'azul' : ''}" style="${i % 2 ? '' : 'background:#132045;color:#fff;border-left-color:#3056D5'}"><h4>${e(b.t)}</h4><ul style="${i % 2 ? '' : 'color:#C8CFEA'}">${b.itens.map(x => `<li style="${i % 2 ? '' : 'color:#C8CFEA'}">${e(x)}</li>`).join('')}</ul></div>`).join('')}</div></div>`, true),
  cronograma: (s, c) => wrap('', `<div class="s-pad"><h2>${e(s.titulo || 'Da fundação à validação com o setor')}</h2><div class="s-time">${c.cronograma.map(t => `<div><b>${e(t.ano)}</b><em>${e(t.fase)}</em>${ul(t.itens)}</div>`).join('')}</div></div>`),
  evento: s => wrap('s-escuro', `<div class="s-pad" style="justify-content:center"><div class="s-kicker">${e(s.titulo)}</div><h2 style="font-size:46px;max-width:900px">${e(s.data)}</h2><p class="s-lead" style="font-size:22px">${e(s.local)}</p></div>`),
  encerramento: s => wrap('s-fim', `<img class="logo" src="${A('assets/logo-azul.png')}" alt="CIQUANTA"><div class="t">${e(s.titulo)}</div><div class="ct">${e(s.contato || CONTATO)}</div><img class="parc" src="${A('assets/parceiros-marinho.png')}" alt="Parceiros">`),
  linha: s => wrap('', `<div class="s-pad" style="gap:16px"><div class="s-kicker">${e(s.kicker)}</div><h2 style="font-size:34px">${e(s.l.nome)}</h2>
    <div class="s-q"><small>Pergunta central</small>${e(s.l.pergunta)}</div>
    <div class="s-3"><div><h5>Clássico</h5>${ul(s.l.classico)}</div><div><h5>Híbrido</h5>${ul(s.l.hibrido)}</div><div><h5>Quântico</h5>${ul(s.l.quantico)}</div></div>
    <div class="s-ei"><div><b>Entregas</b>${e(s.l.entregas)}</div><div><b>Indicadores</b>${e(s.l.indicadores)}</div></div></div>`),
  passos: (s, c) => wrap('', `<div class="s-pad"><h2>Como a agenda mede vantagem</h2><div class="s-steps">${c.medicao.map((m, i) => `<div class="s-step"><i>${i + 1}</i><b>${e(m.t)}</b><span>${e(m.d)}</span></div>`).join('')}</div><div class="s-gate">${e(c.portao)}</div></div>`),
  riscos: (s, c) => wrap('', `<div class="s-pad"><h2>Riscos e como a agenda responde</h2><table class="s-table"><thead><tr><th>Risco</th><th>Resposta</th></tr></thead><tbody>${c.riscos.map(r => `<tr><td>${e(r[0])}</td><td>${e(r[1])}</td></tr>`).join('')}</tbody></table></div>`),
};

function setorSlides(s, comum, mecs) {
  const sl = [];
  sl.push({ tipo: 'capa', tag: 'Agenda de pesquisa aplicada', titulo: s.nome, sub: s.resumo });
  if (s.contexto?.length) sl.push({ tipo: 'numeros', titulo: 'Contexto do setor', texto: [s.resumo, 'Problemas em que o setor encontra limites de cálculo: ' + s.desafios.map((d, i) => i ? d.charAt(0).toLowerCase() + d.slice(1) : d.charAt(0).toLowerCase() + d.slice(1)).join('; ') + '.'], numeros: s.contexto.slice(0, 4) });
  else sl.push({ tipo: 'cards', titulo: 'Onde o setor encontra limites de cálculo', lead: s.resumo, cards: s.desafios.slice(0, 4).map((d, i) => ({ t: String(i + 1).padStart(2, '0'), d })), cores: ['', 'azul', '', 'marinho'] });
  sl.push({ tipo: 'cards', titulo: 'Máquinas e computação clássica, integradas', lead: comum.infraNota, cards: comum.infra.map(i => ({ t: i.t, d: i.d })), cores: ['marinho', 'azul', '', ''] });
  sl.push({ tipo: 'cards', titulo: 'Clássico e quântico na mesma agenda', lead: comum.metodoLead, cards: comum.metodo });
  sl.push({ tipo: 'cards', kicker: `${s.linhas.length} linhas de pesquisa, uma infraestrutura híbrida`, titulo: `Agenda para ${s.ref || s.nome.toLowerCase()}`, lead: 'GJQ-100, GJQ-20, datacenter clássico integrado e orquestração clássico-quântica.', cards: s.linhas.map(l => ({ t: l.nome, d: l.sub })), cores: s.linhas.map((_, i) => ['', 'azul', 'marinho', '', 'azul'][i]) });
  s.linhas.forEach((l, i) => sl.push({ tipo: 'linha', kicker: `Linha ${i + 1} de ${s.linhas.length}`, l }));
  sl.push({ tipo: 'passos' });
  sl.push({ tipo: 'cards', titulo: 'Como financiar os projetos', lead: 'Instrumentos aplicáveis ao setor. Percentuais e condições devem ser confirmados no texto legal e com o órgão gestor.', cards: s.mecanismos.map(id => mecs[id]).filter(Boolean).slice(0, 4).map(m => ({ t: m.curto || m.nome, d: primeiraFrase(m.encaixeCiquanta) })) });
  sl.push({ tipo: 'cards', titulo: 'Como o setor participa da agenda', lead: `Parceiros prioritários: ${s.parceiros}`, cards: comum.participacao, cores: ['azul', '', 'marinho', ''] });
  if (s.dados) sl[sl.length - 1].lead += ` ${s.dados}`;
  sl.push({ tipo: 'riscos' });
  sl.push({ tipo: 'cronograma' });
  sl.push({ tipo: 'encerramento', titulo: 'Pesquisa aplicada com linha de base clássica, resultado aberto e dados sob jurisdição brasileira.' });
  return sl;
}

export async function buildDeck(id) {
  const [set, inst, mec] = await Promise.all([load('setores'), load('institucional'), load('mecanismos')]);
  const mecs = Object.fromEntries(mec.itens.map(m => [m.id, m]));
  let titulo, slides, fonte;
  if (id === 'institucional') { titulo = 'CIQUANTA: apresentação institucional'; slides = inst.slides; fonte = inst.fonte; }
  else {
    const s = set.itens.find(x => x.id === id && x.deck) || set.itens.find(x => x.id === (set.itens.find(y => y.id === id)?.deckId));
    if (!s) throw new Error('Apresentação não encontrada.');
    titulo = `CIQUANTA: agenda para ${s.ref || s.nome.toLowerCase()}`; slides = setorSlides(s, set.comum, mecs);
    fonte = s.oficial ? 'Agenda CIQUANTA para o Sistema Financeiro, v2 (SECTIES-PB)' : 'Agenda setorial CIQUANTA, construída no mesmo formato da agenda oficial do sistema financeiro';
  }
  const total = slides.length;
  const html = slides.map((s, i) => {
    const r = T[s.tipo]?.(s, set.comum);
    if (!r) return '';
    const escuro = /s-escuro|s-capa/.test(r.cls);
    const showFoot = !['capa', 'encerramento', 'foto'].includes(s.tipo);
    return `<section class="slide ${r.cls}" data-i="${i}">${r.inner}${showFoot ? foot(i + 1, total, escuro) : ''}</section>`;
  });
  return { id, titulo, fonte, slides: html };
}

// ---------- Visualização
function fit(stage) {
  const sl = stage.querySelector('.slide'); if (!sl) return;
  const k = stage.clientWidth / 1280; sl.style.transform = `scale(${k})`;
}

export function mountViewer(el, deck, { start = 0, onChange } = {}) {
  let i = Math.min(start, deck.slides.length - 1);
  el.innerHTML = `<div class="deck-viewer"><div class="deck-stage"></div>
    <div class="deck-bar"><button class="btn sm" data-a="prev" aria-label="Slide anterior">‹</button><span class="pg"></span><button class="btn sm" data-a="next" aria-label="Próximo slide">›</button>
    <span style="flex:1"></span><button class="btn sm" data-a="full">Tela cheia</button><button class="btn sm" data-a="print">PDF / imprimir</button></div></div>`;
  const stage = el.querySelector('.deck-stage');
  const show = () => { stage.innerHTML = deck.slides[i]; fit(stage); el.querySelector('.pg').textContent = `${i + 1} / ${deck.slides.length}`; onChange?.(i); };
  el.querySelector('.deck-bar').onclick = ev => {
    const a = ev.target.closest('[data-a]')?.dataset.a; if (!a) return;
    if (a === 'prev') { i = Math.max(0, i - 1); show(); }
    if (a === 'next') { i = Math.min(deck.slides.length - 1, i + 1); show(); }
    if (a === 'full') present(deck, i);
    if (a === 'print') printDeck(deck);
  };
  const ro = new ResizeObserver(() => fit(stage)); ro.observe(stage);
  const key = ev => { if (document.querySelector('.deck-full') || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return; if (ev.key === 'ArrowRight') { i = Math.min(deck.slides.length - 1, i + 1); show(); } if (ev.key === 'ArrowLeft') { i = Math.max(0, i - 1); show(); } };
  document.addEventListener('keydown', key);
  show();
  return () => { ro.disconnect(); document.removeEventListener('keydown', key); };
}

export function present(deck, start = 0) {
  let i = start;
  const ov = document.createElement('div');
  ov.className = 'deck-full'; ov.innerHTML = '<div class="deck-stage"></div><div class="hint">← → navegar · Esc sair</div>';
  document.body.appendChild(ov);
  const stage = ov.querySelector('.deck-stage');
  const show = () => { stage.innerHTML = deck.slides[i]; fit(stage); };
  const close = () => { ov.remove(); document.removeEventListener('keydown', key); window.removeEventListener('resize', show); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); };
  const key = ev => {
    if (ev.key === 'Escape') close();
    if (['ArrowRight', 'PageDown', ' '].includes(ev.key)) { ev.preventDefault(); i = Math.min(deck.slides.length - 1, i + 1); show(); }
    if (['ArrowLeft', 'PageUp'].includes(ev.key)) { ev.preventDefault(); i = Math.max(0, i - 1); show(); }
  };
  ov.addEventListener('click', ev => { if (ev.clientX > innerWidth / 2) i = Math.min(deck.slides.length - 1, i + 1); else i = Math.max(0, i - 1); show(); });
  document.addEventListener('keydown', key); window.addEventListener('resize', show);
  ov.requestFullscreen?.().catch(() => {});
  show();
}

export function printDeck(deck) {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${e(deck.titulo)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${A('css/deck.css')}"><style>body{margin:0;background:#fff}.print-deck .slide{page-break-after:always;break-after:page}</style></head>
  <body class="print-deck">${deck.slides.join('')}<script>document.fonts.ready.then(()=>setTimeout(()=>print(),500))<\/script></body></html>`;
  const w = window.open('', '_blank');
  if (!w) { alert('Permita janelas pop-up para gerar o PDF.'); return; }
  w.document.open(); w.document.write(html); w.document.close();
}
