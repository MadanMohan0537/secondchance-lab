import { appendFile, mkdir, readFile, rm } from "node:fs/promises";
import { dirname } from "node:path";
import type { Effect, EffectLedgerPort } from "./types.js";

export class MemoryEffectLedger implements EffectLedgerPort {
  private effects: Effect[] = [];
  async append(effect: Effect): Promise<void> { validateEffect(effect); this.effects.push(structuredClone(effect)); }
  async list(runId: string): Promise<Effect[]> { return this.effects.filter((e) => e.runId === runId).map((e) => structuredClone(e)); }
  async clear(runId?: string): Promise<void> { this.effects = runId ? this.effects.filter((e) => e.runId !== runId) : []; }
}

export class JsonlEffectLedger implements EffectLedgerPort {
  constructor(private readonly path: string) {}
  async append(effect: Effect): Promise<void> { validateEffect(effect); await mkdir(dirname(this.path), { recursive: true }); await appendFile(this.path, `${JSON.stringify(effect)}\n`, { encoding: "utf8", mode: 0o600 }); }
  async list(runId: string): Promise<Effect[]> {
    try { return (await readFile(this.path, "utf8")).split("\n").filter(Boolean).map((line) => JSON.parse(line) as Effect).filter((e) => e.runId === runId); }
    catch (error: any) { if (error?.code === "ENOENT") return []; throw error; }
  }
  async clear(): Promise<void> { await rm(this.path, { force: true }); }
}

export function effect(input: Omit<Effect, "id" | "occurredAt"> & Partial<Pick<Effect, "id" | "occurredAt">>): Effect {
  return { ...input, id: input.id ?? crypto.randomUUID(), occurredAt: input.occurredAt ?? new Date().toISOString() };
}

function validateEffect(value: Effect): void {
  for (const field of ["id", "runId", "attemptId", "type", "occurredAt"] as const) if (!value[field]) throw new Error(`Effect ${field} is required`);
  if (!Number.isFinite(Date.parse(value.occurredAt))) throw new Error("Effect occurredAt must be an ISO timestamp");
}
