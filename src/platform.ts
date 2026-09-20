import type { RecoveryContract, VerificationReport } from "./types.js";
import type { RecoveryScore } from "./analysis.js";

export interface RecoveryDebtItem { flow: string; untestedWindows: number; knownSafetyRisks: number; businessImpact: number; effort: number; score: number; }
export function recoveryDebt(input: Omit<RecoveryDebtItem, "score">): RecoveryDebtItem { const score = Math.min(100, Math.round(input.untestedWindows * 8 + input.knownSafetyRisks * 25 + input.businessImpact * 0.35 + Math.max(0, 20 - input.effort))); return { ...input, score }; }

export interface DeployPolicy { minimumRecoveryRate: number; minimumCertaintyRate: number; maximumSafetyViolations: number; allowOverride: boolean; }
export interface DeployDecision { allowed: boolean; reasons: string[]; overrideRequired: boolean; }
export function evaluateDeployGate(score: RecoveryScore, policy: DeployPolicy): DeployDecision { const reasons: string[] = []; if (score.safetyViolations > policy.maximumSafetyViolations) reasons.push(`Safety violations ${score.safetyViolations} exceed ${policy.maximumSafetyViolations}.`); if (score.recoverySuccessRate < policy.minimumRecoveryRate) reasons.push(`Recovery rate ${score.recoverySuccessRate} is below ${policy.minimumRecoveryRate}.`); if (score.outcomeCertaintyRate < policy.minimumCertaintyRate) reasons.push(`Outcome certainty ${score.outcomeCertaintyRate} is below ${policy.minimumCertaintyRate}.`); return { allowed: reasons.length === 0, reasons, overrideRequired: reasons.length > 0 && policy.allowOverride }; }

export interface BenchmarkEntry { product: string; category: string; score: RecoveryScore; methodologyVersion: string; sampledAt: string; }
export function recoveryBenchmark(entries: BenchmarkEntry[]): Array<BenchmarkEntry & { rank: number; composite: number }> { return entries.map((entry) => ({ ...entry, composite: Math.round((entry.score.recoverySuccessRate * 0.45 + entry.score.outcomeCertaintyRate * 0.35 + Math.max(0, 1 - entry.score.safetyViolations) * 0.2) * 100) })).sort((a, b) => b.composite - a.composite || a.product.localeCompare(b.product)).map((entry, index) => ({ ...entry, rank: index + 1 })); }

export interface JourneyNode { id: string; contract: RecoveryContract; dependencies?: string[]; }
export interface JourneySimulation { order: string[]; blocked: string[]; affected: string[]; }
export function simulateJourneyTwin(nodes: JourneyNode[], unavailableEffects: string[]): JourneySimulation { const unavailable = new Set(unavailableEffects); const blocked = new Set<string>(); const order: string[] = []; const remaining = new Map(nodes.map((node) => [node.id, node])); while (remaining.size) { const ready = [...remaining.values()].filter((node) => (node.dependencies ?? []).every((dependency) => order.includes(dependency) || blocked.has(dependency))).sort((a, b) => a.id.localeCompare(b.id)); if (!ready.length) throw new Error("Journey twin contains a dependency cycle"); for (const node of ready) { const dependencyBlocked = (node.dependencies ?? []).some((dependency) => blocked.has(dependency)); const effectUnavailable = node.contract.invariants.effects.some((effect) => unavailable.has(effect.effect)); if (dependencyBlocked || effectUnavailable) blocked.add(node.id); order.push(node.id); remaining.delete(node.id); } } return { order, blocked: [...blocked], affected: nodes.filter((node) => blocked.has(node.id)).map((node) => node.contract.name) }; }

export class RecoveryApi {
  readonly #contracts = new Map<string, RecoveryContract>(); readonly #reports = new Map<string, VerificationReport[]>();
  register(contract: RecoveryContract): void { this.#contracts.set(contract.name, structuredClone(contract)); }
  record(report: VerificationReport): void { if (!this.#contracts.has(report.contract)) throw new Error(`Unknown contract: ${report.contract}`); this.#reports.set(report.contract, [...(this.#reports.get(report.contract) ?? []), structuredClone(report)]); }
  contract(name: string): RecoveryContract { const contract = this.#contracts.get(name); if (!contract) throw new Error(`Unknown contract: ${name}`); return structuredClone(contract); }
  latest(name: string): VerificationReport | undefined { const reports = this.#reports.get(name) ?? []; return reports.length ? structuredClone(reports[reports.length - 1]) : undefined; }
  doesRecover(name: string): boolean | undefined { return this.latest(name)?.passed; }
  untestedWindows(name: string): string[] { const contract = this.contract(name); const tested = new Set((this.latest(name)?.scenarios ?? []).map((scenario) => scenario.window.id)); return contract.windows.filter((window) => !tested.has(window.id)).map((window) => window.id); }
  list(): Array<{ name: string; passed?: boolean; windows: number; untested: number }> { return [...this.#contracts.values()].map((contract) => ({ name: contract.name, ...(this.doesRecover(contract.name) === undefined ? {} : { passed: this.doesRecover(contract.name) }), windows: contract.windows.length, untested: this.untestedWindows(contract.name).length })); }
}

export interface RecoveryPattern { id: string; condition: (report: VerificationReport) => boolean; label: string; recommendation: string; }
export function mineRecoveryPatterns(reports: VerificationReport[], patterns: RecoveryPattern[]): Array<{ id: string; label: string; matches: number; rate: number; recommendation: string }> { return patterns.map((pattern) => { const matches = reports.filter(pattern.condition).length; return { id: pattern.id, label: pattern.label, matches, rate: reports.length ? matches / reports.length : 0, recommendation: pattern.recommendation }; }).filter((result) => result.matches > 0).sort((a, b) => b.matches - a.matches); }
