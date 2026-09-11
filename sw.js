/* Обслуживающий скрипт: делает сайт устанавливаемым на телефон
   и показывает уже виденные страницы без интернета.

   Правило простое: страницы берём из сети, но кладём копию в кэш.
   Нет сети — отдаём копию. Так гость в подвале без связи всё равно
   увидит меню и адрес, а при живой сети всегда получает свежее. */

const VERSION = 'molly-v1';
const SHELL = [
  './',
  './index.html',
  './afisha.html',
  './vecher.html',
  './foto.html',
  './style.css',
  './assistant.js',
  './images/logo.png',
  './images/icon-192.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(SHELL).catch(() => {/* если что-то не скачалось — не падаем */}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;       // чужое не трогаем
  if (url.pathname.includes('/data/')) return;           // справочник всегда свежий

  event.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
  );
});
