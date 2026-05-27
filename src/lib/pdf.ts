import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

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
 * Extract text from a PDF file. Preserves a per-page record so we can
 * cite page numbers and so we can intelligently truncate very long
 * datasheets (some are 200+ pages) while staying under LLM context limits.
 */
export async function extractPdfText(
  file: File,
  opts: { charLimit?: number; onProgress?: (done: number, total: number) => void } = {},
): Promise<ExtractedDocument> {
  const charLimit = opts.charLimit ?? DEFAULT_CHAR_LIMIT;
  const buf = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: buf });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const pages: ExtractedPage[] = [];

  let total = 0;
  let truncated = false;

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((it) => ("str" in it ? it.str : ""))
      .join(" ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    pages.push({ page: i, text });
    total += text.length;
    opts.onProgress?.(i, numPages);

    if (total > charLimit) {
      truncated = true;
      break;
    }
  }

  let fullText = pages
    .map((p) => `--- Page ${p.page} ---\n${p.text}`)
    .join("\n\n");

  if (fullText.length > charLimit) {
    fullText = fullText.slice(0, charLimit) + "\n\n[...truncated for length...]";
    truncated = true;
  }

  return { numPages, pages, fullText, truncated, charLimit };
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
