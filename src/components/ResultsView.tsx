import { useMemo, useState, type ReactNode } from "react";
import type { AnalysisResult } from "../lib/types";
import { analysisToMarkdown } from "../lib/exportMarkdown";
import { BulletList } from "./BulletList";
import { Section, SubGroup } from "./Section";
import {
  IconBolt,
  IconChip,
  IconCircuit,
  IconCopy,
  IconDownload,
  IconCheck,
  IconGauge,
  IconList,
  IconPin,
  IconShield,
  IconSwap,
  IconWarn,
} from "./Icons";

interface Props {
  result: AnalysisResult;
  meta: { fileName: string; numPages: number; truncated: boolean; model: string; elapsedMs?: number };
}

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export function ResultsView({ result, meta }: Props) {
  const md = useMemo(() => analysisToMarkdown(result, meta), [result, meta]);
  const json = useMemo(() => JSON.stringify(result, null, 2), [result]);
  const [copiedKind, setCopiedKind] = useState<"md" | "json" | null>(null);

  const copy = async (text: string, kind: "md" | "json") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKind(kind);
      setTimeout(() => setCopiedKind(null), 1500);
    } catch {
      /* ignore */
    }
  };

  const download = (text: string, ext: "md" | "json", mime: string) => {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const base = meta.fileName.replace(/\.pdf$/i, "");
    a.href = url;
    a.download = `${base || "datasheet"}.summary.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const id = result.identification;
  const conf = result.confidence;
  const confChip =
    conf === "high" ? "chip-accent" : conf === "low" ? "chip-danger" : "chip-warn";

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-400">
              <span className="chip">{id.componentType}</span>
              {id.manufacturer && <span className="chip">{id.manufacturer}</span>}
              {conf && <span className={confChip}>Confidence: {conf}</span>}
              {meta.truncated && (
                <span className="chip-warn">Datasheet truncated</span>
              )}
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-ink-50">
              {id.partNumber ?? "Unknown part number"}
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-ink-300">{id.primaryFunction}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-500">
              <span className="font-mono">{meta.fileName}</span>
              <span aria-hidden>&middot;</span>
              <span>{meta.numPages} pages</span>
              <span aria-hidden>&middot;</span>
              <span>
                model <span className="font-mono">{meta.model}</span>
              </span>
              {typeof meta.elapsedMs === "number" && meta.elapsedMs > 0 && (
                <>
                  <span aria-hidden>&middot;</span>
                  <span className="font-mono text-accent-400 tabular-nums">
                    completed in {formatElapsed(meta.elapsedMs)}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className="btn-secondary"
              onClick={() => copy(md, "md")}
              title="Copy summary as Markdown"
            >
              {copiedKind === "md" ? <IconCheck /> : <IconCopy />} Copy MD
            </button>
            <button
              className="btn-secondary"
              onClick={() => copy(json, "json")}
              title="Copy as raw JSON"
            >
              {copiedKind === "json" ? <IconCheck /> : <IconCopy />} Copy JSON
            </button>
            <button className="btn-secondary" onClick={() => download(md, "md", "text/markdown")}>
              <IconDownload /> .md
            </button>
            <button className="btn-secondary" onClick={() => download(json, "json", "application/json")}>
              <IconDownload /> .json
            </button>
          </div>
        </div>
      </div>

      <Section number={1} title="Component Identification" icon={<IconChip width={18} height={18} />} intent="accent">
        <SubGroup label="Key Features">
          <BulletList items={id.keyFeatures} tone="accent" />
        </SubGroup>
        <SubGroup label="Typical Applications">
          <BulletList items={id.typicalApplications} />
        </SubGroup>
      </Section>

      {result.absoluteMaxRatings && (
        <Section
          number={2}
          title="Absolute Maximum Ratings"
          icon={<IconWarn width={18} height={18} />}
          intent="danger"
        >
          <Grid>
            <SubGroup label="Voltage Limits"><BulletList items={result.absoluteMaxRatings.voltage} tone="danger" /></SubGroup>
            <SubGroup label="Current Limits"><BulletList items={result.absoluteMaxRatings.current} tone="danger" /></SubGroup>
            <SubGroup label="Power / Thermal"><BulletList items={result.absoluteMaxRatings.powerThermal} tone="danger" /></SubGroup>
            <SubGroup label="Environmental"><BulletList items={result.absoluteMaxRatings.environmental} tone="danger" /></SubGroup>
          </Grid>
          {result.absoluteMaxRatings.criticalConstraints && result.absoluteMaxRatings.criticalConstraints.length > 0 && (
            <SubGroup label="Critical Constraints">
              <BulletList items={result.absoluteMaxRatings.criticalConstraints} tone="danger" />
            </SubGroup>
          )}
        </Section>
      )}

      {result.recommendedOperating && (
        <Section
          number={3}
          title="Recommended Operating Conditions"
          icon={<IconBolt width={18} height={18} />}
          intent="accent"
        >
          <Grid>
            <SubGroup label="Supply Ranges"><BulletList items={result.recommendedOperating.supply} tone="accent" /></SubGroup>
            <SubGroup label="Timing Requirements"><BulletList items={result.recommendedOperating.timing} /></SubGroup>
            <SubGroup label="Temperature Ranges"><BulletList items={result.recommendedOperating.temperature} /></SubGroup>
            <SubGroup label="Safe Operating Margins"><BulletList items={result.recommendedOperating.margins} tone="warn" /></SubGroup>
          </Grid>
        </Section>
      )}

      {result.electricalPerformance && (
        <Section
          number={4}
          title="Electrical / Performance Characteristics"
          icon={<IconGauge width={18} height={18} />}
        >
          <Grid>
            <SubGroup label="Input / Output Thresholds"><BulletList items={result.electricalPerformance.ioThresholds} /></SubGroup>
            <SubGroup label="Timing Parameters"><BulletList items={result.electricalPerformance.timing} /></SubGroup>
            <SubGroup label="Accuracy / Noise / Drift"><BulletList items={result.electricalPerformance.accuracyNoiseDrift} /></SubGroup>
            <SubGroup label="Performance Trends"><BulletList items={result.electricalPerformance.performanceTrends} /></SubGroup>
          </Grid>
          {result.electricalPerformance.tolerancesVariations && result.electricalPerformance.tolerancesVariations.length > 0 && (
            <SubGroup label="Tolerances & Variations">
              <BulletList items={result.electricalPerformance.tolerancesVariations} tone="warn" />
            </SubGroup>
          )}
        </Section>
      )}

      {result.pinoutInterface && (
        <Section
          number={5}
          title="Pinout / Interface / Connections"
          icon={<IconPin width={18} height={18} />}
        >
          <SubGroup label="Pin / Terminal Functions">
            <BulletList items={result.pinoutInterface.pinFunctions} />
          </SubGroup>
          <Grid>
            <SubGroup label="Communication Interfaces"><BulletList items={result.pinoutInterface.interfaces} tone="accent" /></SubGroup>
            <SubGroup label="Unused Pins / Pull-ups / Pull-downs"><BulletList items={result.pinoutInterface.unusedPinsNotes} tone="warn" /></SubGroup>
          </Grid>
          {result.pinoutInterface.mechanicalConnector && result.pinoutInterface.mechanicalConnector.length > 0 && (
            <SubGroup label="Mechanical / Connector">
              <BulletList items={result.pinoutInterface.mechanicalConnector} />
            </SubGroup>
          )}
        </Section>
      )}

      {result.recommendedCircuits && (
        <Section
          number={6}
          title="Recommended Circuits / Application Notes"
          icon={<IconCircuit width={18} height={18} />}
          intent="accent"
        >
          <SubGroup label="Typical Application Circuits"><BulletList items={result.recommendedCircuits.typicalCircuits} /></SubGroup>
          <Grid>
            <SubGroup label="Required External Components"><BulletList items={result.recommendedCircuits.externalComponents} /></SubGroup>
            <SubGroup label="Layout Recommendations"><BulletList items={result.recommendedCircuits.layoutRecommendations} tone="accent" /></SubGroup>
            <SubGroup label="Startup / Shutdown"><BulletList items={result.recommendedCircuits.startupShutdown} /></SubGroup>
            <SubGroup label="Recommended Design Practices"><BulletList items={result.recommendedCircuits.designPractices} tone="accent" /></SubGroup>
          </Grid>
        </Section>
      )}

      <Section
        number={7}
        title="Risks, Caveats & Design Watch-outs"
        icon={<IconShield width={18} height={18} />}
        intent="warn"
      >
        <Grid>
          <SubGroup label="Sensitive Parameters"><BulletList items={result.risks.sensitiveParameters} tone="warn" /></SubGroup>
          <SubGroup label="Common Failure Modes"><BulletList items={result.risks.failureModes} tone="danger" /></SubGroup>
          <SubGroup label="Thermal / EMI Concerns"><BulletList items={result.risks.thermalEmi} tone="warn" /></SubGroup>
          <SubGroup label="Known Pitfalls"><BulletList items={result.risks.knownPitfalls} tone="warn" /></SubGroup>
        </Grid>
        {result.risks.bringUpReliability && result.risks.bringUpReliability.length > 0 && (
          <SubGroup label="Bring-up / Reliability Issues">
            <BulletList items={result.risks.bringUpReliability} tone="danger" />
          </SubGroup>
        )}
      </Section>

      {result.alternatives && (
        <Section
          number={8}
          title="Alternatives & Cross-References"
          icon={<IconSwap width={18} height={18} />}
        >
          <Grid>
            <SubGroup label="Pin-Compatible Parts"><BulletList items={result.alternatives.pinCompatible} tone="accent" /></SubGroup>
            <SubGroup label="Functionally Similar Parts"><BulletList items={result.alternatives.functionallySimilar} /></SubGroup>
          </Grid>
          {result.alternatives.lifecycleAvailability && result.alternatives.lifecycleAvailability.length > 0 && (
            <SubGroup label="Lifecycle / Availability">
              <BulletList items={result.alternatives.lifecycleAvailability} tone="warn" />
            </SubGroup>
          )}
        </Section>
      )}

      {result.extraSections && result.extraSections.length > 0 && (
        <>
          {result.extraSections.map((sec, i) => (
            <Section key={i} title={sec.title} icon={<IconList width={18} height={18} />}>
              <BulletList items={sec.bullets} />
            </Section>
          ))}
        </>
      )}

      <Section
        number={9}
        title="Summary for Decision-Makers"
        icon={<IconList width={18} height={18} />}
        intent="accent"
      >
        <SubGroup label="At a Glance">
          <BulletList items={result.decisionSummary.bullets} tone="accent" />
        </SubGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <SubGroup label="Pros">
            <BulletList items={result.decisionSummary.pros} tone="accent" />
          </SubGroup>
          <SubGroup label="Cons">
            <BulletList items={result.decisionSummary.cons} tone="warn" />
          </SubGroup>
        </div>
        {result.decisionSummary.redFlags && result.decisionSummary.redFlags.length > 0 && (
          <SubGroup label="Red Flags — Verify Before Committing">
            <BulletList items={result.decisionSummary.redFlags} tone="danger" />
          </SubGroup>
        )}
      </Section>

      {result.assumptions && result.assumptions.length > 0 && (
        <div className="card p-5">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
            Assumptions made by the analyzer
          </div>
          <BulletList items={result.assumptions} tone="warn" />
        </div>
      )}
    </div>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}
