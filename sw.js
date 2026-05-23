var CACHE_NAME = 'party-tool-v1';
var ASSETS = [
  '/party-tool/',
  '/party-tool/index.html',
  '/party-tool/manifest.json',
  '/party-tool/icon.svg'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ASSETS);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) {
        return k !== CACHE_NAME;
      }).map(function(k) {
        return caches.delete(k);
      }));
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(e) {
  // Don't cache API calls to jsonbin.io
  if (e.request.url.indexOf('api.jsonbin.io') !== -1) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then(function(cached) {
      // Return cached response immediately, then update cache in background
      var fetched = fetch(e.request).then(function(response) {
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(e.request, clone);
          });
        }
        return response;
      }).catch(function() {
        return cached;
      });

      return cached || fetched;
    })
  );
});
