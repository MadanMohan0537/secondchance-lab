export interface RecoverableJob<T = unknown> { id: string; payload: T; maxAttempts: number; idempotencyKey?: string; }
export interface JobResult { id: string; status: "completed" | "dead-letter"; attempts: number; errors: string[]; }

export async function runRecoverableJob<T>(job: RecoverableJob<T>, handler: (job: RecoverableJob<T>, attempt: number) => Promise<void>, options: { crashAfterAttempts?: number[] } = {}): Promise<JobResult> {
  const errors: string[] = [];
  for (let attempt = 1; attempt <= job.maxAttempts; attempt++) {
    try { if (options.crashAfterAttempts?.includes(attempt)) throw new Error(`simulated worker crash on attempt ${attempt}`); await handler(structuredClone(job), attempt); return { id: job.id, status: "completed", attempts: attempt, errors }; }
    catch (error) { errors.push(error instanceof Error ? error.message : String(error)); }
  }
  return { id: job.id, status: "dead-letter", attempts: job.maxAttempts, errors };
}
