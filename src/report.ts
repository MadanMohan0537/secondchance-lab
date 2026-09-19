import type { VerificationReport } from "./types.js";

export function markdownReport(report: VerificationReport): string {
  const rows = report.scenarios.map((s) => `| ${s.window.family} | ${s.window.id} | ${s.recovered ? "yes" : "no"} | ${s.outcomeCertain ? "yes" : "no"} | ${s.violations.length} |`).join("\n");
  const findings = report.scenarios.flatMap((s) => s.violations.map((v) => `- **${v.kind}** at \`${v.windowId}\`: \`${v.invariant}\` expected \`${JSON.stringify(v.expected)}\`, observed \`${JSON.stringify(v.observed)}\`.`)).join("\n") || "- No violations.";
  const suggestions = report.suggestions.map((s) => `- ${s}`).join("\n") || "- No repair suggestions.";
  return `# Recovery report: ${report.contract}\n\n**Result:** ${report.passed ? "PASS" : "FAIL"}\n\n- Safety violations: ${report.summary.safetyViolations}\n- Recovery success rate: ${Math.round(report.summary.recoverySuccessRate * 100)}%\n- Outcome certainty rate: ${Math.round(report.summary.outcomeCertaintyRate * 100)}%\n\n## Interruption sweep\n\n| Family | Window | Recovered | Certain | Violations |\n|---|---|---:|---:|---:|\n${rows}\n\n## Findings\n\n${findings}\n\n## Suggested fixes\n\n${suggestions}\n`;
}
