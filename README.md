# 📄 AI Datasheet Analyzer

A web app that turns any electronic component datasheet (PDF) into a concise,
structured engineering summary — written from the point of view of an experienced
electronics engineer focused on **risk**, **bring-up**, and **design watch-outs**.

It adapts the output to the component type — IC, sensor, power device, connector,
module, equipment, etc. — rather than forcing a fixed template.

## ✨ Features

- **Zero-setup default (Puter.js)** — out of the box, the app runs through
  [Puter.js](https://docs.puter.com/AI/chat/). No API key, no server, nothing
  to configure. The first analysis prompts the end user to sign in to a free
  Puter account; new users get free credits and only pay for what they use
  after that. The app itself is never billed.
- **Local / private mode (Ollama)** — dedicated one-click preset for
  [Ollama](https://ollama.com). Runs entirely on your machine, no key, no
  network calls to a third party. Bring your own model (`qwen2.5:14b-instruct`,
  `llama3.3`, etc.).
- **Bring-your-own-key fallback** — switch to OpenAI, OpenRouter, or any
  other OpenAI-compatible `/chat/completions` endpoint (Groq, Together, vLLM,
  LM Studio, Gemini's OpenAI shim, etc.). Key is stored only in
  `localStorage`.
- **Local PDF parsing** — datasheets are parsed in the browser with
  [`pdfjs-dist`](https://github.com/mozilla/pdfjs-dist). The file never leaves
  your machine; only extracted text is sent to the model.
- **Adaptive sections** — irrelevant sections (e.g. pinout for a connector,
  electrical curves for a passive part) are automatically omitted, and the
  model can add component-specific extra sections.
- **Risk-first** — the *Risks, Caveats & Design Watch-outs* and *Decision
  Summary* sections are always present, with explicit red flags.
- **Exports** — copy/download the structured result as Markdown or JSON.
- **No backend** — pure static SPA.

## 🧱 Output structure

The model produces JSON that the UI renders into nine adaptive sections:

1. Component Identification
2. Absolute Maximum Ratings *(if applicable)*
3. Recommended Operating Conditions *(if applicable)*
4. Electrical / Performance Characteristics *(if applicable)*
5. Pinout / Interface / Connections *(if applicable)*
6. Recommended Circuits / Application Notes *(if applicable)*
7. Risks, Caveats & Design Watch-outs *(always present)*
8. Alternatives & Cross-References *(if known)*
9. Summary for Decision-Makers *(always present, with pros / cons / red flags)*

Any sections that don't fit the part are omitted; the model can also add
custom "extra sections" for component-specific concerns (e.g. *Calibration*
for a sensor, *Safety / Isolation* for a SMPS, *Mating / IP rating* for a
connector).

## 🚀 Quick start

```bash
npm install
npm run dev
```

Then open <http://localhost:5173>, drop a PDF, and click **Analyse**. That's it.

The first call via Puter will open Puter's sign-in popup. Once you're signed
in, future calls are silent.

### 🔁 Switching providers

Open **Settings** to switch from Puter to another provider:

| Provider       | Key needed? | Suggested model                                          | Notes                                                                 |
| -------------- | ----------- | -------------------------------------------------------- | --------------------------------------------------------------------- |
| **Puter**      | No          | `claude-sonnet-4-5`, `gpt-5.4-nano`, `gemini-2.5-flash`  | Keyless, user-pays via Puter account.                                 |
| **Ollama**     | No          | `qwen2.5:14b-instruct`, `llama3.3`                       | 100% local. Requires CORS to be enabled — see below.                  |
| OpenAI         | Yes         | `gpt-4o-mini` or `gpt-4o`                                | Bring your own key.                                                   |
| OpenRouter     | Yes         | `anthropic/claude-3.5-sonnet`                            | One key, hundreds of models incl. free-tier ones.                     |
| Custom         | Yes         | Any OpenAI-compatible model                              | Groq, Together, vLLM, LM Studio, Gemini's OpenAI shim, etc.           |

For the BYOK providers the model should ideally support JSON mode
(`response_format: json_object`). Puter routes to underlying vendors that may
or may not honour JSON mode, so the prompt also instructs the model directly
to emit a single JSON object — and the parser will recover the JSON out of
prose if needed.

### 🦙 Using Ollama (local, free, private)

1. Install Ollama from <https://ollama.com> and pull a capable model:

   ```bash
   ollama pull qwen2.5:14b-instruct
   ```

   For structured datasheet extraction, instruction-tuned models in the 14B+
   range work best. Smaller models (3–8B) often skip required JSON fields.
   Tested-good picks: `qwen2.5:14b-instruct`, `qwen2.5:32b-instruct`,
   `llama3.3`, `gemma2:27b-instruct`, `phi4`.

2. **Enable CORS so the browser app can call Ollama.** Ollama only accepts
   browser requests from origins listed in the `OLLAMA_ORIGINS` env var. Set
   it *before* starting Ollama:

   | OS                 | How to set it                                                                                          |
   | ------------------ | ------------------------------------------------------------------------------------------------------ |
   | macOS              | `launchctl setenv OLLAMA_ORIGINS "*"` then quit and reopen the Ollama menu-bar app.                    |
   | Linux (systemd)    | `sudo systemctl edit ollama.service`, add `Environment="OLLAMA_ORIGINS=*"`, then `systemctl restart ollama`. |
   | Windows            | Add a System environment variable `OLLAMA_ORIGINS=*` (Settings → System → About → Advanced → Environment Variables), then restart Ollama. |

   For tighter security, instead of `*` use the exact dev origin, e.g.
   `OLLAMA_ORIGINS=http://localhost:5173,http://localhost:4173`.

3. In the app, open **Settings → Ollama (local)**, confirm the base URL
   (default `http://localhost:11434/v1`), pick your model, and Save.

   The app will surface targeted error messages if Ollama isn't running
   ("Could not reach Ollama…") or if the requested model isn't pulled yet
   ("Ollama returned 404 — the model is probably not pulled yet").

### 🏗️ Build for production

```bash
npm run build
npm run preview
```

The output in `dist/` is a fully static SPA that you can host on any static
file host (GitHub Pages, Netlify, S3, Cloudflare Pages, etc.).

## 🔐 Privacy

- PDFs are parsed locally in your browser.
- This app has no backend. Extracted text is sent **directly** from your
  browser to whichever provider you've selected:
  - **Puter mode**: text goes to Puter's API, which routes to the chosen model
    vendor (OpenAI, Anthropic, Google, etc.). See Puter's privacy policy for
    their handling.
  - **BYOK mode**: text and your API key go directly to the endpoint you
    configured; the key is stored only in `localStorage`.

## ⚠️ Limits

- Very large datasheets (often 200+ pages) are truncated to roughly 180 000
  characters before being sent to the model. The UI flags when this happens
  and the model is instructed to record assumptions made because of truncation.
- Scanned / image-only PDFs will not extract any text. Run OCR first or use a
  text-based datasheet.
- The quality of the summary depends heavily on the model. For safety-critical
  decisions, always cross-check against the original datasheet.

## 🧰 Tech stack

- Vite + React 18 + TypeScript
- Tailwind CSS
- `pdfjs-dist` for client-side PDF text extraction
- `react-markdown` + `remark-gfm` for inline markdown in bullets
- [Puter.js v2](https://docs.puter.com/AI/chat/) for keyless model access
- OpenAI-compatible chat completions API with JSON mode (BYOK fallback)

## 👤 Author

Created and maintained by **Arshia Keshvari** (`@TeslaNeuro`).

## 📜 License

**[`MIT`](./LICENSE)**
