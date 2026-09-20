export interface StateGraphNode { id: string; kind: "action" | "request" | "effect" | "interruption" | "state"; label: string; evidence?: Record<string, unknown>; }
export interface StateGraphEdge { from: string; to: string; relation: "causes" | "observes" | "interrupts" | "transitions"; }

export class RecoveryStateGraph {
  readonly #nodes = new Map<string, StateGraphNode>();
  readonly #edges: StateGraphEdge[] = [];
  addNode(node: StateGraphNode): void { if (this.#nodes.has(node.id)) throw new Error(`Duplicate graph node: ${node.id}`); this.#nodes.set(node.id, structuredClone(node)); }
  connect(edge: StateGraphEdge): void { if (!this.#nodes.has(edge.from) || !this.#nodes.has(edge.to)) throw new Error(`Graph edge references an unknown node: ${edge.from} -> ${edge.to}`); if (!this.#edges.some((item) => JSON.stringify(item) === JSON.stringify(edge))) this.#edges.push(structuredClone(edge)); }
  snapshot(): { nodes: StateGraphNode[]; edges: StateGraphEdge[] } { return { nodes: [...this.#nodes.values()].map((node) => structuredClone(node)), edges: structuredClone(this.#edges) }; }
  toMermaid(): string { const lines = ["flowchart TD"]; for (const node of this.#nodes.values()) lines.push(`  ${safe(node.id)}[\"${node.label.replaceAll('"', "'")}\"]`); for (const edge of this.#edges) lines.push(`  ${safe(edge.from)} -->|${edge.relation}| ${safe(edge.to)}`); return lines.join("\n"); }
}
const safe = (id: string): string => `n_${id.replace(/[^a-zA-Z0-9_]/g, "_")}`;
