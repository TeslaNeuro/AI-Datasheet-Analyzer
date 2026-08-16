/**
 * AI Datasheet Analyzer
 * Author: Arshia Keshvari (@TeslaNeuro)
 * License: MIT
 *
 * IndexedDB-backed cache. Two stores keyed by the SHA-256 hash of the
 * uploaded PDF:
 *
 *   - "extractions": parsed text per file (skip pdfjs entirely on hit)
 *   - "analyses":    LLM result per (hash, provider, model) tuple
 *
 * IndexedDB is used instead of localStorage because a single extracted
 * document can be 100–200 KB and a single analysis JSON can be 20–80 KB
 * — localStorage's 5 MB budget would fill up within ~30 datasheets and
 * triggers expensive synchronous serialisation on the main thread.
 */
import type { ExtractedDocument } from "./pdf";
import type { AnalysisResult } from "./types";

const DB_NAME = "datasheet-analyzer";
const DB_VERSION = 1;
const STORE_EXTRACTIONS = "extractions";
const STORE_ANALYSES = "analyses";

const MAX_EXTRACTIONS = 32;
const MAX_ANALYSES = 64;
const ANALYSIS_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface ExtractionRow {
  hash: string;
  doc: ExtractedDocument;
  ts: number;
}

interface AnalysisRow {
  key: string; // hash + "|" + provider + "|" + model
  hash: string;
  provider: string;
  model: string;
  result: AnalysisResult;
  meta: { fileName: string; numPages: number; truncated: boolean; elapsedMs: number };
  ts: number;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDB(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  if (typeof indexedDB === "undefined") {
    dbPromise = Promise.resolve(null);
    return dbPromise;
  }
  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_EXTRACTIONS)) {
        db.createObjectStore(STORE_EXTRACTIONS, { keyPath: "hash" });
      }
      if (!db.objectStoreNames.contains(STORE_ANALYSES)) {
        const store = db.createObjectStore(STORE_ANALYSES, { keyPath: "key" });
        store.createIndex("ts", "ts", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
  return dbPromise;
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<any> | Promise<T>,
): Promise<T | null> {
  return openDB().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) return resolve(null);
        try {
          const t = db.transaction(store, mode);
          const s = t.objectStore(store);
          const r = fn(s);
          if (r instanceof Promise) {
            r.then(resolve).catch(() => resolve(null));
            return;
          }
          r.onsuccess = () => resolve(r.result as T);
          r.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      }),
  );
}

export async function getCachedExtraction(hash: string): Promise<ExtractedDocument | null> {
  const row = await tx<ExtractionRow | undefined>(STORE_EXTRACTIONS, "readonly", (s) =>
    s.get(hash) as IDBRequest<ExtractionRow | undefined>,
  );
  return row?.doc ?? null;
}

export async function setCachedExtraction(hash: string, doc: ExtractedDocument): Promise<void> {
  await tx<unknown>(STORE_EXTRACTIONS, "readwrite", (s) => {
    s.put({ hash, doc, ts: Date.now() } as ExtractionRow);
    return s.count();
  });
  await trimStore(STORE_EXTRACTIONS, MAX_EXTRACTIONS);
}

function analysisKey(hash: string, provider: string, model: string): string {
  return `${hash}|${provider}|${model}`;
}

export async function getCachedAnalysis(
  hash: string,
  provider: string,
  model: string,
): Promise<AnalysisRow | null> {
  const key = analysisKey(hash, provider, model);
  const row = await tx<AnalysisRow | undefined>(STORE_ANALYSES, "readonly", (s) =>
    s.get(key) as IDBRequest<AnalysisRow | undefined>,
  );
  if (!row) return null;
  if (Date.now() - row.ts > ANALYSIS_TTL_MS) {
    void tx(STORE_ANALYSES, "readwrite", (s) => s.delete(key));
    return null;
  }
  return row;
}

export async function setCachedAnalysis(
  hash: string,
  provider: string,
  model: string,
  result: AnalysisResult,
  meta: { fileName: string; numPages: number; truncated: boolean; elapsedMs: number },
): Promise<void> {
  const row: AnalysisRow = {
    key: analysisKey(hash, provider, model),
    hash,
    provider,
    model,
    result,
    meta,
    ts: Date.now(),
  };
  await tx<unknown>(STORE_ANALYSES, "readwrite", (s) => s.put(row));
  await trimStore(STORE_ANALYSES, MAX_ANALYSES);
}

/**
 * Drop the oldest rows so the store stays under `keep`. Cheap LRU using
 * the `ts` field; runs occasionally so the cost is amortised.
 */
async function trimStore(store: string, keep: number): Promise<void> {
  const db = await openDB();
  if (!db) return;
  return new Promise<void>((resolve) => {
    try {
      const t = db.transaction(store, "readwrite");
      const s = t.objectStore(store);
      const countReq = s.count();
      countReq.onsuccess = () => {
        const count = countReq.result;
        if (count <= keep) return resolve();
        const toDrop = count - keep;
        const all: { key: IDBValidKey; ts: number }[] = [];
        const cur = s.openCursor();
        cur.onsuccess = () => {
          const c = cur.result;
          if (c) {
            const v = c.value as { ts?: number };
            all.push({ key: c.primaryKey, ts: v.ts ?? 0 });
            c.continue();
          } else {
            all.sort((a, b) => a.ts - b.ts);
            for (let i = 0; i < toDrop; i++) s.delete(all[i].key);
            resolve();
          }
        };
        cur.onerror = () => resolve();
      };
      countReq.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
