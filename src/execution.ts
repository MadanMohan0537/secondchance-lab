export type FaultKind = "timeout" | "disconnect" | "duplicate" | "delay" | "drop" | "restart" | "reorder";
export interface FaultPlan { at: string; kind: FaultKind; delayMs?: number; repeat?: number; }
export interface ExecutionRequest<T = unknown> { id: string; operation: string; payload: T; idempotencyKey?: string; }
export interface ExecutionResponse<T = unknown> { requestId: string; status: number; body?: T; attempts: number; ambiguous: boolean; trace: string[]; }
export interface ExecutionTransport<TInput = unknown, TOutput = unknown> { send(request: ExecutionRequest<TInput>): Promise<{ status: number; body?: TOutput }>; }

export async function executeWithFaults<TInput, TOutput>(transport: ExecutionTransport<TInput, TOutput>, request: ExecutionRequest<TInput>, faults: FaultPlan[]): Promise<ExecutionResponse<TOutput>> {
  const trace: string[] = []; let attempts = 0; let last: { status: number; body?: TOutput } | undefined;
  const has = (at: string, kind: FaultKind): FaultPlan | undefined => faults.find((fault) => fault.at === at && fault.kind === kind);
  if (has("before_send", "disconnect") || has("before_send", "drop")) return { requestId: request.id, status: 0, attempts, ambiguous: false, trace: ["request blocked before transmission"] };
  const duplicate = has("after_send", "duplicate"); const total = duplicate?.repeat ?? (duplicate ? 2 : 1);
  for (let index = 0; index < total; index++) { attempts++; trace.push(`attempt ${attempts} sent`); last = await transport.send(structuredClone(request)); trace.push(`attempt ${attempts} returned ${last.status}`); }
  const delay = has("after_send", "delay"); const delayMs = delay?.delayMs; if (delayMs !== undefined) await new Promise((resolve) => setTimeout(resolve, Math.min(delayMs, 100)));
  if (has("after_send", "timeout") || has("after_commit", "disconnect") || has("after_commit", "drop")) { trace.push("acknowledgement lost after transmission"); return { requestId: request.id, status: 0, attempts, ambiguous: true, trace }; }
  return { requestId: request.id, status: last?.status ?? 0, ...(last?.body === undefined ? {} : { body: last.body }), attempts, ambiguous: false, trace };
}

export interface RuntimeAdapter<T> { name: string; execute(): Promise<T>; }
export async function runRuntimeMatrix<T>(adapters: RuntimeAdapter<T>[], concurrency = adapters.length || 1): Promise<Array<{ runtime: string; ok: boolean; result?: T; error?: string }>> {
  const output: Array<{ runtime: string; ok: boolean; result?: T; error?: string }> = new Array(adapters.length); let cursor = 0;
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, adapters.length)) }, async () => { while (cursor < adapters.length) { const index = cursor++; const adapter = adapters[index]!; try { output[index] = { runtime: adapter.name, ok: true, result: await adapter.execute() }; } catch (error) { output[index] = { runtime: adapter.name, ok: false, error: error instanceof Error ? error.message : String(error) }; } } }));
  return output;
}
