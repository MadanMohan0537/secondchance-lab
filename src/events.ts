export interface RecoverableEvent<T = unknown> { id: string; sequence: number; type: string; payload: T; occurredAt: string; }
export interface EventOutcome { id: string; disposition: "processed" | "duplicate" | "buffered" | "failed"; message?: string; }

export class OrderedEventProcessor<T = unknown> {
  readonly #seen = new Set<string>(); readonly #buffer = new Map<number, RecoverableEvent<T>>(); #nextSequence: number;
  constructor(startSequence = 1, private readonly handler: (event: RecoverableEvent<T>) => Promise<void>) { this.#nextSequence = startSequence; }
  async accept(event: RecoverableEvent<T>): Promise<EventOutcome[]> {
    if (this.#seen.has(event.id)) return [{ id: event.id, disposition: "duplicate" }];
    if (event.sequence < this.#nextSequence) { this.#seen.add(event.id); return [{ id: event.id, disposition: "duplicate", message: "sequence already committed" }]; }
    if (event.sequence > this.#nextSequence) { this.#buffer.set(event.sequence, structuredClone(event)); return [{ id: event.id, disposition: "buffered", message: `waiting for sequence ${this.#nextSequence}` }]; }
    const outcomes: EventOutcome[] = []; let current: RecoverableEvent<T> | undefined = event;
    while (current) { const processing = current; try { await this.handler(structuredClone(processing)); this.#seen.add(processing.id); outcomes.push({ id: processing.id, disposition: "processed" }); this.#nextSequence++; current = this.#buffer.get(this.#nextSequence); if (current) this.#buffer.delete(this.#nextSequence); } catch (error) { outcomes.push({ id: processing.id, disposition: "failed", message: error instanceof Error ? error.message : String(error) }); break; } }
    return outcomes;
  }
  pending(): RecoverableEvent<T>[] { return [...this.#buffer.values()].sort((a, b) => a.sequence - b.sequence).map((event) => structuredClone(event)); }
}

export function mutateEventDelivery<T>(events: RecoverableEvent<T>[], options: { duplicateIds?: string[]; dropIds?: string[]; reverse?: boolean }): RecoverableEvent<T>[] {
  const dropped = new Set(options.dropIds ?? []); const duplicated = new Set(options.duplicateIds ?? []); const output: RecoverableEvent<T>[] = [];
  for (const event of events) { if (dropped.has(event.id)) continue; output.push(structuredClone(event)); if (duplicated.has(event.id)) output.push(structuredClone(event)); }
  return options.reverse ? output.reverse() : output;
}
