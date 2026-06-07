// Service worker — caches NLLB model assets for offline use.
// Only the model files are cached here; the main app is a single HTML file
// and caches itself via the browser's normal HTTP cache.

const CACHE = "tagarela-nllb-v1";

const MODEL_FILES = [
  "models/nllb/config.json",
  "models/nllb/tokenizer.json",
  "models/nllb/tokenizer_config.json",
  "models/nllb/generation_config.json",
  "models/nllb/onnx/encoder_model_quantized.onnx",
  "models/nllb/onnx/decoder_model_merged_quantized.onnx",
];

// On install: pre-cache model files relative to the SW scope
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => {
      // Cache each file; ignore failures so a missing file doesn't block install
      return Promise.allSettled(
        MODEL_FILES.map((f) =>
          cache.add(new Request(f, { cache: "no-store" })).catch(() => {})
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Remove old cache versions
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first for everything except the large ONNX files (cache-first)
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isModel = url.pathname.includes("/models/nllb/");

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
  // All other requests: fall through to network normally
});
