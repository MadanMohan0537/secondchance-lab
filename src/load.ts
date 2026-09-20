export interface LoadSample<T = unknown> { index: number; ok: boolean; durationMs: number; value?: T; error?: string; }
export interface LoadReport<T = unknown> { requested: number; completed: number; failed: number; p50Ms: number; p95Ms: number; samples: LoadSample<T>[]; }

export async function runInterruptedLoad<T>(users: number, concurrency: number, scenario: (index: number) => Promise<T>): Promise<LoadReport<T>> {
  if (!Number.isSafeInteger(users) || users < 1 || !Number.isSafeInteger(concurrency) || concurrency < 1) throw new Error("users and concurrency must be positive integers");
  const samples: LoadSample<T>[] = new Array(users); let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(users, concurrency) }, async () => { while (cursor < users) { const index = cursor++; const start = performance.now(); try { samples[index] = { index, ok: true, durationMs: performance.now() - start, value: await scenario(index) }; } catch (error) { samples[index] = { index, ok: false, durationMs: performance.now() - start, error: error instanceof Error ? error.message : String(error) }; } } }));
  const durations = samples.map((sample) => sample.durationMs).sort((a, b) => a - b); const percentile = (p: number): number => durations[Math.min(durations.length - 1, Math.floor(durations.length * p))] ?? 0;
  return { requested: users, completed: samples.filter((sample) => sample.ok).length, failed: samples.filter((sample) => !sample.ok).length, p50Ms: percentile(0.5), p95Ms: percentile(0.95), samples };
}
