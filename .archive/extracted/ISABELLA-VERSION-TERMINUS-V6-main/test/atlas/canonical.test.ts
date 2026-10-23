import { describe, expect, it } from "vitest";
import {
  createCanonicalDocument,
  versionDocument,
  changeDocumentState,
  buildDocumentUid,
  canonicalizeDocument,
  hashCanonicalDocument,
  allowDocumentTransition,
  type DocumentInput,
} from "../../src/atlas";
import { buildAtlasEvent, isKnownAtlasEventType, idempotencyKey, ATLAS_EVENT_TYPES } from "../../src/atlas";

const doc: DocumentInput = {
  federation: "F2",
  namespace: "KNOW",
  title: "Atlas Trascendence",
  content: "Manifiesto   con   espacios",
  metadata: { b: 2, a: 1 },
};

describe("Atlas canonical documents", () => {
  it("canonicalizes content and sorts metadata keys", () => {
    const canonical = canonicalizeDocument(doc);
    expect(canonical.content).toBe("Manifiesto con espacios");
    expect(Object.keys(canonical.metadata)).toEqual(["a", "b"]);
    expect(hashCanonicalDocument(canonical)).toHaveLength(64);
  });

  it("rejects invalid federation and namespace", () => {
    expect(() => canonicalizeDocument({ ...doc, federation: "F9" })).toThrow();
    expect(() => canonicalizeDocument({ ...doc, namespace: "know" })).toThrow();
  });

  it("builds a canonical document_uid", () => {
    const record = createCanonicalDocument(doc);
    expect(record.documentUid).toMatch(/^ATLAS-DOC-F2-KNOW-[0-9A-Z]{26}-[0-9a-f]{8}$/);
    expect(record.state).toBe("draft");
    expect(record.version).toBe(1);
  });

  it("versions documents and rejects no-op changes", () => {
    const record = createCanonicalDocument(doc);
    const { record: v2, change } = versionDocument(record, { ...doc, content: "contenido nuevo" });
    expect(v2.version).toBe(2);
    expect(change.newVersion).toBe(2);
    expect(() => versionDocument(record, doc)).toThrow();
  });

  it("enforces allowed state transitions", () => {
    const record = createCanonicalDocument(doc);
    expect(allowDocumentTransition("draft", "validated")).toBe(true);
    expect(allowDocumentTransition("archived", "draft")).toBe(false);
    const { record: validated } = changeDocumentState(record, "validated", "ok");
    expect(validated.state).toBe("validated");
    expect(() => changeDocumentState(record, "published", "skip")).toThrow();
  });

  it("builds deterministic UIDs for a fixed ULID", () => {
    const uid = buildDocumentUid({ federation: "F1", namespace: "SEC", canonicalHash: "a".repeat(64), ulid: "0".repeat(26) });
    expect(uid).toBe(`ATLAS-DOC-F1-SEC-${"0".repeat(26)}-aaaaaaaa`);
  });
});

describe("Atlas canonical events", () => {
  it("exposes exactly 15 event types", () => {
    expect(ATLAS_EVENT_TYPES).toHaveLength(15);
    expect(isKnownAtlasEventType("documents.created")).toBe(true);
    expect(isKnownAtlasEventType("nope")).toBe(false);
  });

  it("validates required payload fields", () => {
    expect(() => buildAtlasEvent("documents.created", {} as never)).toThrow(/missing required fields/);
    const event = buildAtlasEvent("documents.created", {
      document_uid: "ATLAS-DOC-F2-KNOW-1-abc",
      federation_id: "F2",
      namespace: "KNOW",
      title: "t",
      created_by: "u1",
      version: 1,
      canonical_hash: "h",
    });
    expect(event.event_id).toBeTruthy();
    expect(event.idempotency_key).toHaveLength(64);
  });

  it("is idempotent by content", () => {
    const payload = { document_uid: "d", old_state: "draft", new_state: "validated", reason: "r" };
    expect(idempotencyKey("documents.state_changed", payload)).toBe(idempotencyKey("documents.state_changed", payload));
  });
});
