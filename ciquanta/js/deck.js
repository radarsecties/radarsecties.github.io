// Motor de apresentações do CIQUANTA.
import { mostrarDocumento } from './util.js';
// Institucional: slides oficiais (imagens das páginas do PDF). Setoriais: gerados no mesmo template a partir de data/setores.json.
const BASE = new URL('../', import.meta.url).href;
const A = p => BASE + p;
const e = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ul = arr => `<ul>${(arr || []).map(x => `<li>${e(x)}</li>`).join('')}</ul>`;
const NOME = 'Centro Internacional de Computação e Tecnologias Quânticas do Estado da Paraíba';
const SITE = 'ciquanta.secties.pb.gov.br';
const n2 = i => String(i + 1).padStart(2, '0');
// Primeira frase, sem cortar em abreviações como "art." ou "nº."
function primeiraFrase(t = '') {
  const re = /\.\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/g; let m;
  while ((m = re.exec(t))) { const antes = t.slice(Math.max(0, m.index - 5), m.index).toLowerCase().trim().split(/\s/).pop(); if (!/(art|nº|ex|inc|sr|sra)$/.test(antes)) return t.slice(0, m.index + 1); }
  return t;
}

const cache = {};
const load = n => (cache[n] ||= fetch(A(`data/${n}.json`), { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error('Falha ao carregar ' + n); return r.json(); }));

export const deckUrl = id => A(`apresentacao.html?d=${encodeURIComponent(id)}`);

export async function listDecks() {
  const [set, inst] = await Promise.all([load('setores'), load('institucional')]);
  return [
    { id: 'institucional', titulo: 'Apresentação institucional', sub: 'Apresentação oficial do CIQUANTA: projeto em números, mercado quântico global, sede, hardware, cooperação Brasil–China, roadmap, aplicações e equipe.', slides: inst.paginas.length, oficial: true, capa: A(inst.pasta + '01.jpg') },
    ...set.itens.filter(s => s.deck).map(s => ({ id: s.id, titulo: `Agenda para ${s.ref || s.nome.toLowerCase()}`, sub: s.resumo, slides: 10 + s.linhas.length, setor: s, oficial: !!s.oficial })),
  ];
}

const foot = (n) => `<div class="s-foot"><span>${n}</span><img src="${A('assets/secties-govpb.png')}" alt="SECTIES, Governo da Paraíba"></div>`;
const head = (t, lead, k) => `${k ? `<div class="s-kicker">${e(k)}</div>` : ''}<h2>${e(t)}</h2>${lead ? `<p class="s-lead">${e(lead)}</p>` : ''}`;

