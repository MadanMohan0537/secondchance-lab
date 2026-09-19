import type { ContractChange, EffectLimit, RecoveryContract } from "./types.js";

export function diffContracts(before: RecoveryContract, after: RecoveryContract): ContractChange[] {
  const changes: ContractChange[] = [];
  compareByKey(before.windows, after.windows, "id", "windows", changes);
  compareEffects(before.invariants.effects, after.invariants.effects, changes);
  compareByKey(before.invariants.state ?? [], after.invariants.state ?? [], "path", "invariants.state", changes);

  for (const key of ["safetyViolations", "recoverySuccessRate", "outcomeCertaintyRate"] as const) {
    const a = before.failureBudget[key]; const b = after.failureBudget[key];
    if (a === b) continue;
    const weakened = key === "safetyViolations" ? b > a : b < a;
    changes.push({ kind: weakened ? "weakened" : "strengthened", path: `failureBudget.${key}`, before: a, after: b, breaking: weakened });
  }
  return changes;
}

function compareByKey<T, K extends keyof T>(before: T[], after: T[], key: K, prefix: string, changes: ContractChange[]): void {
  const left = new Map(before.map((item) => [String(item[key]), item]));
  const right = new Map(after.map((item) => [String(item[key]), item]));
  for (const [id, value] of left) {
    if (!right.has(id)) changes.push({ kind: "removed", path: `${prefix}.${id}`, before: value, breaking: true });
    else if (JSON.stringify(value) !== JSON.stringify(right.get(id))) changes.push({ kind: "changed", path: `${prefix}.${id}`, before: value, after: right.get(id), breaking: false });
  }
  for (const [id, value] of right) if (!left.has(id)) changes.push({ kind: "added", path: `${prefix}.${id}`, after: value, breaking: false });
}

function compareEffects(before: EffectLimit[], after: EffectLimit[], changes: ContractChange[]): void {
  const left = new Map(before.map((effect) => [effect.effect, effect]));
  const right = new Map(after.map((effect) => [effect.effect, effect]));
  for (const [effect, value] of left) {
    const next = right.get(effect);
    if (!next) { changes.push({ kind: "removed", path: `invariants.effects.${effect}`, before: value, breaking: true }); continue; }
    if (JSON.stringify(value) !== JSON.stringify(next)) changes.push({ kind: isWeaker(value, next) ? "weakened" : "changed", path: `invariants.effects.${effect}`, before: value, after: next, breaking: isWeaker(value, next) });
  }
  for (const [effect, value] of right) if (!left.has(effect)) changes.push({ kind: "added", path: `invariants.effects.${effect}`, after: value, breaking: false });
}

function isWeaker(before: EffectLimit, after: EffectLimit): boolean {
  if (before.exactly !== undefined && after.exactly === undefined) return true;
  if ((after.max ?? Infinity) > (before.max ?? before.exactly ?? Infinity)) return true;
  return (after.min ?? after.exactly ?? 0) < (before.min ?? before.exactly ?? 0);
}
