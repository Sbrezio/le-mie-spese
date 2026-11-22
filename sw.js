/* Service worker: tiene in memoria i file dell'app, così si apre anche senza rete.
   IMPORTANTE: a ogni pubblicazione su GitHub aumenta il numero di VERSIONE,
   altrimenti i telefoni continuano a usare i file vecchi. */
const VERSIONE = "spese-v5";
const FILE = [
  "./", "index.html", "style.css", "manifest.webmanifest",
  "js/calcoli.js", "js/dati.js", "js/app.js", "lib/chart.umd.min.js",
  "icons/icona-192.png", "icons/icona-512.png", "icons/icona-maskable-512.png", "icons/nuova-spesa-96.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSIONE).then(c => c.addAll(FILE)));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSIONE && k !== "spese-caratteri").map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

/* L'app chiede di passare alla versione nuova quando Denis tocca "Nuova versione disponibile" */
self.addEventListener("message", e => { if (e.data === "aggiorna") self.skipWaiting(); });

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return; // le richieste al ponte Google (POST) passano senza toccarle
  const url = new URL(req.url);

  // Caratteri da Google Fonts: copia in memoria, aggiornata quando c'è rete
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open("spese-caratteri").then(async c => {
      const hit = await c.match(req);
      const rete = fetch(req).then(r => { if (r.ok || r.type === "opaque") c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || rete;
    }));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // File dell'app: prima la copia in memoria (veloce e senza rete); index.html#nuova usa la stessa pagina
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).catch(() => caches.match("index.html"))));
});
