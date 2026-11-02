/*
 * Service worker de Sospecha.
 * El servidor (app/routes/pwa.py) antepone CACHE_VERSION, PRECACHE_URLS y OFFLINE_URL:
 * al cambiar cualquier archivo cambia la versión y se descarta la caché anterior.
 */
const CACHE_NAME = `sospecha-${CACHE_VERSION}`;
const FONT_CACHE = "sospecha-fuentes";
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];
const NAVIGATION_TIMEOUT_MS = 4000;

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(PRECACHE_URLS.map(url => new Request(url, { cache: "reload" }))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys()
            .then(names => Promise.all(names.filter(name => name !== CACHE_NAME && name !== FONT_CACHE).map(name => caches.delete(name))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", event => {
    const request = event.request;
    if (request.method !== "GET") return;
    const url = new URL(request.url);

    if (FONT_HOSTS.includes(url.hostname)) {
        event.respondWith(cacheFirst(request, FONT_CACHE));
    } else if (url.origin !== self.location.origin) {
        return;
    } else if (url.pathname.startsWith("/sala/")) {
        // El estado en vivo de las salas (/estado, /accion) nunca pasa por la caché.
        if (request.mode === "navigate") event.respondWith(networkOrOffline(request));
    } else if (request.mode === "navigate") {
        event.respondWith(networkFirstPage(request));
    } else if (url.pathname.startsWith("/datos/")) {
        event.respondWith(staleWhileRevalidate(request));
    } else if (url.pathname.startsWith("/static/") || url.pathname === "/manifest.webmanifest") {
        event.respondWith(cacheFirst(request, CACHE_NAME));
    }
});

function isStorable(response) {
    return response && (response.ok || response.type === "opaque");
}

async function cacheFirst(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (isStorable(response)) cache.put(request, response.clone());
    return response;
}

async function staleWhileRevalidate(request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    const refresh = fetch(request).then(response => {
        if (response.ok) cache.put(request, response.clone());
        return response;
    });
    if (cached) {
        refresh.catch(() => null);
        return cached;
    }
    return refresh;
}

function fetchWithTimeout(request, milliseconds) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("timeout")), milliseconds);
        fetch(request).then(
            response => { clearTimeout(timer); resolve(response); },
            error => { clearTimeout(timer); reject(error); }
        );
    });
}

async function networkFirstPage(request) {
    const cache = await caches.open(CACHE_NAME);
    try {
        const response = await fetchWithTimeout(request, NAVIGATION_TIMEOUT_MS);
        if (response.ok) cache.put(request, response.clone());
        return response;
    } catch (error) {
        return (await cache.match(request, { ignoreSearch: true })) || (await cache.match(OFFLINE_URL));
    }
}

async function networkOrOffline(request) {
    try {
        return await fetch(request);
    } catch (error) {
        return caches.match(OFFLINE_URL);
    }
}
