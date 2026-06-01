import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";
import type { AnalysisResponse, ProviderConfig } from "./types";

export interface StreamProgress {
  delta: string;
  total: string;
  chars: number;
}

export interface AnalyseArgs {
  config: ProviderConfig;
  fileName: string;
  numPages: number;
  truncated: boolean;
  guessedPart: string | null;
  text: string;
  signal?: AbortSignal;
  /**
   * Called as the model streams output. The same callback fires for both
   * Puter and OpenAI-compatible providers, so the UI doesn't have to care
   * which backend is running.
   */
  onProgress?: (p: StreamProgress) => void;
}

export async function analyseDatasheet(args: AnalyseArgs): Promise<AnalysisResponse> {
  if (args.config.provider === "puter") {
    return analyseViaPuter(args);
  }
  return analyseViaOpenAICompatible(args);
}

/* ------------------------------------------------------------------------- */
/* OpenAI-compatible HTTP path (OpenAI, OpenRouter, Ollama, Groq, …)         */
/* ------------------------------------------------------------------------- */

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
    stream: true,
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
    Accept: "text/event-stream",
  };
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

  // Some local servers ignore `stream: true` and return a regular JSON body
  // instead of an SSE stream. Detect and fall back gracefully.
  const contentType = res.headers.get("content-type") || "";
  const isSSE = contentType.includes("event-stream") && !!res.body;
  if (!isSSE) {
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data?.choices?.[0]?.message?.content ?? "";
    if (!content) throw new Error("LLM returned an empty response.");
    args.onProgress?.({ delta: content, total: content, chars: content.length });
    return parseJsonLenient(content);
  }

  const total = await consumeOpenAISSE(res, args.onProgress, args.signal);
  if (!total) throw new Error("LLM returned an empty response.");
  return parseJsonLenient(total);
}

async function consumeOpenAISSE(
  res: Response,
  onProgress: ((p: StreamProgress) => void) | undefined,
  signal: AbortSignal | undefined,
): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let total = "";

  try {
    while (true) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE events end with a blank line; split on newlines and keep the
      // last (potentially incomplete) line in `buffer`.
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const obj = JSON.parse(payload) as {
            choices?: { delta?: { content?: string } }[];
          };
          const delta = obj?.choices?.[0]?.delta?.content;
          if (delta) {
            total += delta;
            onProgress?.({ delta, total, chars: total.length });
          }
        } catch {
          // Partial chunk — wait for more data.
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* ignore */
    }
  }

  return total;
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

  const chatPromise = puterApi.chat(messages, false, {
    model: args.config.model,
    temperature: 0.2,
    stream: true,
    response_format: { type: "json_object" },
  });

  const result = await raceAbort(chatPromise, args.signal);

  let total = "";
  if (isAsyncIterable<PuterStreamChunk>(result)) {
    for await (const part of result) {
      if (args.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const chunk = extractStreamChunkText(part);
      if (chunk) {
        total += chunk;
        args.onProgress?.({ delta: chunk, total, chars: total.length });
      }
    }
  } else {
    // Puter ignored stream: true and returned a complete response.
    total = extractPuterText(result as PuterChatResponse);
    if (total) {
      args.onProgress?.({ delta: total, total, chars: total.length });
    }
  }

  if (!total) throw new Error("Puter returned an empty response.");
  return parseJsonLenient(total);
}

function extractStreamChunkText(part: PuterStreamChunk | unknown): string {
  if (!part || typeof part !== "object") return "";
  const p = part as PuterStreamChunk & { delta?: { content?: string } };
  if (typeof p.text === "string") return p.text;
  if (p.delta && typeof p.delta.content === "string") return p.delta.content;
  return "";
}

function extractPuterText(resp: PuterChatResponse): string {
  const c = resp?.message?.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) {
    return c
      .map((part) => (part && typeof part === "object" && "text" in part ? part.text ?? "" : ""))
      .join("");
  }
  try {
    return String(resp);
  } catch {
    return "";
  }
}

function isAsyncIterable<T>(x: unknown): x is AsyncIterable<T> {
  return !!x && typeof (x as { [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator] === "function";
}

/**
 * Puter loads asynchronously via <script defer> in index.html. Poll briefly
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
