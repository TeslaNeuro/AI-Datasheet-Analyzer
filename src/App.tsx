import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dropzone } from "./components/Dropzone";
import { SettingsPanel } from "./components/SettingsPanel";
import { ResultsView } from "./components/ResultsView";
import { IconBolt, IconSettings, IconSpinner, IconWarn, IconX } from "./components/Icons";
import { extractPdfText, guessPartNumber, type ExtractedDocument } from "./lib/pdf";
import { analyseDatasheet } from "./lib/llm";
import { loadProviderConfig, saveProviderConfig } from "./lib/storage";
import { PROVIDER_PRESETS, type AnalysisError, type AnalysisResult, type ProviderConfig } from "./lib/types";

type Stage = "idle" | "extracting" | "analysing" | "done" | "error";

interface RunMeta {
  fileName: string;
  numPages: number;
  truncated: boolean;
  model: string;
}

export default function App() {
  const [config, setConfig] = useState<ProviderConfig>(() => loadProviderConfig());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [extracted, setExtracted] = useState<ExtractedDocument | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [meta, setMeta] = useState<RunMeta | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [notDatasheet, setNotDatasheet] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    saveProviderConfig(config);
  }, [config]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStage("idle");
    setProgress(null);
    setExtracted(null);
    setResult(null);
    setMeta(null);
    setErrorMsg(null);
    setNotDatasheet(null);
  }, []);

  const onFileChange = useCallback(
    (f: File | null) => {
      reset();
      setFile(f);
    },
    [reset],
  );

  const apiReady = useMemo(() => {
    if (!config.model) return false;
    const preset = PROVIDER_PRESETS[config.provider];
    if (!preset) return false;
    if (!preset.hideBaseUrl && !config.baseUrl) return false;
    if (!preset.keyless && !config.apiKey) return false;
    return true;
  }, [config]);

  const run = useCallback(async () => {
    if (!file) return;
    if (!apiReady) {
      setSettingsOpen(true);
      return;
    }
    setErrorMsg(null);
    setNotDatasheet(null);
    setResult(null);
    setMeta(null);
    setStage("extracting");
    setProgress(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const doc = await extractPdfText(file, {
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setExtracted(doc);

      if (!doc.fullText.trim() || doc.fullText.trim().length < 200) {
        setStage("error");
        setErrorMsg(
          "No extractable text found. The PDF may be scanned images — try a text-based datasheet, or run OCR first.",
        );
        return;
      }

      setStage("analysing");
      const guessed = guessPartNumber(doc);
      const response = await analyseDatasheet({
        config,
        fileName: file.name,
        numPages: doc.numPages,
        truncated: doc.truncated,
        guessedPart: guessed,
        text: doc.fullText,
        signal: controller.signal,
      });

      if ((response as AnalysisError).error) {
        const err = response as AnalysisError;
        setStage("error");
        setNotDatasheet(err.message || "The model determined this is not a datasheet.");
        return;
      }

      setResult(response as AnalysisResult);
      setMeta({
        fileName: file.name,
        numPages: doc.numPages,
        truncated: doc.truncated,
        model: config.model,
      });
      setStage("done");
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        setStage("idle");
        return;
      }
      setStage("error");
      setErrorMsg((e as Error).message || "Something went wrong.");
    } finally {
      abortRef.current = null;
    }
  }, [file, apiReady, config]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setStage("idle");
  }, []);

  const busy = stage === "extracting" || stage === "analysing";

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent-600/10 text-accent-400 ring-1 ring-accent-600/30">
            <IconBolt width={20} height={20} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-ink-50">Datasheet Analyzer</h1>
            <p className="text-xs text-ink-400">
              Structured engineering summaries for any electronic component datasheet.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ProviderBadge config={config} ready={apiReady} />
          <button
            className="btn-secondary"
            onClick={() => setSettingsOpen(true)}
            aria-label="Open settings"
          >
            <IconSettings /> Settings
          </button>
        </div>
      </header>

      <main className="flex-1 space-y-6">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Dropzone file={file} onFile={onFileChange} disabled={busy} />
          </div>
          <div className="card flex flex-col justify-between p-5">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                Run Analysis
              </div>
              <p className="mt-1.5 text-sm text-ink-300">
                {file
                  ? `Ready: ${file.name}`
                  : "Upload a PDF datasheet to begin."}
              </p>
              {!apiReady && (
                <p className="mt-2 text-xs text-warn-400">
                  {PROVIDER_PRESETS[config.provider]?.keyless
                    ? "Pick a model in Settings to continue."
                    : "Configure your API key in Settings first."}
                </p>
              )}
              {apiReady && PROVIDER_PRESETS[config.provider]?.keyless && (
                <p className="mt-2 text-xs text-accent-400">
                  {config.provider === "puter"
                    ? "Using Puter — no API key needed."
                    : config.provider === "ollama"
                      ? `Using local Ollama (${config.model}).`
                      : "Using keyless provider."}
                </p>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {!busy ? (
                <button
                  className="btn-primary"
                  disabled={!file}
                  onClick={run}
                >
                  <IconBolt /> Analyse Datasheet
                </button>
              ) : (
                <button className="btn-secondary" onClick={cancel}>
                  <IconX /> Cancel
                </button>
              )}
              {(result || errorMsg || notDatasheet) && !busy && (
                <button className="btn-ghost" onClick={reset}>Clear</button>
              )}
            </div>
          </div>
        </div>

        {busy && (
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <IconSpinner width={18} height={18} className="text-accent-400" />
              <div className="text-sm text-ink-200">
                {stage === "extracting"
                  ? progress
                    ? `Extracting text — page ${progress.done} / ${progress.total}…`
                    : "Extracting text from PDF…"
                  : "Analysing with model… this can take 10–40 seconds depending on size."}
              </div>
            </div>
            {stage === "extracting" && progress && (
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
                <div
                  className="h-full bg-accent-500 transition-[width] duration-200"
                  style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
                />
              </div>
            )}
            {extracted && stage === "analysing" && (
              <div className="mt-3 text-xs text-ink-500">
                Extracted {extracted.numPages} pages, ~{extracted.fullText.length.toLocaleString()} characters
                {extracted.truncated && " (truncated to fit context)"}.
              </div>
            )}
          </div>
        )}

        {stage === "error" && (errorMsg || notDatasheet) && (
          <div className="card flex items-start gap-3 border-danger-600/40 bg-danger-600/5 p-5">
            <div className="rounded-md bg-danger-600/15 p-2 text-danger-400">
              <IconWarn width={18} height={18} />
            </div>
            <div className="min-w-0 text-sm text-ink-200">
              <div className="font-semibold text-ink-50">
                {notDatasheet ? "This does not look like a datasheet" : "Analysis failed"}
              </div>
              <div className="mt-1 text-ink-300">{notDatasheet ?? errorMsg}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="btn-secondary" onClick={reset}>Start over</button>
                {!notDatasheet && file && (
                  <button className="btn-primary" onClick={run}>Retry</button>
                )}
              </div>
            </div>
          </div>
        )}

        {stage === "done" && result && meta && (
          <ResultsView result={result} meta={meta} />
        )}

        {stage === "idle" && !result && (
          <EmptyState />
        )}
      </main>

      <footer className="mt-10 border-t border-ink-800 pt-4 text-center text-xs text-ink-500">
        Datasheet text is extracted in your browser. Model requests go directly from your browser to your chosen provider (Puter, OpenAI, etc.) — this app has no server.
      </footer>

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        config={config}
        onChange={setConfig}
      />
    </div>
  );
}

