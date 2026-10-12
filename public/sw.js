// Cache only public offline UI and brand icons. Never cache HTML routes,
// tokens, API responses, submissions, audio/video, reports or room data.
const CACHE = 'sharpai-public-52d49b5ec522'
const PUBLIC = ['/offline.html','/icons/app-192.png','/icons/app-512.png','/icons/app-180.png','/icons/app.svg']
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PUBLIC)))
  // No skipWaiting: new versions must not interrupt an active interview.
})
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('sharpai-public-') && k !== CACHE).map(k => caches.delete(k)))))
  // No clients.claim: take control on the next navigation, not mid-session.
})
self.addEventListener('fetch', event => {
  const req=event.request, url=new URL(req.url)
  if(req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return
  if(req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(async () => (await caches.open(CACHE)).match('/offline.html')))
    return
  }
  if(PUBLIC.includes(url.pathname) && !url.search) event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(req)) || fetch(req)))
})
