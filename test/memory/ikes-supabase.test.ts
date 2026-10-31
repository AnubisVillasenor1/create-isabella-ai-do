import { afterEach, describe, expect, it, vi } from "vitest";
import { SupabaseIkesPersistence } from "../../src/memory/ikes-supabase";

afterEach(() => vi.restoreAllMocks());

describe("Supabase IKES persistence adapter", () => {
  const config = {
    supabaseUrl: "https://example.supabase.co/",
    serviceRoleKey: "server-only-test-key",
    requestTimeoutMs: 1000,
  };

  it("loads source and claim rows into the canonical IKES shape", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify([{
        source_id: "src-1",
        uri: "https://example.org/source",
        title: "Source",
        publisher: null,
        published_at: null,
        retrieved_at: "2026-10-17T00:00:00.000Z",
        content_hash: "a".repeat(64),
        license: "CC-BY-4.0",
      }]), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{
        claim_id: "clm_1",
        subject: "Isabella",
        predicate: "hasModule",
        object_value: "IKES",
        source_ids: ["src-1"],
        evidence_ids: ["src-1"],
        epistemic_state: "E1_SOURCE_FOUND",
        temporal_state: "current",
        valid_from: null,
        valid_until: null,
        license: "CC-BY-4.0",
        provenance: { origin: "test" },
        content_hash: "b".repeat(64),
        version: 1,
      }]), { status: 200, headers: { "content-type": "application/json" } }));

    const snapshot = await new SupabaseIkesPersistence(config).load();
    expect(snapshot.sources[0]?.sourceId).toBe("src-1");
    expect(snapshot.claims[0]?.object).toBe("IKES");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/rest/v1/atlas_knowledge_sources?");
    expect((fetchMock.mock.calls[0]?.[1]?.headers as Headers).get("authorization")).toBe("Bearer server-only-test-key");
  });

  it("upserts source and claim rows without expecting a response body", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 201 }));
    const persistence = new SupabaseIkesPersistence(config);

    await persistence.saveSource({
      sourceId: "src-2",
      uri: "https://example.org/source",
      title: "Source 2",
      retrievedAt: "2026-10-17T00:00:00.000Z",
      contentHash: "c".repeat(64),
    });
    await persistence.saveClaim({
      claimId: "clm_2",
      subject: "Isabella",
      predicate: "hasModule",
      object: "IKES",
      sourceIds: ["src-2"],
      evidenceIds: ["src-2"],
      epistemicState: "E1_SOURCE_FOUND",
      temporalState: "current",
      provenance: {},
      contentHash: "d".repeat(64),
      version: 1,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("on_conflict=source_id");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("on_conflict=claim_id");
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("POST");
  });

  it("reports missing persistence tables without leaking the provider response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("private database detail", { status: 404 }),
    );
    const result = await new SupabaseIkesPersistence(config).health();
    expect(result.healthy).toBe(false);
    expect(result.reason).toContain("HTTP 404");
    expect(result.reason).not.toContain("private database detail");
  });
});
