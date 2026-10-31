import { describe, expect, it } from "vitest";
import { clampHfLimit, createHfHubClient, HF_HUB_MAX_LIMIT, isSafeRepoId } from "../../src/hf-hub";

interface Recorded {
  url: string;
  headers?: Record<string, string>;
}

function fakeFetch(payload: unknown, options: { status?: number; text?: string } = {}) {
  const calls: Recorded[] = [];
  const impl = async (url: string, init?: { headers?: Record<string, string> }) => {
    calls.push(init?.headers ? { url, headers: init.headers } : { url });
    const status = options.status ?? 200;
    const body = options.text ?? JSON.stringify(payload);
    return { ok: status >= 200 && status < 300, status, text: async () => body };
  };
  return { impl, calls };
}

describe("HfHubClient", () => {
  it("construye la URL del catálogo con filtro, búsqueda y límite", async () => {
    const { impl, calls } = fakeFetch([{ id: "org/model", pipeline_tag: "text-generation", downloads: 5, likes: 1, tags: ["a"] }]);
    const client = createHfHubClient({}, { fetchImpl: impl });
    const models = await client.listModels({ task: "text-generation", search: "qwen", limit: 3 });
    expect(calls[0]?.url).toContain("/api/models?");
    expect(calls[0]?.url).toContain("filter=text-generation");
    expect(calls[0]?.url).toContain("search=qwen");
    expect(calls[0]?.url).toContain("limit=3");
    expect(models).toHaveLength(1);
    expect(models[0]?.id).toBe("org/model");
    expect(models[0]?.pipelineTag).toBe("text-generation");
  });

  it("envía el bearer solo cuando hay HF_TOKEN", async () => {
    const withToken = fakeFetch([]);
    await createHfHubClient({ HF_TOKEN: "hf_test" }, { fetchImpl: withToken.impl }).listModels();
    expect(withToken.calls[0]?.headers?.authorization).toBe("Bearer hf_test");

    const without = fakeFetch([]);
    await createHfHubClient({}, { fetchImpl: without.impl }).listModels();
    expect(without.calls[0]?.headers?.authorization).toBeUndefined();
  });

  it("falla cerrado ante HTTP distinto de 2xx", async () => {
    const { impl } = fakeFetch({}, { status: 402, text: "" });
    await expect(createHfHubClient({}, { fetchImpl: impl }).listDatasets()).rejects.toThrow("HF_HUB_HTTP_402");
  });

  it("rechaza ids de repo inseguros", async () => {
    const { impl } = fakeFetch({});
    await expect(createHfHubClient({}, { fetchImpl: impl }).getModel("../../etc/passwd")).rejects.toThrow("HF_HUB_UNSAFE_REPO_ID");
    expect(isSafeRepoId("squad")).toBe(false);
    expect(isSafeRepoId("huggingface/documentation-images")).toBe(true);
  });

  it("acota el texto de un archivo a maxFileBytes", async () => {
    const { impl, calls } = fakeFetch({}, { text: "0123456789ABCDEF" });
    const client = createHfHubClient({}, { fetchImpl: impl, maxFileBytes: 4 });
    const text = await client.getFileText({ repo: "org/data", repoType: "datasets", path: "README.md" });
    expect(calls[0]?.url).toBe("https://huggingface.co/datasets/org/data/resolve/main/README.md");
    expect(text).toBe("0123");
  });

  it("acota el límite entre 1 y el máximo", () => {
    expect(clampHfLimit(undefined)).toBe(12);
    expect(clampHfLimit(0)).toBe(1);
    expect(clampHfLimit(9999)).toBe(HF_HUB_MAX_LIMIT);
    expect(clampHfLimit(7.9)).toBe(7);
  });
});
