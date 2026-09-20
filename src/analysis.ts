import type { VerificationReport } from "./types.js";

export interface RecoveryScore { safetyViolations: number; recoverySuccessRate: number; outcomeCertaintyRate: number; statePreservationRate?: number; }
export interface ScoreDelta { metric: keyof RecoveryScore; before: number; after: number; delta: number; regression: boolean; }

export function diffRecoveryScores(before: RecoveryScore, after: RecoveryScore): ScoreDelta[] {
  const metrics: Array<keyof RecoveryScore> = ["safetyViolations", "recoverySuccessRate", "outcomeCertaintyRate", "statePreservationRate"];
  return metrics.filter((metric) => before[metric] !== undefined || after[metric] !== undefined).map((metric) => {
    const previous = before[metric] ?? 0; const next = after[metric] ?? 0; const delta = next - previous;
    return { metric, before: previous, after: next, delta, regression: metric === "safetyViolations" ? delta > 0 : delta < 0 };
  });
}

export interface RecoverySlo { name: string; target: number; windowMs: number; metric: "recoverySuccessRate" | "outcomeCertaintyRate"; }
export interface SloSample { timestamp: string; recovered: boolean; outcomeCertain: boolean; durationMs: number; }
export interface SloStatus { name: string; target: number; actual: number; compliant: boolean; errorBudgetRemaining: number; burnRate: number; samples: number; }

export function evaluateRecoverySlo(slo: RecoverySlo, samples: SloSample[], now = Date.now()): SloStatus {
  const eligible = samples.filter((sample) => { const timestamp = Date.parse(sample.timestamp); return Number.isFinite(timestamp) && timestamp >= now - slo.windowMs && timestamp <= now; });
  const successes = eligible.filter((sample) => slo.metric === "recoverySuccessRate" ? sample.recovered : sample.outcomeCertain).length;
  const actual = eligible.length ? successes / eligible.length : 1; const allowedFailure = 1 - slo.target; const observedFailure = 1 - actual;
  return { name: slo.name, target: slo.target, actual, compliant: actual >= slo.target, errorBudgetRemaining: Math.max(0, allowedFailure - observedFailure), burnRate: allowedFailure === 0 ? (observedFailure === 0 ? 0 : Infinity) : observedFailure / allowedFailure, samples: eligible.length };
}

export async function bisectRegression<T>(orderedRevisions: T[], passes: (revision: T) => Promise<boolean>): Promise<{ firstFailing: T; previousPassing?: T; probes: number }> {
  if (orderedRevisions.length < 2) throw new Error("Bisect requires at least two ordered revisions");
  let probes = 0; const check = async (index: number): Promise<boolean> => { probes++; return passes(orderedRevisions[index]!); };
  if (!await check(0)) throw new Error("The first revision already fails");
  if (await check(orderedRevisions.length - 1)) throw new Error("The last revision does not fail");
  let low = 0; let high = orderedRevisions.length - 1;
  while (high - low > 1) { const middle = Math.floor((low + high) / 2); if (await check(middle)) low = middle; else high = middle; }
  return { firstFailing: orderedRevisions[high]!, previousPassing: orderedRevisions[low], probes };
}

export interface EnvironmentSnapshot { name: string; config: Record<string, unknown>; score: RecoveryScore; }
export interface EnvironmentDifference { path: string; values: Record<string, unknown>; affectsRecovery: boolean; }

export function diffEnvironments(environments: EnvironmentSnapshot[], recoverySensitivePaths: string[] = []): EnvironmentDifference[] {
  if (environments.length < 2) return [];
  const paths = new Set(environments.flatMap((environment) => flatten(environment.config).map(([path]) => path)));
  const differences: EnvironmentDifference[] = [];
  for (const path of paths) { const values = Object.fromEntries(environments.map((environment) => [environment.name, readPath(environment.config, path)])); if (new Set(Object.values(values).map((value) => JSON.stringify(value))).size > 1) differences.push({ path, values, affectsRecovery: recoverySensitivePaths.some((candidate) => path === candidate || path.startsWith(`${candidate}.`)) }); }
  return differences;
}

