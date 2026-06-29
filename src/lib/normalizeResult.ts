import type {
  AnalysisResponse,
  AnalysisResult,
  DecisionSummary,
  Identification,
  Risks,
} from "./types";

function str(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim() ? v : fallback;
}

function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.length > 0);
}

function normalizeIdentification(raw: unknown): Identification {
  const r = raw && typeof raw === "object" ? (raw as Partial<Identification>) : {};
  return {
    componentType: str(r.componentType, "Unknown component"),
    manufacturer: strOrNull(r.manufacturer),
    partNumber: strOrNull(r.partNumber),
    primaryFunction: str(r.primaryFunction, "Not specified by the model."),
    keyFeatures: strArray(r.keyFeatures),
    typicalApplications: strArray(r.typicalApplications),
  };
}

function normalizeRisks(raw: unknown): Risks {
  const r = raw && typeof raw === "object" ? (raw as Partial<Risks>) : {};
  return {
    sensitiveParameters: strArray(r.sensitiveParameters),
    failureModes: strArray(r.failureModes),
    thermalEmi: strArray(r.thermalEmi),
    knownPitfalls: strArray(r.knownPitfalls),
    bringUpReliability: strArray(r.bringUpReliability),
  };
}

function normalizeDecisionSummary(raw: unknown): DecisionSummary {
  const r = raw && typeof raw === "object" ? (raw as Partial<DecisionSummary>) : {};
  return {
    bullets: strArray(r.bullets),
    pros: strArray(r.pros),
    cons: strArray(r.cons),
    redFlags: strArray(r.redFlags),
  };
}

function isAnalysisError(obj: Record<string, unknown>): boolean {
  return typeof obj.error === "string" && obj.error.length > 0;
}

/** Fill in required fields when the model returns partial or malformed JSON. */
export function normalizeAnalysisResponse(parsed: unknown): AnalysisResponse {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Model returned invalid JSON structure.");
  }

  const obj = parsed as Record<string, unknown>;
  if (isAnalysisError(obj)) {
    return {
      error: obj.error as string,
      message: str(obj.message, "The model could not analyse this document."),
    };
  }

  const r = obj as Partial<AnalysisResult>;
  const confidence = r.confidence;
  const normalized: AnalysisResult = {
    identification: normalizeIdentification(r.identification),
    risks: normalizeRisks(r.risks),
    decisionSummary: normalizeDecisionSummary(r.decisionSummary),
    absoluteMaxRatings: r.absoluteMaxRatings ?? null,
    recommendedOperating: r.recommendedOperating ?? null,
    electricalPerformance: r.electricalPerformance ?? null,
    pinoutInterface: r.pinoutInterface ?? null,
    recommendedCircuits: r.recommendedCircuits ?? null,
    alternatives: r.alternatives ?? null,
    extraSections: Array.isArray(r.extraSections) ? r.extraSections : undefined,
    assumptions: strArray(r.assumptions),
    confidence:
      confidence === "high" || confidence === "medium" || confidence === "low"
        ? confidence
        : undefined,
  };

  return normalized;
}
