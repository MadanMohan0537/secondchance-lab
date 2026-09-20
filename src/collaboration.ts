import { createHash, randomBytes } from "node:crypto";
import type { VerificationReport } from "./types.js";
import type { ContractCoverage } from "./types.js";
import type { ScoreDelta } from "./analysis.js";

export interface ReplayArtifact { id: string; createdAt: string; expiresAt?: string; report: VerificationReport; traceBundle?: Record<string, unknown>; }

export class ReplayStore {
  readonly #artifacts = new Map<string, ReplayArtifact>();
  create(report: VerificationReport, options: { ttlMs?: number; traceBundle?: Record<string, unknown> } = {}): { artifact: ReplayArtifact; token: string } {
    const token = randomBytes(24).toString("base64url"); const id = createHash("sha256").update(token).digest("hex").slice(0, 24); const now = Date.now();
    const artifact: ReplayArtifact = { id, createdAt: new Date(now).toISOString(), ...(options.ttlMs ? { expiresAt: new Date(now + options.ttlMs).toISOString() } : {}), report: structuredClone(report), ...(options.traceBundle ? { traceBundle: structuredClone(options.traceBundle) } : {}) };
    this.#artifacts.set(createHash("sha256").update(token).digest("hex"), artifact); return { artifact: structuredClone(artifact), token };
  }
  get(token: string, now = Date.now()): ReplayArtifact { const artifact = this.#artifacts.get(createHash("sha256").update(token).digest("hex")); if (!artifact) throw new Error("Unknown replay token"); if (artifact.expiresAt && Date.parse(artifact.expiresAt) <= now) throw new Error("Replay token expired"); return structuredClone(artifact); }
}

export function renderPullRequestComment(input: { contract: string; passed: boolean; deltas: ScoreDelta[]; replayUrl?: string; untestedWindows?: string[] }): string {
  const regressions = input.deltas.filter((delta) => delta.regression); const status = input.passed && !regressions.length ? "✅ Recovery checks passed" : "❌ Recovery regression detected";
  const rows = input.deltas.map((delta) => `| ${delta.metric} | ${format(delta.before)} | ${format(delta.after)} | ${signed(delta.delta)} | ${delta.regression ? "Regression" : "OK"} |`).join("\n");
  return [`## ${status}`, "", `Contract: **${input.contract}**`, "", "| Metric | Before | After | Delta | Result |", "|---|---:|---:|---:|---|", rows || "| No comparable metrics | — | — | — | OK |", ...(input.untestedWindows?.length ? ["", `Untested windows: ${input.untestedWindows.map((window) => `\`${window}\``).join(", ")}`] : []), ...(input.replayUrl ? ["", `[Open recovery replay](${input.replayUrl})`] : [])].join("\n");
}

export function recoveryBadge(coverage: ContractCoverage, criticalFlows: number): string {
  const color = coverage.score >= 90 ? "brightgreen" : coverage.score >= 70 ? "yellow" : "red"; const label = "recovery"; const value = `${coverage.score}% | ${criticalFlows} critical`;
  const width = Math.max(130, 7 * (label.length + value.length) + 20); const split = Math.round(width * 0.43);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${label}: ${value}"><linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient><clipPath id="r"><rect width="${width}" height="20" rx="3"/></clipPath><g clip-path="url(#r)"><rect width="${split}" height="20" fill="#555"/><rect x="${split}" width="${width - split}" height="20" fill="${color}"/><rect width="${width}" height="20" fill="url(#s)"/></g><g fill="#fff" text-anchor="middle" font-family="Verdana,sans-serif" font-size="11"><text x="${split / 2}" y="14">${label}</text><text x="${split + (width - split) / 2}" y="14">${value}</text></g></svg>`;
}

export function postmortemMarkdown(report: VerificationReport): string {
  const violations = report.scenarios.flatMap((scenario) => scenario.violations.map((violation) => `- **${violation.kind}** in \`${violation.windowId}\`: ${violation.invariant}; expected \`${JSON.stringify(violation.expected)}\`, observed \`${JSON.stringify(violation.observed)}\`.`));
  return [`# Recovery incident: ${report.contract}`, "", `Generated: ${report.generatedAt}`, `Status: ${report.passed ? "Passed" : "Failed"}`, "", "## Impact", `- Safety violations: ${report.summary.safetyViolations}`, `- Recovery success: ${Math.round(report.summary.recoverySuccessRate * 100)}%`, `- Outcome certainty: ${Math.round(report.summary.outcomeCertaintyRate * 100)}%`, "", "## Violations", ...(violations.length ? violations : ["No invariant violations."]), "", "## Recommended actions", ...(report.suggestions.length ? report.suggestions.map((suggestion) => `- ${suggestion}`) : ["- No corrective action suggested."])].join("\n");
}

export function weeklyDigest(reports: VerificationReport[]): string {
  const failures = reports.filter((report) => !report.passed); const violations = reports.reduce((total, report) => total + report.summary.safetyViolations, 0); const worst = [...reports].sort((a, b) => a.summary.recoverySuccessRate - b.summary.recoverySuccessRate).slice(0, 3);
  return [`# SecondChance weekly recovery digest`, "", `- Runs: ${reports.length}`, `- Failed contracts: ${failures.length}`, `- Safety violations: ${violations}`, "", "## Highest-risk flows", ...(worst.length ? worst.map((report) => `- **${report.contract}**: ${Math.round(report.summary.recoverySuccessRate * 100)}% recovery, ${Math.round(report.summary.outcomeCertaintyRate * 100)}% certainty`) : ["- No runs recorded."])].join("\n");
}

const format = (value: number): string => Number.isInteger(value) ? String(value) : `${Math.round(value * 1000) / 10}%`;
const signed = (value: number): string => `${value > 0 ? "+" : ""}${format(value)}`;
