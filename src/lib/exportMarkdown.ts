import type { AnalysisResult } from "./types";

function bullets(arr?: string[] | null): string {
  if (!arr || arr.length === 0) return "";
  return arr.map((b) => `- ${b}`).join("\n") + "\n";
}

function block(title: string, body: string): string {
  return body.trim() ? `## ${title}\n\n${body}\n` : "";
}

function sub(title: string, arr?: string[] | null): string {
  if (!arr || arr.length === 0) return "";
  return `### ${title}\n\n${bullets(arr)}\n`;
}

export function analysisToMarkdown(
  r: AnalysisResult,
  meta: { fileName: string; numPages: number; truncated: boolean; model: string },
): string {
  const id = r.identification;
  const lines: string[] = [];

  lines.push(`# Datasheet Summary: ${id.partNumber ?? id.componentType ?? "Unknown"}`);
  lines.push("");
  lines.push(
    `_File: \`${meta.fileName}\` • Pages: ${meta.numPages}${meta.truncated ? " (truncated)" : ""} • Model: \`${meta.model}\` • Confidence: ${r.confidence ?? "n/a"}_`,
  );
  lines.push("");

  lines.push(
    block(
      "1. Component Identification",
      [
        `- **Type:** ${id.componentType}`,
        id.manufacturer ? `- **Manufacturer:** ${id.manufacturer}` : "",
        id.partNumber ? `- **Part Number:** ${id.partNumber}` : "",
        `- **Primary Function:** ${id.primaryFunction}`,
        "",
        sub("Key Features", id.keyFeatures),
        sub("Typical Applications", id.typicalApplications),
      ]
        .filter(Boolean)
        .join("\n"),
    ),
  );

  if (r.absoluteMaxRatings) {
    const m = r.absoluteMaxRatings;
    lines.push(
      block(
        "2. Absolute Maximum Ratings",
        [
          sub("Voltage Limits", m.voltage),
          sub("Current Limits", m.current),
          sub("Power / Thermal Limits", m.powerThermal),
          sub("Environmental Limits", m.environmental),
          sub("Critical Constraints", m.criticalConstraints),
        ].join(""),
      ),
    );
  }

  if (r.recommendedOperating) {
    const o = r.recommendedOperating;
    lines.push(
      block(
        "3. Recommended Operating Conditions",
        [
          sub("Supply Ranges", o.supply),
          sub("Timing Requirements", o.timing),
          sub("Temperature Ranges", o.temperature),
          sub("Safe Operating Margins", o.margins),
        ].join(""),
      ),
    );
  }

  if (r.electricalPerformance) {
    const e = r.electricalPerformance;
    lines.push(
      block(
        "4. Electrical / Performance Characteristics",
        [
          sub("Input/Output Thresholds", e.ioThresholds),
          sub("Timing Parameters", e.timing),
          sub("Accuracy / Noise / Drift", e.accuracyNoiseDrift),
          sub("Performance Trends", e.performanceTrends),
          sub("Tolerances & Variations", e.tolerancesVariations),
        ].join(""),
      ),
    );
  }

  if (r.pinoutInterface) {
    const p = r.pinoutInterface;
    lines.push(
      block(
        "5. Pinout / Interface / Connections",
        [
          sub("Pin / Terminal Functions", p.pinFunctions),
          sub("Communication Interfaces", p.interfaces),
          sub("Unused Pins / Pull-ups / Pull-downs", p.unusedPinsNotes),
          sub("Mechanical / Connector", p.mechanicalConnector),
        ].join(""),
      ),
    );
  }

  if (r.recommendedCircuits) {
    const c = r.recommendedCircuits;
    lines.push(
      block(
        "6. Recommended Circuits / Application Notes",
        [
          sub("Typical Application Circuits", c.typicalCircuits),
          sub("Required External Components", c.externalComponents),
          sub("Layout Recommendations", c.layoutRecommendations),
          sub("Startup / Shutdown Behaviour", c.startupShutdown),
          sub("Recommended Design Practices", c.designPractices),
        ].join(""),
      ),
    );
  }

  {
    const k = r.risks;
    lines.push(
      block(
        "7. Risks, Caveats & Design Watch-outs",
        [
          sub("Sensitive Parameters", k.sensitiveParameters),
          sub("Common Failure Modes", k.failureModes),
          sub("Thermal / EMI Concerns", k.thermalEmi),
          sub("Known Pitfalls", k.knownPitfalls),
          sub("Bring-up / Reliability Issues", k.bringUpReliability),
        ].join(""),
      ),
    );
  }

  if (r.alternatives) {
    const a = r.alternatives;
    lines.push(
      block(
        "8. Alternatives & Cross-References",
        [
          sub("Pin-Compatible Parts", a.pinCompatible),
          sub("Functionally Similar Parts", a.functionallySimilar),
          sub("Lifecycle / Availability", a.lifecycleAvailability),
        ].join(""),
      ),
    );
  }

  if (r.extraSections && r.extraSections.length > 0) {
    for (const sec of r.extraSections) {
      lines.push(block(sec.title, bullets(sec.bullets)));
    }
  }

  {
    const d = r.decisionSummary;
    lines.push(
      block(
        "9. Summary for Decision-Makers",
        [
          bullets(d.bullets),
          d.pros.length ? `**Pros**\n${bullets(d.pros)}` : "",
          d.cons.length ? `**Cons**\n${bullets(d.cons)}` : "",
          d.redFlags.length ? `**Red Flags**\n${bullets(d.redFlags)}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      ),
    );
  }

  if (r.assumptions && r.assumptions.length > 0) {
    lines.push(block("Assumptions", bullets(r.assumptions)));
  }

  return lines.filter(Boolean).join("\n");
}
