export interface GenesisModuleDescriptor {
  id: string;
  version: string;
  domain: "cognition" | "memory" | "trust" | "quantum" | "territory" | "infrastructure";
  capabilities: readonly string[];
}

export class GenesisModuleRegistry {
  private readonly modules = new Map<string, GenesisModuleDescriptor>();

  register(module: GenesisModuleDescriptor): void {
    if (this.modules.has(module.id)) throw new Error(`MODULES: duplicate module ${module.id}`);
    this.modules.set(module.id, Object.freeze({ ...module, capabilities: Object.freeze([...module.capabilities]) }));
  }

  get(id: string): GenesisModuleDescriptor {
    const module = this.modules.get(id);
    if (!module) throw new Error(`MODULES: unknown module ${id}`);
    return module;
  }

  list(): readonly GenesisModuleDescriptor[] { return [...this.modules.values()]; }
}
