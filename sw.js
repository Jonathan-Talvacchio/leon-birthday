/* Tiny offline cache so the party keeps going if the wifi drops.
   Bump CACHE_VERSION after any edit to force tablets to re-download.

   Everything here is best effort: if caching fails for any reason the
   app still works, it just loads from the network like a normal page. */

var CACHE_VERSION = "birthday-v2";

var FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.json",
  "./icon.svg",
  "./js/config.js",
  "./js/audio.js",
  "./js/confetti.js",
  "./js/balloons.js",
  "./js/game.js",
  "./js/main.js"
];

self.addEventListener("install", function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_VERSION).then(function (c) {
      /* cache each file on its own - one failure must not sink the rest */
      return Promise.all(FILES.map(function (url) {
        return c.add(url).catch(function () {});
      }));
    }).catch(function () {})
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE_VERSION ? null : caches.delete(k);
      }));
    }).catch(function () {}).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).catch(function () { return null; }).then(function (hit) {
      if (hit) return hit;
      return fetch(e.request).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE_VERSION)
            .then(function (c) { c.put(e.request, copy); })
            .catch(function () {});
        }
        return res;
      }).catch(function () {
        return caches.match("./index.html").catch(function () { return Response.error(); });
      });
    })
  );
});
