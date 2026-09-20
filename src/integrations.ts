import type { RecoveryContract } from "./types.js";
import { contractFromNaturalLanguage } from "./natural-language.js";

export interface FeatureFlagVariant { flag: string; value: string | boolean; atWindow: string; }
export interface FeatureFlagPlan { variants: FeatureFlagVariant[]; restoreAfterRun: boolean; }
export function expandFeatureFlagPlan(plan: FeatureFlagPlan): Array<{ id: string; flags: Record<string, string | boolean>; window: string }> { return plan.variants.map((variant, index) => ({ id: `${variant.flag}:${variant.value}:${index}`, flags: { [variant.flag]: variant.value }, window: variant.atWindow })); }

export interface MockRule { operation: string; attempt?: number; response: { status: number; body?: unknown; delayMs?: number; drop?: boolean }; }
export class RecoveryAwareMock {
  readonly #calls = new Map<string, number>();
  constructor(private readonly rules: MockRule[], private readonly fallback: MockRule["response"] = { status: 200 }) {}
  async handle(operation: string): Promise<MockRule["response"]> { const attempt = (this.#calls.get(operation) ?? 0) + 1; this.#calls.set(operation, attempt); const response = this.rules.find((rule) => rule.operation === operation && (rule.attempt === undefined || rule.attempt === attempt))?.response ?? this.fallback; const delayMs = response.delayMs; if (delayMs) await new Promise((resolve) => setTimeout(resolve, Math.min(delayMs, 100))); return structuredClone(response); }
  calls(operation: string): number { return this.#calls.get(operation) ?? 0; }
}

export interface RecoveryComponentContract { component: "status-center" | "resume-banner" | "draft-autosave" | "retry-control"; requiredStates: string[]; accessibility: { liveRegion?: boolean; keyboardReachable: boolean; }; }
export const recoveryComponents: RecoveryComponentContract[] = [
  { component: "status-center", requiredStates: ["pending", "succeeded", "failed", "unknown"], accessibility: { liveRegion: true, keyboardReachable: true } },
  { component: "resume-banner", requiredStates: ["resumable", "expired"], accessibility: { keyboardReachable: true } },
  { component: "draft-autosave", requiredStates: ["saving", "saved", "conflict"], accessibility: { liveRegion: true, keyboardReachable: true } },
  { component: "retry-control", requiredStates: ["safe-to-retry", "checking-status", "blocked"], accessibility: { keyboardReachable: true } }
];

export function recoveryPlaybook(contract: RecoveryContract): string {
  const effects = contract.invariants.effects.map((effect) => `- Confirm \`${effect.effect}\` satisfies ${effect.exactly !== undefined ? `exactly ${effect.exactly}` : `min ${effect.min ?? 0}, max ${effect.max ?? "unbounded"}`}.`);
  return [`# Recovery playbook: ${contract.name}`, "", `Action: **${contract.action.name}**`, "", "## If the outcome is unclear", "1. Do not repeat an irreversible action immediately.", "2. Check the authoritative status using the operation or intent identifier.", "3. Resume only when the status permits it.", "4. Escalate with the evidence identifier if status remains unknown.", "", "## Verification", ...effects].join("\n");
}

export interface ProductionIncident { title: string; flow: string; symptom: string; stack?: string; tags?: string[]; }
export function incidentToRecoveryContract(incident: ProductionIncident): { contract: RecoveryContract; source: ProductionIncident; questions: string[] } { const generated = contractFromNaturalLanguage(`${incident.flow}. ${incident.symptom}`); return { contract: generated.contract, source: structuredClone(incident), questions: generated.questions }; }

export interface EditorDiagnostic { file: string; line: number; severity: "error" | "warning" | "info"; message: string; rule: string; }
export interface BrowserInterruptionPreset { id: string; label: string; fault: "offline" | "timeout" | "reload" | "duplicate"; boundary: string; }
export const browserInterruptionPresets: BrowserInterruptionPreset[] = [
  { id: "timeout-after-send", label: "Timeout after request send", fault: "timeout", boundary: "after_send" },
  { id: "duplicate-submit", label: "Duplicate form submission", fault: "duplicate", boundary: "after_send" },
  { id: "reload-before-render", label: "Reload before confirmation", fault: "reload", boundary: "before_render" },
  { id: "offline-during-save", label: "Go offline during save", fault: "offline", boundary: "during_request" }
];
