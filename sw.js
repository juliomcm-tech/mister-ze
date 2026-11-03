/* Mister Zé · service worker
   - app (index.html) em «rede primeiro»: há versão nova → usa-a; sem rede → usa a guardada
   - ícones/manifesto guardados na instalação
   - leitor de prints (OCR) e tipos de letra guardados na 1.ª utilização → depois funcionam offline
   - resultados (ESPN) nunca são guardados aqui: vão sempre à rede
   - recebe partilhas do Android (prints e links) → abre o chat do Zé */
const VERSION = 'ze-v43b';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== 'ze-runtime' && k !== 'ze-share').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  // Partilha do Android → guarda os ficheiros e abre o chat
  if (req.method === 'POST' && url.pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      try {
        const fd = await req.formData();
        const cache = await caches.open('ze-share');
        let i = 0;
        for (const f of fd.getAll('files')) {
          if (f && f.size) await cache.put(new Request(`./shared/${i++}-${encodeURIComponent(f.name || 'print.png')}`), new Response(f, { headers: { 'Content-Type': f.type || 'image/png' } }));
        }
        const txt = ['title', 'text', 'url'].map(k => fd.get(k)).filter(Boolean).join(' ').trim();
        if (txt) await cache.put(new Request('./shared/text'), new Response(txt));
      } catch (err) { /* segue para a app na mesma */ }
      return Response.redirect('./?share=1#ze', 303);
    })());
    return;
  }
  if (req.method !== 'GET') return;

  // Resultados e dados ao vivo: sempre rede (nunca cache)
  if (/espn\.com|football-data\.org|corsproxy\.io|allorigins\.win|codetabs\.com|thingproxy|api\.github\.com/.test(url.hostname)) return;

  // A própria app: rede primeiro, cache como reserva
  if (req.mode === 'navigate' || (url.origin === self.location.origin && /\/(index\.html)?$/.test(url.pathname))) {
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put('./index.html', copy));
      return res;
    }).catch(() => caches.match('./index.html').then(r => r || caches.match('./'))));
    return;
  }

  // Ficheiros da app, tipos de letra e leitor de prints (OCR): cache primeiro
  if (url.origin === self.location.origin || /fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net|unpkg\.com|tessdata\.projectnaptha\.com/.test(url.hostname)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open('ze-runtime').then(c => c.put(req, copy)); }
      return res;
    })));
  }
});
