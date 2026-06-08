// Service worker for cloud version — caches HF model files after first download.
const CACHE = "tagarela-cloud-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Cache-first for Hugging Face model files; network-pass-through for everything else.
self.addEventListener("fetch", (event) => {
  const url = event.request.url;
  const isModel =
    url.includes("huggingface.co") ||
    url.includes("cdn-lfs") ||
    url.includes(".onnx") ||
    url.includes("tokenizer") ||
    url.includes("config.json");

  if (isModel) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const resp = await fetch(event.request);
        if (resp.ok) cache.put(event.request, resp.clone());
        return resp;
      })
    );
  }
});
