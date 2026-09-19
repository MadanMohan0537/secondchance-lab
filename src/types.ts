export type WindowFamily = "request" | "session" | "environment";

export interface InterruptionWindow {
  id: string;
  family: WindowFamily;
  description?: string;
  enabled?: boolean;
}

export interface EffectLimit {
  effect: string;
  min?: number;
  max?: number;
  exactly?: number;
}

export interface StateAssertion {
  path: string;
  operator: "equals" | "not_equals" | "exists" | "not_exists";
  value?: unknown;
}

export interface RecoveryContract {
  version: 1;
  name: string;
  description?: string;
  action: { name: string; idempotencyKey?: string };
  windows: InterruptionWindow[];
  invariants: {
    effects: EffectLimit[];
    state?: StateAssertion[];
  };
  failureBudget: {
    safetyViolations: number;
    recoverySuccessRate: number;
    outcomeCertaintyRate: number;
  };
}

export type LintSeverity = "error" | "warning" | "info";

export interface ContractDiagnostic {
  rule: string;
  severity: LintSeverity;
  message: string;
  path: string;
  fix?: string;
}

export interface ContractCoverage {
  totalWindows: number;
  enabledWindows: number;
  coveredFamilies: WindowFamily[];
  missingFamilies: WindowFamily[];
  score: number;
  windows: Array<{ id: string; family: WindowFamily; status: "covered" | "disabled" }>;
}

export interface ContractChange {
  kind: "added" | "removed" | "changed" | "weakened" | "strengthened";
  path: string;
  before?: unknown;
  after?: unknown;
  breaking: boolean;
}

export interface FuzzCase {
  id: string;
  windowId: string;
  family: WindowFamily;
  fault: "timeout" | "disconnect" | "duplicate" | "delay" | "restart";
  timing: "before" | "during" | "after";
}

export interface Effect {
  id: string;
  runId: string;
  attemptId: string;
  type: string;
  status: "attempted" | "succeeded" | "failed" | "reversed";
  occurredAt: string;
  externalId?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export interface ObservedState {
  backend: Record<string, unknown>;
  visible: Record<string, unknown>;
}

export interface ScenarioResult {
  window: InterruptionWindow;
  runId: string;
  recovered: boolean;
  outcomeCertain: boolean;
  effects: Effect[];
  state: ObservedState;
  trace: string[];
}

export interface Violation {
  kind: "safety" | "state" | "recovery" | "certainty";
  invariant: string;
  expected: unknown;
  observed: unknown;
  windowId: string;
  evidence: string[];
}

export interface VerificationReport {
  contract: string;
  passed: boolean;
  generatedAt: string;
  summary: {
    scenarios: number;
    safetyViolations: number;
    recoverySuccessRate: number;
    outcomeCertaintyRate: number;
  };
  scenarios: Array<ScenarioResult & { violations: Violation[] }>;
  suggestions: string[];
}

export interface ScenarioContext {
  runId: string;
  window: InterruptionWindow;
  ledger: EffectLedgerPort;
  interrupt(point: string): void;
  trace(message: string): void;
}

export interface ScenarioAdapter {
  name: string;
  run(context: ScenarioContext): Promise<Omit<ScenarioResult, "runId" | "window" | "effects" | "trace">>;
}

export interface EffectLedgerPort {
  append(effect: Effect): Promise<void>;
  list(runId: string): Promise<Effect[]>;
  clear(runId?: string): Promise<void>;
}
