import { describe, expect, it } from "vitest";
import { datasetCardToKnowledge, HF_HUB_MAX_INGEST_CHARS, modelCardToKnowledge, stripYamlFrontmatter } from "../../src/hf-hub";

const dataset = {
  id: "org/dataset",
  downloads: 10,
  likes: 2,
  tags: ["language:es", "task_categories:text-generation"],
  lastModified: "2026-01-01T00:00:00.000Z",
  gated: false,
} as const;

const model = {
  id: "org/model",
  pipelineTag: "text-generation",
  downloads: 10,
  likes: 2,
  tags: ["transformers"],
  lastModified: null,
  gated: false,
} as const;

describe("HF Hub ingest → conocimiento propuesto", () => {
  it("elimina el front-matter YAML", () => {
    const card = "---\nlicense: mit\ntags:\n- a\n---\n# Título\n\nCuerpo.";
    expect(stripYamlFrontmatter(card)).toBe("# Título\n\nCuerpo.");
    expect(stripYamlFrontmatter("sin frontmatter")).toBe("sin frontmatter");
  });

  it("propone un dataset como conocimiento PENDING_REVIEW con hash determinista", () => {
    const doc = datasetCardToKnowledge(dataset, "---\nlicense: mit\n---\n# Dataset\nContenido útil.");
    expect(doc.status).toBe("PENDING_REVIEW");
    expect(doc.provenance).toBe("huggingface-hub");
    expect(doc.contentHash).toHaveLength(64);
    expect(doc.source).toBe("https://huggingface.co/datasets/org/dataset");
    expect(doc.content).not.toContain("license: mit");
    expect(doc.content).toContain("Contenido útil.");
    expect(doc.truncated).toBe(false);
  });

  it("es determinista: mismo texto → mismo id", () => {
    const a = datasetCardToKnowledge(dataset, "texto fijo");
    const b = datasetCardToKnowledge(dataset, "texto fijo");
    expect(a.id).toBe(b.id);
    expect(a.contentHash).toBe(b.contentHash);
  });

  it("trunca model cards enormes y lo declara", () => {
    const huge = "linea\n".repeat(HF_HUB_MAX_INGEST_CHARS);
    const doc = modelCardToKnowledge(model, huge);
    expect(doc.truncated).toBe(true);
    expect(doc.content).toContain("[contenido truncado]");
    expect(doc.content.length).toBeLessThanOrEqual(HF_HUB_MAX_INGEST_CHARS + 40);
  });

  it("usa un fallback honesto cuando no hay card legible", () => {
    const doc = modelCardToKnowledge(model, "   ");
    expect(doc.content).toContain("Modelo org/model");
    expect(doc.status).toBe("PENDING_REVIEW");
  });
});
