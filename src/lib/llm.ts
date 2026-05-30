import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";
import type { AnalysisResponse, ProviderConfig } from "./types";

export interface AnalyseArgs {
  config: ProviderConfig;
  fileName: string;
  numPages: number;
  truncated: boolean;
  guessedPart: string | null;
  text: string;
  signal?: AbortSignal;
}

export async function analyseDatasheet(args: AnalyseArgs): Promise<AnalysisResponse> {
  if (args.config.provider === "puter") {
    return analyseViaPuter(args);
  }
  return analyseViaOpenAICompatible(args);
}

/* ------------------------------------------------------------------------- */
/* OpenAI-compatible HTTP path (OpenAI, OpenRouter, Groq, Together, Ollama…) */
/* ------------------------------------------------------------------------- */

// Providers that work over the OpenAI-compatible /chat/completions wire
// format but do NOT require an API key (typically self-hosted local servers).
const KEYLESS_OPENAI_COMPAT: ReadonlySet<string> = new Set(["ollama"]);

async function analyseViaOpenAICompatible(args: AnalyseArgs): Promise<AnalysisResponse> {
  const { config } = args;
  if (!config.baseUrl) throw new Error("API base URL is required.");
  if (!config.model) throw new Error("Model is required.");

  const keyless = KEYLESS_OPENAI_COMPAT.has(config.provider);
  if (!keyless && !config.apiKey) {
    throw new Error("API key is required for this provider.");
  }

  const url = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const body = {
    model: config.model,
    temperature: 0.2,
    response_format: { type: "json_object" as const },
    messages: [
      { role: "system" as const, content: SYSTEM_PROMPT },
      {
        role: "user" as const,
        content: buildUserPrompt({
          fileName: args.fileName,
          numPages: args.numPages,
          truncated: args.truncated,
          guessedPart: args.guessedPart,
          text: args.text,
        }),
      },
    ],
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  // Send Authorization only if the user provided a key. Ollama accepts any
  // value (or none); sending no header avoids confusing local proxies.
  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }
  if (config.provider === "openrouter") {
    headers["HTTP-Referer"] = window.location.origin;
    headers["X-Title"] = "Datasheet Analyzer";
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: args.signal,
    });
  } catch (e) {
    // Network-level failure. Local Ollama users almost always hit this because
    // CORS isn't enabled — surface a targeted hint.
    if (config.provider === "ollama") {
      throw new Error(
        `Could not reach Ollama at ${config.baseUrl}. Check that Ollama is running and that CORS is enabled — set OLLAMA_ORIGINS to "*" (or this site's origin) and restart Ollama. Original error: ${(e as Error).message}`,
      );
    }
    throw e;
  }

  if (!res.ok) {
    const text = await safeReadText(res);
    if (config.provider === "ollama" && res.status === 404) {
      throw new Error(
        `Ollama returned 404 — the model "${config.model}" is probably not pulled yet. Run \`ollama pull ${config.model}\` and retry. ${text}`.trim(),
      );
    }
    throw new Error(
      `LLM request failed (${res.status} ${res.statusText}). ${text || ""}`.trim(),
    );
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM returned an empty response.");

  return parseJsonLenient(content);
}

/* ------------------------------------------------------------------------- */
/* Puter.js path — keyless, user-pays                                        */
/* ------------------------------------------------------------------------- */

const PUTER_JSON_REINFORCEMENT = `\n\nIMPORTANT: Respond with ONE valid JSON object only — no prose, no Markdown, no code fences. Begin your response with "{" and end it with "}".`;

async function analyseViaPuter(args: AnalyseArgs): Promise<AnalysisResponse> {
  const puterApi = await waitForPuter(args.signal);
  if (!args.config.model) throw new Error("Model is required.");

  const messages: PuterChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT + PUTER_JSON_REINFORCEMENT },
    {
      role: "user",
      content: buildUserPrompt({
        fileName: args.fileName,
        numPages: args.numPages,
        truncated: args.truncated,
        guessedPart: args.guessedPart,
        text: args.text,
      }),
    },
  ];

  // Race the Puter call against the abort signal — puter.ai.chat doesn't
  // accept an AbortSignal directly, so we simulate cancellation at the boundary.
  const chatPromise = puterApi.chat(messages, false, {
    model: args.config.model,
    temperature: 0.2,
    // Pass JSON mode through — Puter routes to underlying vendors that may honour it.
    response_format: { type: "json_object" },
  });

  const response = await raceAbort(chatPromise, args.signal);

  const content = extractPuterText(response);
  if (!content) throw new Error("Puter returned an empty response.");

  return parseJsonLenient(content);
}

function extractPuterText(resp: PuterChatResponse): string {
  const c = resp?.message?.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) {
    return c
      .map((part) => (part && typeof part === "object" && "text" in part ? part.text ?? "" : ""))
      .join("");
  }
  // Last-ditch: Puter responses have a .toString() that yields the text.
  try {
    return String(resp);
  } catch {
    return "";
  }
}

/**
 * Puter loads asynchronously via a <script defer> in index.html. Poll briefly
 * for it to become available so the first call doesn't race the script tag.
 */
async function waitForPuter(signal?: AbortSignal): Promise<PuterAi> {
  if (typeof window === "undefined") {
    throw new Error("Puter is only available in a browser environment.");
  }
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (typeof puter !== "undefined" && puter?.ai?.chat) return puter.ai;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(
    "Puter.js failed to load. Check your network connection, ad-blockers/CSP, or switch to a Bring-Your-Own-Key provider in Settings.",
  );
}

function raceAbort<T>(p: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return p;
  if (signal.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", onAbort, { once: true });
    p.then(
      (v) => {
        signal.removeEventListener("abort", onAbort);
        resolve(v);
      },
      (e) => {
        signal.removeEventListener("abort", onAbort);
        reject(e);
      },
    );
  });
}

/* ------------------------------------------------------------------------- */
/* Shared helpers                                                             */
/* ------------------------------------------------------------------------- */

async function safeReadText(res: Response): Promise<string> {
  try {
    const t = await res.text();
    return t.slice(0, 500);
  } catch {
    return "";
  }
}

function parseJsonLenient(content: string): AnalysisResponse {
  const cleaned = stripCodeFence(content).trim();
  try {
    return JSON.parse(cleaned) as AnalysisResponse;
  } catch {
    // Recover the largest JSON object in the response if the model wrapped it
    // in prose (more likely without strict JSON mode).
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first !== -1 && last > first) {
      try {
        return JSON.parse(cleaned.slice(first, last + 1)) as AnalysisResponse;
      } catch {
        /* fall through */
      }
    }
    throw new Error(
      "Failed to parse JSON from model. The model may not have followed instructions — try a more capable model.",
    );
  }
}

function stripCodeFence(s: string): string {
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fence ? fence[1] : s;
}