const T = {
  capa: s => ({ cls: 's-capa', nofoot: 1, inner: `<div class="esq"><img class="gov" src="${A('assets/secties-govpb.png')}" alt="SECTIES, Governo da Paraíba"><img class="logo" src="${A('assets/logo-azul.png')}" alt="CIQUANTA">
    <div class="s-kicker k">${e(s.tag)}</div><div class="t">${e(s.titulo)}</div><div class="sub">${e(s.sub)}</div></div><div class="foto" style="background-image:url('${A('assets/img/criostato.jpg')}')"></div>` }),
  stats: s => ({ inner: `<div class="s-pad">${head(s.titulo, s.lead)}<div class="s-body"><div class="s-stats ${s.itens.length === 4 ? 'c4' : s.itens.length === 2 ? 'c2' : ''}">${s.itens.map(n => `<div class="s-stat"><b>${e(n.n)}</b><span>${e(n.d)}</span>${n.f ? `<small>Fonte: ${e(n.f)}</small>` : ''}</div>`).join('')}</div></div></div>` }),
  lista: s => ({ inner: `<div class="s-split"><div class="painel">${head(s.titulo, s.lead, s.kicker)}</div><div class="conteudo"><div class="s-num">${s.itens.map((it, i) => `<div class="it"><div class="n">${n2(i)}</div><div><div class="tt">${e(it.t)}</div>${it.d ? `<div class="dd">${e(it.d)}</div>` : ''}</div>${it.v ? `<div class="v">${e(it.v)}</div>` : '<div></div>'}</div>`).join('')}</div></div></div>` }),
  pilares: s => ({ inner: `<div class="s-pad">${head(s.titulo, s.lead)}<div class="s-body"><div class="s-cards ${s.cards.length === 4 ? 'c4' : s.cards.length === 2 ? 'c2' : ''}">${s.cards.map((c, i) => `<div class="s-card ${i === 0 ? 'azul' : ''}">${c.k ? `<div class="k">${e(c.k)}</div>` : ''}<h4>${e(c.t)}</h4><p>${e(c.d)}</p></div>`).join('')}</div></div></div>` }),
  dominios: s => ({ inner: `<div class="s-pad"><div class="s-faixa">${head(s.titulo, s.lead, s.kicker)}</div><div class="s-body"><div class="s-dom ${s.itens.length === 3 ? 'c3' : s.itens.length >= 5 ? 'c5' : ''}">${s.itens.map((it, i) => `<div><div class="n">${n2(i)}</div><h4>${e(it.t)}</h4><p>${e(it.d)}</p></div>`).join('')}</div></div></div>` }),
  setores: s => ({ inner: `<div class="s-pad">${head(s.titulo, s.lead)}<div class="s-body"><div class="s-set">${s.itens.map(it => `<div><h4>${e(it.t)}</h4><p>${e(it.d)}</p></div>`).join('')}</div></div></div>` }),
  maquinas: () => ({ inner: `<div class="s-pad">${head('Duas máquinas, dois papéis')}<div class="s-body"><div class="s-maq">
      <div></div><div class="cab azul"><b>GJQ-100</b><span>Principal ativo de pesquisa, dedicado às cargas de fronteira.</span></div><div class="cab"><b>GJQ-20</b><span>Formação, testes e desenvolvimento de algoritmos.</span></div>
      ${[['Qubits', '100', '20', 1], ['Acopladores sintonizáveis', '≥ 180', '≥ 19'], ['Refrigerador de diluição', 'XS1000', 'XS400'], ['Tempo de resfriamento', '≤ 36 h', '≤ 30 h'], ['Coerência T₁ / T₂', '50 μs / 30 μs', '30 μs / 20 μs']].map(r => `<div class="r l ${r[3] ? 'g' : ''}">${r[0]}</div><div class="r ${r[3] ? 'g' : ''}">${r[1]}</div><div class="r ${r[3] ? 'g' : ''}">${r[2]}</div>`).join('')}
    </div><p class="s-lead" style="font-size:17px"><b style="color:#14224A">Fidelidade comum às duas:</b> 1 qubit ≥ 99%, 2 qubits ≥ 99% e leitura ≥ 95%. Datacenter clássico integrado e acesso remoto pela plataforma em nuvem do Hub Nacional de Experimentação Quântica.</p></div></div>` }),
  linha: s => ({ inner: `<div class="s-pad" style="gap:18px">${head(s.l.nome, '', s.kicker)}
    <div class="s-q"><small>Pergunta central</small>${e(s.l.pergunta)}</div>
    <div class="s-3"><div><h5>Clássico</h5>${ul(s.l.classico)}</div><div><h5>Híbrido</h5>${ul(s.l.hibrido)}</div><div><h5>Quântico</h5>${ul(s.l.quantico)}</div></div>
    <div class="s-ei"><div><b>Entregas</b>${e(s.l.entregas)}</div><div><b>Indicadores</b>${e(s.l.indicadores)}</div></div></div>` }),
  passos: (s, c) => ({ inner: `<div class="s-pad">${head('Como a agenda mede vantagem', c.metodoLead)}<div class="s-body"><div class="s-steps">${c.medicao.map((m, i) => `<div class="s-step"><i>${n2(i)}</i><b>${e(m.t)}</b><span>${e(m.d)}</span></div>`).join('')}</div><div class="s-gate">${e(c.portao)}</div></div></div>` }),
  riscos: (s, c) => ({ inner: `<div class="s-pad">${head('Riscos e como a agenda responde')}<div class="s-body"><table class="s-table"><thead><tr><th>Risco</th><th>Resposta</th></tr></thead><tbody>${c.riscos.map(r => `<tr><td>${e(r[0])}</td><td>${e(r[1])}</td></tr>`).join('')}</tbody></table></div></div>` }),
  roadmap: (s, c) => ({ inner: `<div class="s-pad">${head('Roadmap de implantação e da agenda')}<div class="s-body"><div class="s-road">${c.cronograma.map((t, i) => `<div class="col ${i === 0 ? 'atual' : ''}"><div class="ano"><b>${e(t.ano)}</b><span>${e(t.fase)}</span></div><div class="trilho"></div>${ul(t.itens)}</div>`).join('')}</div></div></div>` }),
  fim: s => ({ cls: 's-fim', nofoot: 1, inner: `<img class="logo" src="${A('assets/logo-azul.png')}" alt="CIQUANTA"><div class="nome">${e(s.titulo || NOME)}</div><div class="site">${SITE}</div><div class="regua"></div><img class="parc" src="${A('assets/parceiros-marinho.png')}" alt="CETC, Ministério da Ciência, Tecnologia e Inovação, Governo do Brasil, SECTIES e Governo da Paraíba">` }),
};

