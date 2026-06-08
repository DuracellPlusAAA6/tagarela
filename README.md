# Tagarela

A multi-language translator that runs entirely in the browser. Supports cloud-based and fully offline local translation, text-to-speech, drag-and-drop windows, and automatic language detection.

---

## How to Use

### Translating text

1. Type text in the source window and press **Enter** to translate.
2. **Shift+Enter** inserts a line break without triggering translation.
3. The source language can be set to **Auto** (detects as you type) or fixed to a specific language.
4. Each window can have multiple output language cards. Click **+ Add language** to add more targets.

### Source language detection

- When set to **Auto**, the detected language flag updates in real-time as you type.
- If you select a specific source language, that language is always used regardless of what text you paste.

### Adding and removing windows

- Click **+ Add window** in the header to open a new translation window.
- Each window is independent with its own source language and output cards.
- Drag windows by their title bar to reposition them.
- Close a window with the **×** button in its header.

### Swapping languages

- Each output card has a **swap** button (↕) next to the remove button.
- Clicking it makes that output language the new source, and moves the old source to the output.

### Choosing a translation model

Use the **model dropdown** in the header to switch providers:

| Option | Description |
|---|---|
| cloud · free (limited) | MyMemory free API. ~5000 characters/day. No setup required. |
| local · NLLB-200 | Fully offline. Runs the NLLB-200-distilled-600M model in-browser via WebAssembly. First use loads ~870 MB from local files. |
| cloud · Google | Google Translate API. Requires an API key (enter in the modal). |
| cloud · DeepL | DeepL API. Requires an API key (enter in the modal). |

### Text-to-speech (TTS)

- Click the **speaker icon** on any output card to hear the translation read aloud.
- Click the **Voices** button in the header to configure preferred voices per language.
- TTS uses the browser's built-in Web Speech API (local voices only).
- If no voice is detected for a language, a **Help** button appears with OS-specific instructions.

### NLLB-200 local model

- Select **local · NLLB-200** from the model dropdown.
- On first use, the model loads from the `models/nllb-200-distilled-600M/` folder (~870 MB). A progress bar shows loading status.
- Once loaded, all translations are processed locally with no internet required.
- Switching to another model unloads NLLB from memory. Switching back reloads it.
- The model session is **not** remembered across browser sessions (always defaults to cloud · free on reload).

---

## How to Start a Local Server

### Requirements

