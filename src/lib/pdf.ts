/**
 * AI Datasheet Analyzer
 * Author: Arshia Keshvari (@TeslaNeuro)
 * License: MIT
 *
 * Client-side PDF text extraction via pdf.js. Files never leave the
 * browser; only the extracted text is later sent to the chosen model.
 * Also provides SHA-256 hashing for the IndexedDB cache and a best-effort
 * part-number guess from early pages.
 */

// We deliberately use structural types for the pdfjs surface we touch
// instead of importing the deep types — pdfjs-dist's d.ts paths have
// shifted between minor versions and a structural shape is enough for
// the few methods we call.
interface PdfPage {
  getTextContent(): Promise<{ items: Array<{ str?: string; hasEOL?: boolean }> }>;
}
interface PdfDocument {
  numPages: number;
  getPage(i: number): Promise<PdfPage>;
  cleanup(): Promise<void> | void;
  destroy(): Promise<void> | void;
}

export interface ExtractedPage {
  page: number;
  text: string;
}

export interface ExtractedDocument {
  numPages: number;
  pages: ExtractedPage[];
  fullText: string;
  truncated: boolean;
  charLimit: number;
}

const DEFAULT_CHAR_LIMIT = 180_000;

/**
 * How many pages to decode in parallel. PDF.js runs decoding in a Web
 * Worker, so the bottleneck is page-data fetching + text-content shaping
 * — both of which benefit from a small amount of concurrency. Going much
 * higher than 6 produces diminishing returns and risks contention with
 * the main thread on huge datasheets.
 */
const PAGE_CONCURRENCY = 6;

/**
 * Safari (until 26.4) lacks ReadableStream async iteration, which modern
 * pdf.js uses inside getTextContent(). Without this polyfill Safari throws
 * "undefined is not a function (near '...value of readableStream...')".
 */
function polyfillReadableStreamAsyncIterator(): void {
  if (
    typeof ReadableStream === "undefined" ||
    ReadableStream.prototype[Symbol.asyncIterator]
  ) {
    return;
  }
ReadableStream.prototype[Symbol.asyncIterator] = async function* (
    this: ReadableStream,
  ): AsyncGenerator<unknown, undefined, unknown> {
    const reader = this.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) return undefined;
        yield value;
      }
    } finally {
      reader.releaseLock();
    }
  };
}

// Lazy-loaded pdfjs handle. Importing pdfjs eagerly pulls ~1 MB into the
// initial bundle even before the user drops a file; loading it on demand
// makes the app paint faster and lets Vite code-split it into its own
// chunk.
let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;
function loadPdfjs(): Promise<typeof import("pdfjs-dist")> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      polyfillReadableStreamAsyncIterator();
      const [pdfjsLib, workerUrl] = await Promise.all([
        import("pdfjs-dist"),
        import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
      ]);
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl.default;
      return pdfjsLib;
    })();
  }
  return pdfjsPromise;
}

/**
 * Render a single PDF page to a normalised text string. We use the
 * structural hints pdfjs gives us (`hasEOL`) instead of forcing a space
 * between every micro-item — datasheets often emit one item per
 * character, so the naive `items.map(...).join(" ")` inflates text by
 * 10–25 % and breaks word boundaries.
 */
async function renderPageText(page: PdfPage): Promise<string> {
  const content = await page.getTextContent();
  let out = "";

  for (const it of content.items) {
    const str = typeof it.str === "string" ? it.str : "";
    if (str) {
      // Insert a single space between adjacent items unless the previous
      // chunk already ended with whitespace or punctuation that doesn't
      // need one.
      if (out && !/[\s\-/(]$/.test(out) && !/^[\s.,;:)\]]/.test(str)) {
        out += " ";
      }
      out += str;
    }
    if (it.hasEOL) {
      out += "\n";
    }
  }

  return out
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface ExtractOptions {
  charLimit?: number;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
  /** Pre-computed buffer to avoid reading the File twice when callers also hash it. */
  buffer?: ArrayBuffer;
}

