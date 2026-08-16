/**
 * AI Datasheet Analyzer
 * Author: Arshia Keshvari (@TeslaNeuro)
 * License: MIT
 *
 * Vite client ambient types plus module declarations for pdf.js worker
 * URL imports used by the PDF extractor.
 */
/// <reference types="vite/client" />

declare module "*?url" {
  const src: string;
  export default src;
}

declare module "pdfjs-dist/build/pdf.worker.min.mjs?url" {
  const src: string;
  export default src;
}