- [Git](https://git-scm.com/) with [Git LFS](https://git-lfs.com/) (for the large model files)
- Python 3 (usually pre-installed on Linux/macOS)

### Setup

```bash
# Install Git LFS (one-time)
# Ubuntu/Debian:
sudo apt install git-lfs

# macOS:
brew install git-lfs

# Windows: download installer from https://git-lfs.com

# Initialize LFS
git lfs install

# Clone the repository (this also downloads the ~870 MB NLLB model files)
git clone https://github.com/duracellplusaaa6/tagarela.git
cd tagarela

# Switch to the deployment branch
git checkout gh-pages
```

### Run

```bash
python3 -m http.server 8012
```

Open your browser and go to:

```
http://localhost:8012/index.html
```

To stop the server, press `Ctrl+C` in the terminal.

### Alternative servers

Any static file server works. For example:

```bash
# Node.js
npx serve .

# PHP
php -S localhost:8012
```

---

## Project Documentation

### Architecture

Tagarela is a **single HTML file** application. All JavaScript, CSS, fonts, and assets are embedded inside the HTML as base64-encoded, gzip-compressed bundles inside two `<script>` tags:

- `<script type="__bundler/manifest">` — JSON map of asset UUIDs to compressed content
- `<script type="__bundler/template">` — HTML template referencing the assets

A small bootstrapper in the HTML decompresses and injects assets at runtime. There is no build step, no npm, and no bundler required to run the app.

### Key files

| File | Description |
|---|---|
| `index.html` | The full application. Self-contained. |
| `index(1).html` | Development copy used for patching. Deployed as `index.html`. |
| `sw.js` | Service worker that caches NLLB model files for offline use. |
| `models/nllb-200-distilled-600M/` | Pre-downloaded NLLB model files served locally. |
| `.gitattributes` | Git LFS tracking rules for large ONNX and tokenizer files. |

### Source modules (embedded in bundle)

| UUID | File | Role |
|---|---|---|
| `6e68a4e5` | `app.jsx` | App root. State: boxes, model, voices, modals. Renders header and all TranslationBox instances. |
| `8062e2ba` | `box.jsx` | TranslationBox window, ResultRow output cards, useTTS hook. |
| `8d478060` | `data.jsx` | Language list, translation engines, NLLB loader, language detection. |
| `64350b76` | CSS | All application styles. |

### Inter-module communication

Modules run in isolated Babel scopes and share state via `window`:

```
window.LANGUAGES          — full language list
window.detectLang(text)   — heuristic language detection
window.translateOne(...)  — MyMemory cloud translation
window.translateNLLB(...)  — local NLLB-200 translation
window.destroyNLLB()      — unload NLLB pipeline from memory
window.nllbPct            — current NLLB load progress (0–100)
window.onNllbProgress(cb) — subscribe to NLLB load progress events
window.pickRandomLang(...) — random language picker
```

### Translation flow

1. User types in the source textarea and presses **Enter**.
2. The `inputDraft` local state is committed to `box.text` via `onChange`.
3. A `useEffect` in `TranslationBox` fires (deps: `[text, source, targets, over, rollSeq, model]`).
4. For each target language, a translation request is dispatched:
   - `"free"` → `window.translateOne()` → MyMemory API
   - `"nllb-local"` → `window.translateNLLB()` → in-browser NLLB pipeline
5. Results are stored in `results` state and rendered as `ResultRow` cards.

### NLLB local model

- **Library**: `@xenova/transformers@2.17.2` loaded via `<script type="module">` (bypasses Babel's CommonJS transform).
- **Model**: `Xenova/nllb-200-distilled-600M`, quantized ONNX, running on WebAssembly.
- **Files** (served from `models/nllb-200-distilled-600M/`):
  - `config.json`, `tokenizer_config.json`, `generation_config.json` — small config files
  - `tokenizer.json` — 17 MB (Git LFS)
  - `onnx/encoder_model_quantized.onnx` — 400 MB (Git LFS)
  - `onnx/decoder_model_merged_quantized.onnx` — 454 MB (Git LFS)
- `env.allowRemoteModels = false` ensures no external network requests are made.
- The service worker (`sw.js`) caches all model files on first load so subsequent loads are instant and fully offline.

### Language detection

`detectLang(text)` is a local heuristic with no network calls:
1. Identifies non-Latin scripts by Unicode range (Japanese, Korean, Chinese, Arabic, Hebrew, Thai, Hindi, Greek, Cyrillic).
2. For Latin-script languages, scores by diacritics and keyword frequency to distinguish common languages.

### State persistence

- `localStorage["tagarela.model"]` — last used model (cloud providers only; NLLB is never persisted)
- `localStorage["tagarela.voices"]` — per-language voice preferences
- `localStorage["tagarela.boxes"]` — window layout, source/target languages, and last text

### Deployment

The app is deployed to GitHub Pages from the `gh-pages` branch. The development branch is `claude/great-hamilton-bsaBU`. Changes are patched via Python scripts that decompress assets, apply string replacements, and recompress back into the bundle.

### Browser compatibility

- **Translation**: works in any modern browser (Chrome, Firefox, Safari, Edge).
- **NLLB local**: requires WebAssembly support and ~1 GB of available memory.
- **TTS**: requires Web Speech API. Voice availability varies by OS and browser.
- **Service worker**: requires HTTPS or `localhost`.
