// Tagarela — Cloudflare Workers AI translation endpoint
// Deploy this to Cloudflare Workers (workers.cloudflare.com)
// Bind an AI resource named "AI" in your Worker settings.

const NLLB_CODES = {
  "en":"eng_Latn","es":"spa_Latn","fr":"fra_Latn","de":"deu_Latn",
  "it":"ita_Latn","pt":"por_Latn","pt-PT":"por_Latn","nl":"nld_Latn",
  "ru":"rus_Cyrl","uk":"ukr_Cyrl","pl":"pol_Latn","sv":"swe_Latn",
  "da":"dan_Latn","no":"nob_Latn","fi":"fin_Latn","cs":"ces_Latn",
  "el":"ell_Grek","tr":"tur_Latn","ja":"jpn_Jpan","ko":"kor_Hang",
  "zh-CN":"zho_Hans","zh-TW":"zho_Hant","th":"tha_Thai","vi":"vie_Latn",
  "id":"ind_Latn","hi":"hin_Deva","ar":"arb_Arab","he":"heb_Hebr",
  "fa":"pes_Arab","ro":"ron_Latn","hu":"hun_Latn","bg":"bul_Cyrl",
  "sk":"slk_Latn","hr":"hrv_Latn","ca":"cat_Latn","sw":"swh_Latn",
  "ms":"zsm_Latn","tl":"tgl_Latn",
};

const LANG_NAMES = {
  "en":"English","es":"Spanish","fr":"French","de":"German","it":"Italian",
  "pt":"Portuguese","nl":"Dutch","ru":"Russian","uk":"Ukrainian","pl":"Polish",
  "sv":"Swedish","da":"Danish","no":"Norwegian","fi":"Finnish","cs":"Czech",
  "el":"Greek","tr":"Turkish","ja":"Japanese","ko":"Korean","zh-CN":"Chinese (Simplified)",
  "zh-TW":"Chinese (Traditional)","th":"Thai","vi":"Vietnamese","id":"Indonesian",
  "hi":"Hindi","ar":"Arabic","he":"Hebrew","fa":"Persian","ro":"Romanian",
  "hu":"Hungarian","bg":"Bulgarian","sk":"Slovak","hr":"Croatian","ca":"Catalan",
  "sw":"Swahili","ms":"Malay","tl":"Filipino",
};

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors() },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: cors() });
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

    const { text, source, target, model } = body;
    if (!text || !source || !target || !model) return json({ error: "Missing fields" }, 400);

    try {
      if (model === "nllb") {
        const src = NLLB_CODES[source] || "eng_Latn";
        const tgt = NLLB_CODES[target] || "eng_Latn";
        if (src === tgt) return json({ text, confidence: 1 });

        const result = await env.AI.run("@cf/facebook/nllb-200-distilled-600M", {
          text,
          source_lang: src,
          target_lang: tgt,
        });
        return json({ text: result.translated_text, confidence: 0.82 });
      }

      if (model === "mistral") {
        const srcName = LANG_NAMES[source] || source;
        const tgtName = LANG_NAMES[target] || target;
        if (source === target) return json({ text, confidence: 1 });

        const result = await env.AI.run("@cf/mistral/mistral-7b-instruct-v0.1", {
          messages: [
            {
              role: "system",
              content: `You are a professional translator. Translate the following text from ${srcName} to ${tgtName}. Reply with ONLY the translation — no explanations, no notes, no quotes.`,
            },
            { role: "user", content: text },
          ],
          max_tokens: 1024,
        });
        const translated = result.response?.trim() || text;
        return json({ text: translated, confidence: 0.78 });
      }

      return json({ error: "Unknown model. Use 'nllb' or 'mistral'." }, 400);
    } catch (e) {
      return json({ error: e.message || "Worker error" }, 500);
    }
  },
};
