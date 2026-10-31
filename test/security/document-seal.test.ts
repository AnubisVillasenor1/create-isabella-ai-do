import { describe, expect, it } from "vitest";
import {
  BOOKPI_GENESIS_SEAL_PREFIX,
  DOCUMENT_SEAL_SCHEMA,
  base32Decode,
  base32Encode,
  contentDigest,
  documentSealEnablement,
  sealDocument,
  verifyDocumentSeal,
} from "../../src/security/document-seal";
import { Ed25519Signer } from "../../src/security/post-quantum";

function sample(): { signer: Ed25519Signer; bytes: Uint8Array } {
  const signer = Ed25519Signer.generate("test-key");
  const bytes = Buffer.from("Isabella document payload", "utf8");
  return { signer, bytes };
}

describe("base32 (RFC 4648)", () => {
  it("codifica y decodifica sin pérdida", () => {
    const bytes = Buffer.from("hello world", "utf8");
    expect(Buffer.from(base32Decode(base32Encode(bytes))).toString("utf8")).toBe("hello world");
  });

  it("rechaza caracteres inválidos", () => {
    expect(() => base32Decode("!!!!")).toThrow(/inválido/);
  });
});

describe("contentDigest", () => {
  it("coincide con SHA-256 de 'hello'", () => {
    expect(contentDigest(Buffer.from("hello", "utf8"))).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });
});

describe("sealDocument + verifyDocumentSeal", () => {
  it("firma y verifica un documento íntegro", async () => {
    const { signer, bytes } = sample();
    const manifest = await sealDocument(
      { document: { id: "doc-1", title: "Acta", mediaType: "text/plain", language: "es" }, bytes },
      signer,
    );

    expect(manifest.schema).toBe(DOCUMENT_SEAL_SCHEMA);
    expect(manifest.sealId.startsWith(BOOKPI_GENESIS_SEAL_PREFIX)).toBe(true);
    expect(manifest.sealId).toMatch(/[0-9A-F]{64}$/);
    expect(manifest.compactId).toMatch(/^[A-Z2-7]{4}(-[A-Z2-7]{4})*-?$/);
    expect(manifest.content.bytes).toBe(bytes.length);
    expect(manifest.watermark.present).toBe(true);
    expect(manifest.signature.algorithm).toBe("Ed25519");

    const report = await verifyDocumentSeal({
      manifest,
      bytes,
      publicKeyPem: signer.publicKeyPem(),
    });
    expect(report.valid).toBe(true);
    expect(report.integrity).toBe("valid");
    expect(report.signature).toBe("valid");
    expect(report.timestamp).toBe("unsupported");
    expect(report.registry).toBe("not_checked");
  });

  it("marca integridad inválida si el contenido cambia", async () => {
    const { signer, bytes } = sample();
    const manifest = await sealDocument({ document: { id: "doc-2", title: "Acta" }, bytes }, signer);
    const report = await verifyDocumentSeal({
      manifest,
      bytes: Buffer.from("tampered content", "utf8"),
      publicKeyPem: signer.publicKeyPem(),
    });
    expect(report.valid).toBe(false);
    expect(report.integrity).toBe("invalid");
    expect(report.issues.length).toBeGreaterThan(0);
  });

  it("marca firma inválida con otra llave", async () => {
    const { signer, bytes } = sample();
    const other = Ed25519Signer.generate("other-key");
    const manifest = await sealDocument({ document: { id: "doc-3", title: "Acta" }, bytes }, signer);
    const report = await verifyDocumentSeal({
      manifest,
      bytes,
      publicKeyPem: other.publicKeyPem(),
    });
    expect(report.valid).toBe(false);
    expect(report.signature).toBe("invalid");
    expect(report.integrity).toBe("valid");
  });

  it("permite desactivar el watermark y encadena el sello previo", async () => {
    const { signer, bytes } = sample();
    const manifest = await sealDocument(
      { document: { id: "doc-4", title: "Acta" }, bytes, prevSealId: "seal-prev", generateWatermark: false },
      signer,
    );
    expect(manifest.watermark.present).toBe(false);
    expect(manifest.hashChain.prevSealId).toBe("seal-prev");
  });
});

describe("documentSealEnablement", () => {
  it("declara lo implementado y lo no soportado sin fingir", () => {
    const enablement = documentSealEnablement();
    expect(enablement.implemented).toContain("ed25519-signature");
    expect(enablement.unsupported.map((item) => item.feature)).toContain("rfc3161-timestamp");
  });
});
