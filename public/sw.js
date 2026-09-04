// AXON-AI — service worker minimal.
// Rôle : rendre l'app éligible à l'installation (PWA) et offrir une page de
// secours hors-ligne. L'app est un SaaS temps réel (Supabase, Meta,
// LinkedIn…) : on NE met PAS en cache les pages/API applicatives, seulement
// l'app shell statique nécessaire à l'écran hors-ligne.
const CACHE = "axon-shell-v1";
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Réseau d'abord pour toute navigation : ne sert le cache que si le réseau
// est indisponible (hors-ligne réel), jamais pour servir des données périmées.
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(OFFLINE_URL))
  );
});
