import { MemoryEffectLedger } from "./ledger.js";
import { verify } from "./verifier.js";
import type { EffectLedgerPort, RecoveryContract, ScenarioAdapter, ScenarioResult, VerificationReport } from "./types.js";

export interface RunOptions { ledger?: EffectLedgerPort; windowIds?: string[]; concurrency?: number; }

export async function runRecoveryContract(contract: RecoveryContract, adapter: ScenarioAdapter, options: RunOptions = {}): Promise<VerificationReport> {
  const ledger = options.ledger ?? new MemoryEffectLedger();
  const windows = contract.windows.filter((w) => w.enabled !== false && (!options.windowIds || options.windowIds.includes(w.id)));
  if (windows.length === 0) throw new Error("No enabled interruption windows selected");
  const concurrency = options.concurrency ?? 1;
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 10) throw new Error("concurrency must be between 1 and 10");
  const results: ScenarioResult[] = [];
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, windows.length) }, async () => {
    while (cursor < windows.length) {
      const window = windows[cursor++]; if (!window) return;
      const runId = crypto.randomUUID(); const trace: string[] = []; let armed = true;
      const base = await adapter.run({ runId, window, ledger, trace: (message) => trace.push(message), interrupt: (point) => { if (armed && point === window.id) { armed = false; trace.push(`INTERRUPTED:${point}`); throw new Interruption(point); } } }).catch((error) => {
        if (error instanceof Interruption) return { recovered: false, outcomeCertain: false, state: { backend: {}, visible: { error: `interrupted at ${error.point}` } } };
        throw error;
      });
      results.push({ ...base, runId, window, effects: await ledger.list(runId), trace });
    }
  }));
  results.sort((a, b) => windows.findIndex((w) => w.id === a.window.id) - windows.findIndex((w) => w.id === b.window.id));
  return verify(contract, results);
}

class Interruption extends Error { constructor(readonly point: string) { super(`Interrupted at ${point}`); } }
