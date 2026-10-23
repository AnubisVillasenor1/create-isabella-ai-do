// Ω∞-22 Isabella Nexus — view-model de navegador (ESM sin dependencias).

export const NEXUS_PANELS = [
  "constitution",
  "simulation",
  "capital",
  "civilization",
  "trust",
  "memory",
  "twins",
  "territory",
];

function panelLabel(id) {
  return id
    .replaceAll("_", " ")
    .replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

export function buildNexusView(input = {}) {
  const panels = NEXUS_PANELS.map((id) => ({ id, label: panelLabel(id) }));
  return {
    title: input.title || "Isabella Nexus Ω∞",
    panelCount: panels.length,
    panels,
  };
}
