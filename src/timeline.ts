export interface TimelineSnapshot<TState = unknown> {
  sequence: number;
  label: string;
  capturedAt: string;
  state: TState;
  metadata?: Record<string, unknown>;
}

export class TimeTravelTimeline<TState = unknown> {
  readonly #snapshots: TimelineSnapshot<TState>[] = [];
  #cursor = -1;

  capture(label: string, state: TState, metadata?: Record<string, unknown>): TimelineSnapshot<TState> {
    const snapshot: TimelineSnapshot<TState> = { sequence: this.#snapshots.length, label, capturedAt: new Date().toISOString(), state: structuredClone(state), ...(metadata ? { metadata: structuredClone(metadata) } : {}) };
    this.#snapshots.push(snapshot); this.#cursor = snapshot.sequence;
    return structuredClone(snapshot);
  }

  current(): TimelineSnapshot<TState> | undefined { return this.#cursor < 0 ? undefined : structuredClone(this.#snapshots[this.#cursor]); }
  stepBack(): TimelineSnapshot<TState> | undefined { if (this.#cursor > 0) this.#cursor--; return this.current(); }
  stepForward(): TimelineSnapshot<TState> | undefined { if (this.#cursor < this.#snapshots.length - 1) this.#cursor++; return this.current(); }
  seek(sequence: number): TimelineSnapshot<TState> { if (!Number.isInteger(sequence) || sequence < 0 || sequence >= this.#snapshots.length) throw new Error(`Unknown timeline sequence: ${sequence}`); this.#cursor = sequence; return this.current()!; }
  export(): TimelineSnapshot<TState>[] { return structuredClone(this.#snapshots); }
}
