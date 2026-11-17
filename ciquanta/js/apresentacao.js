// Visualizador público de apresentações: apresentacao.html?d=<setor>&s=<página>
import { buildDeck, mountViewer } from './deck.js';
const p = new URLSearchParams(location.search);
const id = p.get('d') || 'institucional';
try {
  const deck = await buildDeck(id);
  document.title = deck.titulo;
  document.getElementById('titulo').textContent = deck.titulo;
  document.getElementById('fonte').textContent = 'Fonte: ' + deck.fonte;
  mountViewer(document.getElementById('viewer'), deck, { start: Math.max(0, (+p.get('s') || 1) - 1) });
} catch (err) {
  document.getElementById('titulo').textContent = 'Apresentação não encontrada';
}
