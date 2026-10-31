import { describe, expect, it } from "vitest";
import { IsabellaGenesisRuntime } from "../../src/genesis/runtime";
import type { DocumentSealManifest } from "../../src/security/document-seal";

const ctx = { requestId: "r-1", traceId: "t-1", principalId: "admin", role: "admin", policyVersion: "v1" };

function payload(): Uint8Array {
  return new Uint8Array(Buffer.from("Acta de la federación TAMV", "utf8"));
}

describe("IGDS Document Seal — runtime integration", () => {
  it("sella un documento y lo verifica con la llave pública del manifiesto", async () => {
    const runtime = new IsabellaGenesisRuntime();
    const manifest = await runtime.sealDocument({
      document: { id: "doc-1", title: "Acta", mediaType: "text/plain", language: "es" },
      bytes: payload(),
    });
    expect(manifest.schema).toBe("igds.document-seal.v1");
    expect(manifest.signature.algorithm).toBe("Ed25519");

    const report = await runtime.verifyDocumentSeal({
      manifest,
      bytes: payload(),
      publicKeyPem: manifest.signer.publicKeyPem,
    });
    expect(report.valid).toBe(true);
    expect(report.integrity).toBe("valid");
    expect(report.signature).toBe("valid");
    expect(report.timestamp).toBe("unsupported");
    expect(report.registry).toBe("not_checked");
  });

  it("falla cerrado cuando el contenido fue manipulado", async () => {
    const runtime = new IsabellaGenesisRuntime();
    const manifest = await runtime.sealDocument({ document: { id: "doc-2", title: "Acta" }, bytes: payload() });
    const report = await runtime.verifyDocumentSeal({
      manifest,
      bytes: new Uint8Array(Buffer.from("contenido falsificado", "utf8")),
      publicKeyPem: manifest.signer.publicKeyPem,
    });
    expect(report.valid).toBe(false);
    expect(report.integrity).toBe("invalid");
    expect(report.issues.length).toBeGreaterThan(0);
  });

  it("reutiliza una llave estable y declara su estado honesto", async () => {
    const runtime = new IsabellaGenesisRuntime();
    const first = await runtime.sealDocument({ document: { id: "d1", title: "A" }, bytes: payload() });
    const second = await runtime.sealDocument({ document: { id: "d2", title: "B" }, bytes: payload() });
    expect(first.signer.keyId).toBe(second.signer.keyId);

    const enablement = runtime.documentSealEnablement();
    expect(enablement.implemented).toContain("ed25519-signature");
    expect(enablement.unsupported.map((item) => item.feature)).toContain("rfc3161-timestamp");
  });

  it("registra las capacidades del sello en el registro HSF", () => {
    const runtime = new IsabellaGenesisRuntime();
    const ids = runtime.capabilities.list().map((capability) => capability.id);
    expect(ids).toContain("hsf.security.document-seal");
    expect(ids).toContain("hsf.security.document-seal.verify");
  });

  it("expone sellar/verificar a través del gateway HSF con contenido base64", async () => {
    const runtime = new IsabellaGenesisRuntime();
    const contentBase64 = Buffer.from("hola", "utf8").toString("base64");

    const sealer = runtime.capabilities.get("hsf.security.document-seal");
    const manifest = (await sealer.execute(
      { document: { id: "cap-1", title: "Cap" }, contentBase64 },
      ctx,
    )) as DocumentSealManifest;
    expect(manifest.sealId.startsWith("SHA-ISABELLA-GENESIS-256-ED25519-")).toBe(true);

    const verifier = runtime.capabilities.get("hsf.security.document-seal.verify");
    const report = (await verifier.execute(
      { manifest, contentBase64, publicKeyPem: manifest.signer.publicKeyPem },
      ctx,
    )) as { valid: boolean };
    expect(report.valid).toBe(true);
  });

  it("publica eventos MAGPIE al sellar y al verificar", async () => {
    const runtime = new IsabellaGenesisRuntime();
    const seen: string[] = [];
    const offSealed = runtime.subscribeEvent("security.document.sealed", () => { seen.push("sealed"); });
    const offVerified = runtime.subscribeEvent("security.document.seal.verified", () => { seen.push("verified"); });

    const manifest = await runtime.sealDocument({ document: { id: "evt", title: "E" }, bytes: payload() });
    await runtime.verifyDocumentSeal({ manifest, bytes: payload(), publicKeyPem: manifest.signer.publicKeyPem });
    offSealed();
    offVerified();

    expect(seen).toEqual(["sealed", "verified"]);
  });
});
