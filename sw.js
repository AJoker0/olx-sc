const CACHE = 'sc-cache-v1';
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './assets/icons.svg',
  './assets/Vector.png',
  './assets/Vector(1).png',
  './assets/Group.png',
  './assets/Frame.png',
  './assets/bin.png',
  './assets/Layer 92.png',
  './assets/number.png',
  './assets/calendar.png',
  './assets/settings.png',
  './assets/house.png',
  './assets/ring.png',
  './assets/person.png',
  './manifest.webmanifest'
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});

self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>k!==CACHE && caches.delete(k)))));
});

self.addEventListener('fetch', e=>{
  const { request } = e;
  if (request.method !== 'GET') return;
  e.respondWith(
    caches.match(request).then(cached => 
      cached || fetch(request).then(resp=>{
        const clone = resp.clone();
        caches.open(CACHE).then(c=>c.put(request, clone));
        return resp;
      }).catch(()=>cached)
    )
  );
});
