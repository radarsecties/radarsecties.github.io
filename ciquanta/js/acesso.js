// Acesso ao CRM: quem não tem sessão neste computador entra com um código de uso único
// enviado pela ponte ao próprio e-mail do CIQUANTA. Nada do CRM é aberto antes disso.
import { cfg, setConfig, descartar } from './store.js';
import * as G from './google.js';
import { esc } from './util.js';

/** Endereço da ponte conhecido por este computador: link da equipe, configuração local ou data/acesso.json publicado. */
async function enderecoDaPonte() {
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  const doLink = q.get('ponte');
  if (doLink) { setConfig({ ponteUrl: G.normalizarPonte(doLink) }); history.replaceState(null, '', location.pathname + '#/painel'); }
  if (cfg().ponteUrl) return cfg().ponteUrl;
  try { const g = localStorage.getItem('ciq-ponte'); if (g) return g; } catch {}
  try {
    const r = await fetch('data/acesso.json', { cache: 'no-cache' });
    if (r.ok) { const j = await r.json(); if (j.ponte) return G.normalizarPonte(j.ponte); }
  } catch {}
  return '';
}

/** Nome sugerido para este computador, mostrado na lista de acessos e no e-mail do código. */
function nomeDoComputador() {
  const ua = navigator.userAgent;
  const nav = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Navegador';
  const so = /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iPhone' : /Linux/.test(ua) ? 'Linux' : '';
  return [nav, so].filter(Boolean).join(' no ');
}

/**
 * Decide se o CRM pode abrir. Com chave ou sessão neste computador, abre. Com uma ponte conhecida e sem
 * sessão, mostra a tela de entrada. Sem ponte nenhuma (instalação ainda não feita), abre para configurar.
 */
export async function liberado() {
  const url = await enderecoDaPonte();
  if (G.temAcesso()) return true;
  if (!url) return true;
  mostrarEntrada(url);
  return false;
}

export function mostrarEntrada(url = cfg().ponteUrl) {
  if (document.querySelector('.porta')) return;
  document.body.classList.add('bloqueado');
  const el = document.createElement('main');
  el.className = 'porta';
  el.innerHTML = `<div class="entrada-cx">
    <div class="marca"><img class="claro" src="assets/logo-marinho.png" alt="CIQUANTA" width="118" height="12"><img class="escuro" src="assets/logo-branco.png" alt="" width="118" height="12" aria-hidden="true"><span class="crm">CRM</span></div>
    <div class="kicker">Acesso restrito</div>
    <h1>Entrar</h1>
    <form id="e-pedir" class="passo-e">
      <p>O código de acesso vai para o e-mail do CIQUANTA.</p>
      <label class="field">Nome deste computador<input type="text" name="disp" value="${esc(nomeDoComputador())}" maxlength="60" required></label>
      <button class="btn primary">Enviar código</button>
    </form>
    <form id="e-entrar" class="passo-e hidden">
      <p id="e-para"></p>
      <label class="field">Código<input type="text" name="cod" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]{6,7}" maxlength="7" placeholder="000000" required></label>
      <button class="btn primary">Entrar</button>
      <button type="button" class="btn ghost" id="e-novo">Enviar outro código</button>
    </form>
    <p class="erro" role="alert"></p>
  </div>`;
  document.body.appendChild(el);
  const erro = el.querySelector('.erro'), pedir = el.querySelector('#e-pedir'), entrar = el.querySelector('#e-entrar');
  let disp = '';
  const ocupado = (f, sim) => f.querySelectorAll('button').forEach(b => { b.disabled = sim; });
  pedir.onsubmit = async ev => {
    ev.preventDefault(); erro.textContent = ''; disp = pedir.disp.value.trim(); ocupado(pedir, true);
    try {
      const r = await G.pedirCodigo(url, disp);
      el.querySelector('#e-para').textContent = `Enviamos um código para ${r.para}. Ele vale por 10 minutos.`;
      pedir.classList.add('hidden'); entrar.classList.remove('hidden'); entrar.cod.focus();
    } catch (e) { erro.textContent = e.message; }
    ocupado(pedir, false);
  };
  entrar.onsubmit = async ev => {
    ev.preventDefault(); erro.textContent = ''; ocupado(entrar, true);
    try { await G.entrarComCodigo(url, entrar.cod.value, disp); location.hash = '#/painel'; location.reload(); return; }
    catch (e) { erro.textContent = e.message; entrar.cod.select(); }
    ocupado(entrar, false);
  };
  el.querySelector('#e-novo').onclick = () => { entrar.classList.add('hidden'); pedir.classList.remove('hidden'); entrar.cod.value = ''; erro.textContent = ''; };
  setTimeout(() => pedir.disp.focus(), 50);
}

/** Apaga deste computador os dados do CRM (para computadores compartilhados). A base compartilhada no Drive continua. */
export async function apagarDadosLocais() {
  const ponte = cfg().ponteUrl;
  descartar();
  Object.keys(localStorage).filter(k => k.startsWith('ciquanta')).forEach(k => localStorage.removeItem(k));
  try { indexedDB.deleteDatabase('ciquanta-arquivos'); } catch {}
  try { (await caches.keys()).forEach(k => caches.delete(k)); } catch {}
  // Fica só o endereço da ponte, que não é segredo, para a próxima pessoa ver a tela de entrada
  try { if (ponte) localStorage.setItem('ciq-ponte', ponte); } catch {}
}
