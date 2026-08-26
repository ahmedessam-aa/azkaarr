const CACHE_NAME = 'azkar-app-v2';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './prayer.js',
  './quran.js',
  './tasbih.js',
  './azkar.js',
  './notifications.js',
  './data-azkar.js',
  './data-hadith.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-192-maskable.png',
  './icon-512-maskable.png',
  './favicon.png',
  './icon-180.png'
];

self.addEventListener('install', (event)=>{
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).catch(()=>{})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event)=>{
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Cache-first for app shell, network-first for API/audio calls (prayer times / quran text / recitations / adhan)
self.addEventListener('fetch', (event)=>{
  const url = event.request.url;
  const isDynamic =
    url.includes('api.aladhan.com') ||
    url.includes('api.alquran.cloud') ||
    url.includes('nominatim.openstreetmap.org') ||
    url.includes('everyayah.com') ||
    url.includes('cdn.aladhan.com');

  if(isDynamic){
    event.respondWith(
      fetch(event.request).catch(()=> caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});

self.addEventListener('notificationclick', (event)=>{
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({type:'window'}).then(clientsArr=>{
      if(clientsArr.length > 0) return clientsArr[0].focus();
      return self.clients.openWindow('./index.html');
    })
  );
});
