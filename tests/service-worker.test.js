// Ejecutar con: node --test tests/service-worker.test.js
// Carga el service worker en un entorno simulado (caché y red falsas) y comprueba su comportamiento.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SOURCE = fs.readFileSync(path.join(__dirname, "../app/static/js/service-worker.js"), "utf8");
const PRECACHE = ["/static/css/base.css", "/static/js/modo-local.js", "/", "/configurar", "/roles", "/offline", "/datos/palabras.json"];

class FakeResponse {
    constructor(body, { ok = true, type = "basic" } = {}) {
        Object.assign(this, { body, ok, type });
    }
    clone() {
        return new FakeResponse(this.body, this);
    }
}

class FakeRequest {
    constructor(url, init = {}) {
        this.url = new URL(url, "http://sospecha.test").href;
        this.method = init.method || "GET";
        this.mode = init.mode || "no-cors";
    }
}

function createWorker() {
    const stores = new Map();
    const handlers = {};
    const network = { online: true, hang: false, requested: [] };
    const state = { skipped: false };

    function openStore(name) {
        if (!stores.has(name)) stores.set(name, new Map());
        return stores.get(name);
    }
    const keyOf = (request, ignoreSearch) => {
        const url = new URL(typeof request === "string" ? request : request.url, "http://sospecha.test");
        return ignoreSearch ? url.origin + url.pathname : url.href;
    };
    const fakeCaches = {
        async open(name) {
            const store = openStore(name);
            return {
                async addAll(requests) {
                    for (const request of requests) store.set(keyOf(request), await fakeFetch(request));
                },
                async put(request, response) { store.set(keyOf(request), response); },
                async match(request, options = {}) {
                    if (!options.ignoreSearch) return store.get(keyOf(request));
                    const wanted = keyOf(request, true);
                    return [...store].find(([key]) => key.split("?")[0] === wanted)?.[1];
                },
                async keys() { return [...store.keys()]; }
            };
        },
        async keys() { return [...stores.keys()]; },
        async delete(name) { return stores.delete(name); },
        async match(request) {
            for (const store of stores.values()) if (store.has(keyOf(request))) return store.get(keyOf(request));
            return undefined;
        }
    };
    async function fakeFetch(request) {
        network.requested.push(request.url);
        if (network.hang) return new Promise(() => {});
        if (!network.online) throw new TypeError("Failed to fetch");
        return new FakeResponse(`red:${new URL(request.url).pathname}`, { type: new URL(request.url).hostname.includes("gstatic") ? "opaque" : "basic" });
    }

    const self = {
        location: { origin: "http://sospecha.test" },
        addEventListener: (type, handler) => { handlers[type] = handler; },
        skipWaiting: () => { state.skipped = true; },
        clients: { claim: async () => {} }
    };
    const fastTimeout = (callback, milliseconds) => setTimeout(callback, milliseconds / 100);
    const header = `const CACHE_VERSION = "t1"; const PRECACHE_URLS = ${JSON.stringify(PRECACHE)}; const OFFLINE_URL = "/offline";\n`;
    vm.runInNewContext(header + SOURCE, {
        self, caches: fakeCaches, fetch: fakeFetch, Request: FakeRequest, URL, Promise,
        setTimeout: fastTimeout, clearTimeout
    });

    async function dispatch(type, request) {
        const event = { request, waitUntil(promise) { this.pending = promise; }, respondWith(promise) { this.response = promise; } };
        handlers[type](event);
        if (event.pending) await event.pending;
        return { intercepted: event.response !== undefined, response: event.response && (await event.response) };
    }
    return { stores, network, state, dispatch, openStore };
}

const navigate = (url) => new FakeRequest(url, { mode: "navigate" });

test("al instalar guarda todos los archivos de la lista", async () => {
    const worker = createWorker();
    await worker.dispatch("install");
    assert.deepEqual([...worker.openStore("sospecha-t1").keys()].map(key => new URL(key).pathname), PRECACHE);
    assert.equal(worker.state.skipped, true);
});

test("con red, las páginas vienen del servidor y se actualizan en la caché", async () => {
    const worker = createWorker();
    await worker.dispatch("install");
    const { response } = await worker.dispatch("fetch", navigate("/configurar"));
    assert.equal(response.body, "red:/configurar");
    assert.equal(worker.openStore("sospecha-t1").get("http://sospecha.test/configurar").body, "red:/configurar");
});