/**
 * Extract text from a PDF file in parallel pages. Stops early once the
 * cumulative text exceeds `charLimit`, then performs a single
 * deterministic concat with byte budgeting.
 */
export async function extractPdfText(
  file: File,
  opts: ExtractOptions = {},
): Promise<ExtractedDocument> {
  const charLimit = opts.charLimit ?? DEFAULT_CHAR_LIMIT;
  const pdfjsLib = await loadPdfjs();
  const buf = opts.buffer ?? (await file.arrayBuffer());

  const pdf = (await pdfjsLib.getDocument({ data: buf }).promise) as unknown as PdfDocument;
  const numPages = pdf.numPages;

  const pages: (ExtractedPage | undefined)[] = new Array(numPages);
  let done = 0;
  let cumulative = 0;
  let stopAfter = numPages; // pages beyond this index are skipped

  // Worker that pulls the next page index off a shared counter — gives us
  // a balanced workload even when pages have very different sizes.
  let next = 1;
  async function worker() {
    while (true) {
      if (opts.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const i = next++;
      if (i > stopAfter) return;
      const page = await pdf.getPage(i);
      const text = await renderPageText(page);
      pages[i - 1] = { page: i, text };
      cumulative += text.length + 16; // +16 for the page header
      done++;
      opts.onProgress?.(done, numPages);
      if (cumulative >= charLimit) {
        // Don't pull pages beyond what we can fit. Already-in-flight
        // pages will still complete, but no new ones will start.
        if (i < stopAfter) stopAfter = i;
      }
    }
  }

  const concurrency = Math.min(PAGE_CONCURRENCY, numPages);
  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  // Free the underlying PDF resources as soon as we're done — datasheets
  // can be 10–30 MB.
  try {
    await pdf.cleanup();
    await pdf.destroy();
  } catch {
    /* ignore */
  }

  // Reassemble in page order, only including pages we actually got.
  const ordered: ExtractedPage[] = [];
  for (const p of pages) if (p) ordered.push(p);

  // Single-pass concat with a hard byte budget so we never allocate a
  // 2× over-budget intermediate string.
  const parts: string[] = [];
  let used = 0;
  let truncated = ordered.length < numPages;
  for (const p of ordered) {
    const sep = parts.length === 0 ? "" : "\n\n";
    const header = `--- Page ${p.page} ---\n`;
    const overhead = sep.length + header.length;
    const remaining = charLimit - used - overhead;
    if (remaining <= 100) {
      truncated = true;
      break;
    }
    const text = p.text.length > remaining ? p.text.slice(0, remaining) : p.text;
    parts.push(sep + header + text);
    used += overhead + text.length;
    if (text.length < p.text.length) {
      truncated = true;
      break;
    }
  }

  let fullText = parts.join("");
  if (truncated) fullText += "\n\n[...truncated for length...]";

  return { numPages, pages: ordered, fullText, truncated, charLimit };
}

/** Try to detect a part number from the first ~2 pages of the datasheet. */
export function guessPartNumber(doc: ExtractedDocument): string | null {
  const head = doc.pages
    .slice(0, 2)
    .map((p) => p.text)
    .join("\n");

  const patterns: RegExp[] = [
    /\b(?:Part\s*(?:Number|No\.?|#)\s*[:\-]?\s*)([A-Z0-9][A-Z0-9\-\/]{2,})/i,
    /\b([A-Z]{2,5}\d{2,5}[A-Z0-9\-]{0,8})\b/,
    /\b([A-Z]+\-?\d{3,6}[A-Z0-9\-]*)\b/,
  ];

  for (const re of patterns) {
    const m = head.match(re);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

/**
 * SHA-256 of the raw file bytes, hex-encoded. Used as a stable cache key
 * so repeated uploads of the same datasheet are instantaneous.
 */
export async function hashFile(file: File): Promise<{ hash: string; buffer: ArrayBuffer }> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return { hash: hex, buffer };
}
