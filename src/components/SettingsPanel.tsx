import { useEffect, useState } from "react";
import { PROVIDER_PRESETS, type ProviderConfig, type ProviderId } from "../lib/types";
import { IconSettings, IconX } from "./Icons";

interface Props {
  open: boolean;
  onClose: () => void;
  config: ProviderConfig;
  onChange: (cfg: ProviderConfig) => void;
}

const MODEL_HINTS: Partial<Record<ProviderId, string[]>> = {
  puter: [
    "claude-sonnet-4-5",
    "gpt-5.4-nano",
    "gpt-5.2-chat",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
  ],
  ollama: [
    "qwen2.5:14b-instruct",
    "qwen2.5:32b-instruct",
    "qwen2.5-coder:14b",
    "llama3.3",
    "llama3.1:8b",
    "gemma2:27b-instruct",
    "phi4",
    "mistral-small",
  ],
};

export function SettingsPanel({ open, onClose, config, onChange }: Props) {
  const [local, setLocal] = useState(config);

  useEffect(() => {
    setLocal(config);
  }, [config, open]);

  if (!open) return null;

  const update = (patch: Partial<ProviderConfig>) => setLocal((c) => ({ ...c, ...patch }));

  const onProvider = (provider: ProviderId) => {
    const preset = PROVIDER_PRESETS[provider];
    update({
      provider,
      baseUrl: preset.baseUrl || (provider === "custom" ? local.baseUrl : ""),
      model: preset.defaultModel || local.model,
    });
  };

  const preset = PROVIDER_PRESETS[local.provider];
  const showApiKey = !preset.keyless;
  const showBaseUrl = !preset.hideBaseUrl;
  const hintListId = MODEL_HINTS[local.provider] ? `model-hints-${local.provider}` : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card w-full max-w-xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconSettings />
            <h2 className="text-lg font-semibold text-ink-50">Model Settings</h2>
          </div>
          <button className="btn-ghost" onClick={onClose} aria-label="Close settings">
            <IconX />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label mb-1.5 block">Provider</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {(Object.keys(PROVIDER_PRESETS) as ProviderId[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => onProvider(p)}
                  className={[
                    "rounded-md border px-2.5 py-2 text-xs transition-colors",
                    local.provider === p
                      ? "border-accent-500/60 bg-accent-600/10 text-accent-400"
                      : "border-ink-700 bg-ink-900 text-ink-300 hover:bg-ink-800",
                  ].join(" ")}
                >
                  {PROVIDER_PRESETS[p].label}
                </button>
              ))}
            </div>
            {preset.blurb && (
              <p className="mt-2 text-xs text-ink-500">{preset.blurb}</p>
            )}
          </div>

          {showBaseUrl && (
            <div>
              <label className="label mb-1.5 block">API Base URL</label>
              <input
                className="input font-mono text-xs"
                value={local.baseUrl}
                onChange={(e) => update({ baseUrl: e.target.value })}
                placeholder={preset.baseUrl || "https://api.openai.com/v1"}
              />
              {local.provider === "ollama" && (
                <p className="mt-1.5 text-xs text-ink-500">
                  Default is <code className="text-accent-400">http://localhost:11434/v1</code>. Change
                  the host/port if Ollama runs elsewhere.
                </p>
              )}
            </div>
          )}

          {showApiKey && (
            <div>
              <label className="label mb-1.5 block">API Key</label>
              <input
                className="input font-mono text-xs"
                type="password"
                value={local.apiKey}
                onChange={(e) => update({ apiKey: e.target.value })}
                placeholder="sk-..."
                autoComplete="off"
              />
              <p className="mt-1.5 text-xs text-ink-500">
                Stored locally in your browser only. Requests go directly from your browser to the provider.
              </p>
            </div>
          )}

          {!showApiKey && local.provider === "puter" && (
            <div className="rounded-md border border-accent-600/30 bg-accent-600/5 p-3 text-xs text-ink-300">
              <div className="mb-1 font-semibold text-accent-400">No API key needed</div>
              The first time you analyse a datasheet, Puter will prompt you to sign in to a free Puter account.
              New accounts include free credits; after that you only pay for what you use.
              Nothing is billed to the app.
            </div>
          )}

          {!showApiKey && local.provider === "ollama" && (
            <div className="rounded-md border border-accent-600/30 bg-accent-600/5 p-3 text-xs text-ink-300">
              <div className="mb-1 font-semibold text-accent-400">No API key needed — runs locally</div>
              Make sure Ollama is running and that you&apos;ve pulled the model
              (<code className="text-accent-400">ollama pull {local.model || "qwen2.5:14b-instruct"}</code>).
              You also need to allow cross-origin requests by setting{" "}
              <code className="text-accent-400">OLLAMA_ORIGINS=*</code> (or the dev URL) before launching Ollama —
              see the README.
            </div>
          )}

          <div>
            <label className="label mb-1.5 block">Model</label>
            <input
              className="input font-mono text-xs"
              value={local.model}
              onChange={(e) => update({ model: e.target.value })}
              placeholder={preset.defaultModel || "model-id"}
              list={hintListId}
            />
            {hintListId && (
              <datalist id={hintListId}>
                {MODEL_HINTS[local.provider]!.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            )}
            {local.provider === "puter" && (
              <p className="mt-1.5 text-xs text-ink-500">
                Examples: <code className="text-accent-400">claude-sonnet-4-5</code>,{" "}
                <code className="text-accent-400">gpt-5.4-nano</code>,{" "}
                <code className="text-accent-400">gemini-2.5-flash</code>. See the{" "}
                <a
                  href="https://docs.puter.com/AI/chat/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent-400 hover:underline"
                >
                  Puter docs
                </a>{" "}
                for the full list.
              </p>
            )}
            {local.provider === "ollama" && (
              <p className="mt-1.5 text-xs text-ink-500">
                Pick a model you&apos;ve pulled with <code className="text-accent-400">ollama pull &lt;model&gt;</code>.
                For structured datasheet extraction, instruction-tuned models in the 14B+ range work best (e.g.{" "}
                <code className="text-accent-400">qwen2.5:14b-instruct</code>,{" "}
                <code className="text-accent-400">llama3.3</code>).
              </p>
            )}
            {!["puter", "ollama"].includes(local.provider) && (
              <p className="mt-1.5 text-xs text-ink-500">
                Use a model with strong instruction-following and JSON mode (e.g.{" "}
                <code className="text-accent-400">gpt-4o-mini</code>,{" "}
                <code className="text-accent-400">claude-3.5-sonnet</code>).
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            onClick={() => {
              onChange(local);
              onClose();
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