function setorSlides(s, c, mecs) {
  const sl = [];
  sl.push({ tipo: 'capa', tag: 'Agenda de pesquisa aplicada', titulo: s.nome, sub: s.resumo });
  if (s.contexto?.length >= 2) sl.push({ tipo: 'stats', titulo: 'O setor em números', itens: s.contexto.slice(0, 6) });
  sl.push({ tipo: 'lista', titulo: 'Onde o setor encontra limites de cálculo', lead: s.resumo, itens: s.desafios.slice(0, 4).map(d => ({ t: d })) });
  sl.push({ tipo: 'maquinas' });
  sl.push({ tipo: 'pilares', titulo: 'Clássico e quântico na mesma agenda', lead: c.metodoLead, cards: c.metodo.map(m => ({ t: m.t, d: m.d })) });
  sl.push({ tipo: 'dominios', titulo: `Agenda para ${s.ref || s.nome.toLowerCase()}`, lead: `${s.linhas.length} linhas de pesquisa sobre uma infraestrutura híbrida quântico-clássica.`, itens: s.linhas.map(l => ({ t: l.nome, d: l.sub })) });
  s.linhas.forEach((l, i) => sl.push({ tipo: 'linha', kicker: `Linha ${i + 1} de ${s.linhas.length}`, l }));
  sl.push({ tipo: 'passos' });
  sl.push({ tipo: 'setores', titulo: 'Como financiar os projetos', lead: 'Instrumentos aplicáveis ao setor. Percentuais e condições devem ser confirmados no texto legal e com o órgão gestor.', itens: s.mecanismos.map(id => mecs[id]).filter(Boolean).slice(0, 4).map(m => ({ t: m.curto || m.nome, d: primeiraFrase(m.encaixeCiquanta) })) });
  sl.push({ tipo: 'lista', titulo: 'Como o setor participa da agenda', lead: `Parceiros prioritários: ${s.parceiros} ${s.dados || ''}`, itens: c.participacao.map(p => ({ t: p.t, d: p.d })) });
  sl.push({ tipo: 'riscos' });
  sl.push({ tipo: 'roadmap' });
  sl.push({ tipo: 'fim' });
  return sl;
}

export async function buildDeck(id) {
  const [set, inst, mec] = await Promise.all([load('setores'), load('institucional'), load('mecanismos')]);
  if (id === 'institucional') {
    return { id, titulo: inst.titulo, fonte: inst.fonte, pdf: A(inst.pdf), oficial: true,
      slides: inst.paginas.map((alt, i) => `<section class="slide s-img" data-i="${i}"><img src="${A(inst.pasta + n2(i) + '.jpg')}" alt="${e(alt)}"></section>`) };
  }
  const mecs = Object.fromEntries(mec.itens.map(m => [m.id, m]));
  const s = set.itens.find(x => x.id === id && x.deck) || set.itens.find(x => x.id === (set.itens.find(y => y.id === id)?.deckId));
  if (!s) throw new Error('Apresentação não encontrada.');
  const slides = setorSlides(s, set.comum, mecs);
  return { id: s.id, titulo: `CIQUANTA: agenda para ${s.ref || s.nome.toLowerCase()}`,
    fonte: s.oficial ? 'Agenda CIQUANTA para o Sistema Financeiro, v2, e Apresentação Institucional (SECTIES-PB, 2026)' : 'Agenda setorial no formato da agenda oficial do sistema financeiro; dados do centro conforme a Apresentação Institucional (SECTIES-PB, 2026)',
    slides: slides.map((sd, i) => { const r = T[sd.tipo](sd, set.comum); return `<section class="slide ${r.cls || ''}" data-i="${i}">${r.inner}${r.nofoot ? '' : foot(i + 1)}</section>`; }) };
}