export interface OrphanRule<T = Record<string, unknown>> { name: string; resource: string; isOrphan(record: T): boolean; evidence(record: T): Record<string, unknown>; severity: "low" | "medium" | "high" | "critical"; }
export interface OrphanFinding { rule: string; resource: string; severity: OrphanRule["severity"]; evidence: Record<string, unknown>; }

export function detectOrphanedState<T>(records: T[], rules: Array<OrphanRule<T>>): OrphanFinding[] {
  return rules.flatMap((rule) => records.filter((record) => rule.isOrphan(record)).map((record) => ({ rule: rule.name, resource: rule.resource, severity: rule.severity, evidence: structuredClone(rule.evidence(record)) })));
}

export interface OutcomeEvidence { visibleStatus?: string; backendStatus?: string; hasConfirmation: boolean; hasStatusCheck: boolean; errorAllowsRetry: boolean; pendingIndicator: boolean; }
export interface CertaintyAssessment { score: number; certain: boolean; reasons: string[]; }

export function assessOutcomeCertainty(evidence: OutcomeEvidence): CertaintyAssessment {
  let score = 0; const reasons: string[] = [];
  if (evidence.visibleStatus && evidence.backendStatus && evidence.visibleStatus === evidence.backendStatus) score += 45; else reasons.push("Visible and backend outcomes do not match.");
  if (evidence.hasConfirmation) score += 25; else reasons.push("No explicit outcome confirmation is visible.");
  if (evidence.hasStatusCheck) score += 20; else reasons.push("The user cannot check authoritative status.");
  if (evidence.pendingIndicator) score += 10;
  if (evidence.errorAllowsRetry && evidence.backendStatus === "succeeded") { score = Math.max(0, score - 40); reasons.push("The UI permits a retry even though the backend succeeded."); }
  return { score, certain: score >= 70, reasons };
}

export interface RecoveryInteraction { kind: "click" | "input" | "wait" | "navigation" | "decision"; durationMs: number; reenteredCharacters?: number; }
export interface RecoveryEffort { interactions: number; activeTimeMs: number; extraClicks: number; reenteredCharacters: number; cognitiveSteps: number; index: number; }

export function estimateRecoveryEffort(interactions: RecoveryInteraction[], baselineClicks = 0): RecoveryEffort {
  const clicks = interactions.filter((interaction) => interaction.kind === "click").length; const activeTimeMs = interactions.reduce((total, interaction) => total + interaction.durationMs, 0); const reenteredCharacters = interactions.reduce((total, interaction) => total + (interaction.reenteredCharacters ?? 0), 0); const cognitiveSteps = interactions.filter((interaction) => interaction.kind === "decision" || interaction.kind === "navigation").length; const extraClicks = Math.max(0, clicks - baselineClicks);
  const index = Math.min(100, Math.round(extraClicks * 8 + cognitiveSteps * 12 + Math.min(activeTimeMs / 1000, 30) + Math.min(reenteredCharacters / 5, 30)));
  return { interactions: interactions.length, activeTimeMs, extraClicks, reenteredCharacters, cognitiveSteps, index };
}

export function scoreFromReport(report: VerificationReport): RecoveryScore { return { safetyViolations: report.summary.safetyViolations, recoverySuccessRate: report.summary.recoverySuccessRate, outcomeCertaintyRate: report.summary.outcomeCertaintyRate }; }

function flatten(value: Record<string, unknown>, prefix = ""): Array<[string, unknown]> { return Object.entries(value).flatMap(([key, child]) => { const path = prefix ? `${prefix}.${key}` : key; return child && typeof child === "object" && !Array.isArray(child) ? flatten(child as Record<string, unknown>, path) : [[path, child]]; }); }
function readPath(value: Record<string, unknown>, path: string): unknown { return path.split(".").reduce<unknown>((current, segment) => current && typeof current === "object" ? (current as Record<string, unknown>)[segment] : undefined, value); }
