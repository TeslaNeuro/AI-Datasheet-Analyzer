export interface Identification {
  componentType: string;
  manufacturer: string | null;
  partNumber: string | null;
  primaryFunction: string;
  keyFeatures: string[];
  typicalApplications: string[];
}

export interface AbsoluteMaxRatings {
  voltage?: string[];
  current?: string[];
  powerThermal?: string[];
  environmental?: string[];
  criticalConstraints?: string[];
}

export interface RecommendedOperating {
  supply?: string[];
  timing?: string[];
  temperature?: string[];
  margins?: string[];
}

export interface ElectricalPerformance {
  ioThresholds?: string[];
  timing?: string[];
  accuracyNoiseDrift?: string[];
  performanceTrends?: string[];
  tolerancesVariations?: string[];
}

export interface PinoutInterface {
  pinFunctions?: string[];
  interfaces?: string[];
  unusedPinsNotes?: string[];
  mechanicalConnector?: string[];
}

export interface RecommendedCircuits {
  typicalCircuits?: string[];
  externalComponents?: string[];
  layoutRecommendations?: string[];
  startupShutdown?: string[];
  designPractices?: string[];
}

export interface Risks {
  sensitiveParameters?: string[];
  failureModes?: string[];
  thermalEmi?: string[];
  knownPitfalls?: string[];
  bringUpReliability?: string[];
}

export interface Alternatives {
  pinCompatible?: string[];
  functionallySimilar?: string[];
  lifecycleAvailability?: string[];
}

export interface ExtraSection {
  title: string;
  bullets: string[];
}

export interface DecisionSummary {
  bullets: string[];
  pros: string[];
  cons: string[];
  redFlags: string[];
}

export interface AnalysisResult {
  identification: Identification;
  absoluteMaxRatings?: AbsoluteMaxRatings | null;
  recommendedOperating?: RecommendedOperating | null;
  electricalPerformance?: ElectricalPerformance | null;
  pinoutInterface?: PinoutInterface | null;
  recommendedCircuits?: RecommendedCircuits | null;
  risks: Risks;
  alternatives?: Alternatives | null;
  extraSections?: ExtraSection[];
  decisionSummary: DecisionSummary;
  assumptions?: string[];
  confidence?: "high" | "medium" | "low";
}

export interface AnalysisError {
  error: "not_a_datasheet" | string;
  message: string;
}

export type AnalysisResponse = AnalysisResult | AnalysisError;

export type ProviderId = "puter" | "ollama" | "openai" | "openrouter" | "custom";

export interface ProviderConfig {
  provider: ProviderId;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface ProviderPreset {
  label: string;
  baseUrl: string;
  defaultModel: string;
  /** True if this provider does not require the user to supply an API key. */
  keyless?: boolean;
  /** True if the base URL is fixed and shouldn't be shown to the user (e.g. Puter). */
  hideBaseUrl?: boolean;
  /** Short tagline shown in the settings UI. */
  blurb?: string;
}

export const PROVIDER_PRESETS: Record<ProviderId, ProviderPreset> = {
  puter: {
    label: "Puter (free, no key)",
    baseUrl: "",
    defaultModel: "claude-sonnet-4-5",
    keyless: true,
    hideBaseUrl: true,
    blurb:
      "Uses puter.js. No API key needed — your users pay via their own Puter account (free credits to start).",
  },
  ollama: {
    label: "Ollama (local)",
    baseUrl: "http://localhost:11434/v1",
    defaultModel: "qwen2.5:14b-instruct",
    keyless: true,
    blurb:
      "Run models locally with Ollama. No API key needed. Requires CORS to be enabled on your Ollama instance (see README).",
  },
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    blurb: "Bring your own OpenAI key.",
  },
  openrouter: {
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "anthropic/claude-3.5-sonnet",
    blurb: "One key, hundreds of models (including free-tier ones).",
  },
  custom: {
    label: "Custom",
    baseUrl: "",
    defaultModel: "",
    blurb:
      "Any OpenAI-compatible /chat/completions endpoint — Groq, Together, vLLM, LM Studio, Gemini's OpenAI shim, etc.",
  },
};
