import type { RecoveryContract } from "./types.js";
import { validateContract } from "./contract.js";

export interface ContractTemplate {
  namespace: string;
  name: string;
  version: string;
  description: string;
  contract: RecoveryContract;
  tags: string[];
  digest?: string;
}

export class InMemoryContractRegistry {
  readonly #templates = new Map<string, ContractTemplate>();

  publish(template: ContractTemplate): void {
    validateTemplate(template);
    const key = templateKey(template.namespace, template.name, template.version);
    if (this.#templates.has(key)) throw new Error(`Template already exists: ${key}`);
    this.#templates.set(key, structuredClone(template));
  }

  get(reference: string): ContractTemplate {
    const exact = this.#templates.get(reference);
    if (!exact) throw new Error(`Unknown contract template: ${reference}`);
    return structuredClone(exact);
  }

  search(query: string): ContractTemplate[] {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return [...this.#templates.values()].filter((template) => {
      const haystack = [template.namespace, template.name, template.description, ...template.tags].join(" ").toLowerCase();
      return terms.every((term) => haystack.includes(term));
    }).map((template) => structuredClone(template));
  }

  list(): ContractTemplate[] { return [...this.#templates.values()].map((template) => structuredClone(template)); }
}

export function templateKey(namespace: string, name: string, version: string): string { return `${namespace}/${name}@${version}`; }

function validateTemplate(template: ContractTemplate): void {
  if (!template.namespace.trim() || !template.name.trim() || !/^\d+\.\d+\.\d+$/.test(template.version)) throw new Error("Template requires namespace, name, and a semantic version");
  validateContract(template.contract);
}
