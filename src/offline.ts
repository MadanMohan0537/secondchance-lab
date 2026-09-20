export interface VersionedValue<T> { value: T; version: number; updatedAt: string; actor: string; }
export type ConflictStrategy<T> = "server-wins" | "client-wins" | ((client: VersionedValue<T>, server: VersionedValue<T>) => VersionedValue<T>);
export interface Reconciliation<T> { value: VersionedValue<T>; conflict: boolean; resolution: "unchanged" | "client" | "server" | "custom"; }

export function reconcileOfflineState<T>(client: VersionedValue<T>, server: VersionedValue<T>, strategy: ConflictStrategy<T>): Reconciliation<T> {
  if (client.version > server.version) return { value: structuredClone(client), conflict: false, resolution: "client" };
  if (server.version > client.version) return { value: structuredClone(server), conflict: false, resolution: "server" };
  if (JSON.stringify(client.value) === JSON.stringify(server.value)) return { value: structuredClone(server), conflict: false, resolution: "unchanged" };
  if (strategy === "client-wins") return { value: structuredClone(client), conflict: true, resolution: "client" };
  if (strategy === "server-wins") return { value: structuredClone(server), conflict: true, resolution: "server" };
  return { value: structuredClone(strategy(client, server)), conflict: true, resolution: "custom" };
}