test("sin red, las pantallas del modo local salen de la caché", async () => {
    const worker = createWorker();
    await worker.dispatch("install");
    worker.network.online = false;
    for (const page of ["/", "/configurar", "/roles"]) {
        const { response } = await worker.dispatch("fetch", navigate(page));
        assert.equal(response.body, `red:${page}`);
    }
});

test("sin red, una sala o una página desconocida muestran /offline", async () => {
    const worker = createWorker();
    await worker.dispatch("install");
    worker.network.online = false;
    for (const page of ["/sala/ABCD", "/sala/nueva", "/no-existe"]) {
        const { response } = await worker.dispatch("fetch", navigate(page));
        assert.equal(response.body, "red:/offline", page);
    }
});

test("el estado en vivo de las salas nunca se intercepta ni se guarda", async () => {
    const worker = createWorker();
    await worker.dispatch("install");
    const estado = await worker.dispatch("fetch", new FakeRequest("/sala/ABCD/estado"));
    const accion = await worker.dispatch("fetch", new FakeRequest("/sala/ABCD/accion", { method: "POST" }));
    assert.equal(estado.intercepted, false);
    assert.equal(accion.intercepted, false);
    const saved = [...worker.openStore("sospecha-t1").keys()].map(key => new URL(key).pathname);
    assert.ok(!saved.some(pathname => pathname.startsWith("/sala/")));
    assert.ok(!worker.network.requested.some(url => url.includes("/sala/")));
});

test("la sala navegada con red no se guarda en la caché", async () => {
    const worker = createWorker();
    await worker.dispatch("install");
    await worker.dispatch("fetch", navigate("/sala/ABCD"));
    assert.ok(![...worker.openStore("sospecha-t1").keys()].some(key => key.includes("/sala/")));
});

test("los archivos estáticos se sirven primero de la caché", async () => {
    const worker = createWorker();
    await worker.dispatch("install");
    worker.network.requested.length = 0;
    worker.network.online = false;
    const { response } = await worker.dispatch("fetch", new FakeRequest("/static/js/modo-local.js"));
    assert.equal(response.body, "red:/static/js/modo-local.js");
    assert.deepEqual(worker.network.requested, []);
});

test("las palabras se sirven de la caché y se refrescan desde la red", async () => {
    const worker = createWorker();
    await worker.dispatch("install");
    worker.openStore("sospecha-t1").set("http://sospecha.test/datos/palabras.json", new FakeResponse("viejo"));
    const { response } = await worker.dispatch("fetch", new FakeRequest("/datos/palabras.json"));
    assert.equal(response.body, "viejo");
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(worker.openStore("sospecha-t1").get("http://sospecha.test/datos/palabras.json").body, "red:/datos/palabras.json");
});

test("si la red no responde a tiempo, la página sale de la caché", async () => {
    const worker = createWorker();
    await worker.dispatch("install");
    worker.network.hang = true;
    const { response } = await worker.dispatch("fetch", navigate("/roles"));
    assert.equal(response.body, "red:/roles");
});

test("las fuentes de Google se guardan aparte para usarlas sin conexión", async () => {
    const worker = createWorker();
    await worker.dispatch("install");
    const font = new FakeRequest("https://fonts.gstatic.com/s/outfit.woff2");
    await worker.dispatch("fetch", font);
    worker.network.online = false;
    const { response } = await worker.dispatch("fetch", font);
    assert.equal(response.body, "red:/s/outfit.woff2");
    assert.equal(worker.openStore("sospecha-fuentes").size, 1);
});

test("otras peticiones externas y los POST no se tocan", async () => {
    const worker = createWorker();
    await worker.dispatch("install");
    assert.equal((await worker.dispatch("fetch", new FakeRequest("https://ejemplo.com/a.js"))).intercepted, false);
    assert.equal((await worker.dispatch("fetch", new FakeRequest("/configurar", { method: "POST" }))).intercepted, false);
});

test("al activar borra las cachés viejas pero conserva las fuentes", async () => {
    const worker = createWorker();
    worker.openStore("sospecha-t0").set("x", new FakeResponse("viejo"));
    worker.openStore("sospecha-fuentes").set("y", new FakeResponse("fuente"));
    await worker.dispatch("install");
    await worker.dispatch("activate");
    assert.deepEqual([...worker.stores.keys()].sort(), ["sospecha-fuentes", "sospecha-t1"]);
});
