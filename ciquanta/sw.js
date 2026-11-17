// Funcionamento sem conexão: a rede vem sempre primeiro; a cópia guardada só é usada quando não há internet.
// Assim, toda atualização publicada chega na próxima abertura, sem versões presas em cache.
const CACHE = 'ciquanta-crm-v7';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
));

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  // Chamadas ao Google (Gmail, Agenda, Drive, Planilhas) e a outros serviços nunca passam pelo cache
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(req, { cache: 'no-cache' }).then(res => {
      if (res.ok) { const copia = res.clone(); caches.open(CACHE).then(c => c.put(req, copia)).catch(() => {}); }
      return res;
    }).catch(async () => (await caches.match(req)) || (req.mode === 'navigate' && await caches.match('./')) || Response.error())
  );
});
