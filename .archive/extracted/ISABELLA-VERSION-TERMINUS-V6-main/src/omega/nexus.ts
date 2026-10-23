// Ω∞-22 Isabella Nexus (state: draft | engine-generated).
// View-model de la consola Nexus que agrega los tableros Ω∞ en una sola vista.
// Es un modelo de vista explicable: no autoriza, no ejecuta y no transfiere capacidad.
// Requiere revisión humana antes de cualquier estado "verified".

export const NEXUS_PANELS = [
  "constitution",
  "simulation",
  "capital",
  "civilization",
  "trust",
  "memory",
  "twins",
  "territory",
] as const;

export interface NexusPanel {
  id: string;
  label: string;
}

export interface NexusView {
  title: string;
  panelCount: number;
  panels: NexusPanel[];
}

function panelLabel(id: string): string {
  return id.replaceAll("_", " ").replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

export function buildNexusView(input?: { title?: string }): NexusView {
  const title = input?.title || "Isabella Nexus Ω∞";
  const panels: NexusPanel[] = NEXUS_PANELS.map((id) => ({
    id,
    label: panelLabel(id),
  }));
  return {
    title,
    panelCount: panels.length,
    panels,
  };
}