function ProviderBadge({ config, ready }: { config: ProviderConfig; ready: boolean }) {
  const keyless = PROVIDER_PRESETS[config.provider]?.keyless;
  return (
    <div className={`chip ${ready ? "chip-accent" : "chip-warn"}`}>
      <span className="font-mono">{config.model || "no-model"}</span>
      <span className="hidden text-ink-500 sm:inline">
        @ {config.provider}
        {keyless ? " (free)" : ""}
      </span>
    </div>
  );
}

function EmptyState() {
  const items = [
    {
      title: "Zero setup",
      desc: "By default the app runs through Puter.js — no API key, no signup, no server. Power users can switch to OpenAI / OpenRouter / a local model in Settings.",
    },
    {
      title: "Adaptive analysis",
      desc: "The analyzer first identifies the component type — IC, sensor, connector, power device, module, equipment — and adapts sections accordingly. Irrelevant sections are omitted.",
    },
    {
      title: "Risk-focused",
      desc: "Highlights absolute-max ratings, sensitive parameters, common failure modes, thermal & EMI concerns, and red flags requiring further testing.",
    },
    {
      title: "Decision-ready output",
      desc: "Concise summary with pros, cons, red flags, and pin/interface notes — exportable as Markdown or JSON.",
    },
  ];
  return (
    <div className="card p-6">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-ink-50">How it works</h2>
        <p className="text-sm text-ink-400">
          Drop a datasheet PDF above and click <span className="text-ink-200">Analyse</span>. The first run via Puter will ask you to sign in to a free Puter account — that&apos;s the only setup.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((it) => (
          <div key={it.title} className="rounded-lg border border-ink-800 bg-ink-900/60 p-4">
            <div className="text-sm font-semibold text-ink-50">{it.title}</div>
            <p className="mt-1 text-sm text-ink-300">{it.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