// ---------- Visualização
function fit(stage) { const sl = stage.querySelector('.slide'); if (sl) sl.style.transform = `scale(${stage.clientWidth / 1280})`; }

/** Entrada do conteúdo do slide em sequência (o slide em si mantém a escala calculada por fit). */
function animarSlide(stage) { stage.classList.remove('anima'); void stage.offsetWidth; stage.classList.add('anima'); }

export function mountViewer(el, deck, { start = 0, onChange } = {}) {
  let i = Math.min(start, deck.slides.length - 1);
  el.innerHTML = `<div class="deck-viewer"><div class="deck-stage"></div>
    <div class="deck-bar"><button class="btn sm" data-a="prev" aria-label="Slide anterior">‹</button><span class="pg"></span><button class="btn sm" data-a="next" aria-label="Próximo slide">›</button>
    <span style="flex:1"></span><button class="btn sm" data-a="full">Tela cheia</button><button class="btn sm" data-a="print">${deck.pdf ? 'Baixar PDF' : 'Gerar PDF'}</button></div></div>`;
  const stage = el.querySelector('.deck-stage');
  const show = () => { stage.innerHTML = deck.slides[i]; fit(stage); animarSlide(stage); el.querySelector('.pg').textContent = `${i + 1} / ${deck.slides.length}`; onChange?.(i); };
  const go = d => { i = Math.max(0, Math.min(deck.slides.length - 1, i + d)); show(); };
  el.querySelector('.deck-bar').onclick = ev => {
    const a = ev.target.closest('[data-a]')?.dataset.a; if (!a) return;
    if (a === 'prev') go(-1); if (a === 'next') go(1);
    if (a === 'full') present(deck, i);
    if (a === 'print') printDeck(deck);
  };
  stage.addEventListener('click', ev => go(ev.offsetX > stage.clientWidth / 2 ? 1 : -1));
  const ro = new ResizeObserver(() => fit(stage)); ro.observe(stage);
  const key = ev => { if (document.querySelector('.deck-full, .modal-back') || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return; if (ev.key === 'ArrowRight') go(1); if (ev.key === 'ArrowLeft') go(-1); };
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
  const show = () => { stage.innerHTML = deck.slides[i]; fit(stage); animarSlide(stage); };
  const close = () => { ov.remove(); document.removeEventListener('keydown', key); window.removeEventListener('resize', show); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); };
  const key = ev => {
    if (ev.key === 'Escape') close();
    if (['ArrowRight', 'PageDown', ' '].includes(ev.key)) { ev.preventDefault(); i = Math.min(deck.slides.length - 1, i + 1); show(); }
    if (['ArrowLeft', 'PageUp'].includes(ev.key)) { ev.preventDefault(); i = Math.max(0, i - 1); show(); }
  };
  ov.addEventListener('click', ev => { i = ev.clientX > innerWidth / 2 ? Math.min(deck.slides.length - 1, i + 1) : Math.max(0, i - 1); show(); });
  document.addEventListener('keydown', key); window.addEventListener('resize', show);
  ov.requestFullscreen?.().catch(() => {});
  show();
}

export function printDeck(deck) {
  if (deck.pdf) { window.open(deck.pdf, '_blank', 'noopener'); return; }
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${e(deck.titulo)}</title>
  <link rel="stylesheet" href="${A('css/deck.css')}"><style>body{margin:0;background:#fff}.print-deck .slide{page-break-after:always;break-after:page}</style></head>
  <body class="print-deck">${deck.slides.join('')}</body></html>`;
  const w = window.open('', '_blank');
  if (!w) { alert('Permita janelas pop-up para gerar o PDF.'); return; }
  mostrarDocumento(w, html, { imprimir: true });
}
