import { PROVIDER_PRESETS, type ProviderConfig, type ProviderId } from "./types";

const KEY = "datasheet-analyzer.providerConfig.v2";

const DEFAULT_PROVIDER: ProviderId = "puter";

export function loadProviderConfig(): ProviderConfig {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ProviderConfig>;
      const provider = (parsed.provider ?? DEFAULT_PROVIDER) as ProviderId;
      const preset = PROVIDER_PRESETS[provider] ?? PROVIDER_PRESETS[DEFAULT_PROVIDER];
      return {
        provider,
        baseUrl: parsed.baseUrl ?? preset.baseUrl,
        apiKey: parsed.apiKey ?? "",
        model: parsed.model || preset.defaultModel,
      };
    }
  } catch {
    /* ignore */
  }
  const preset = PROVIDER_PRESETS[DEFAULT_PROVIDER];
  return {
    provider: DEFAULT_PROVIDER,
    baseUrl: preset.baseUrl,
    apiKey: "",
    model: preset.defaultModel,
  };
}

export function saveProviderConfig(cfg: ProviderConfig): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(cfg));
  } catch {
    /* ignore */
  }
}
