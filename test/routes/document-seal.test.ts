import { describe, expect, it } from "vitest";
import type { Application, Request, Response } from "express";
import type { FixedWindowRateLimiter } from "../../src/security/rate-limit";
import { registerDocumentSealRoutes } from "../../src/routes/document-seal";
import {
  documentSealEnablement,
  sealDocument,
  verifyDocumentSeal,
  type DocumentSealManifest,
} from "../../src/security/document-seal";
import { Ed25519Signer } from "../../src/security/post-quantum";

type Handler = (req: Request, res: Response) => void | Promise<void>;

interface Captured {
  status: number;
  body: unknown;
}

function harness(options: { denyAdmin?: boolean; denyRate?: boolean } = {}) {
  const handlers = new Map<string, Handler>();
  const app = {
    post: (path: string, handler: Handler) => handlers.set(`POST ${path}`, handler),
    get: (path: string, handler: Handler) => handlers.set(`GET ${path}`, handler),
  } as unknown as Application;
  const signer = Ed25519Signer.generate("route-test-key");
  registerDocumentSealRoutes({
    app,
    sealDocument: (input) => sealDocument(input, signer),
    verifyDocumentSeal: (input) => verifyDocumentSeal(input),
    documentSealEnablement: () => documentSealEnablement(),
    enforceRateLimit: () => !options.denyRate,
    rateLimiter: {} as FixedWindowRateLimiter,
    authorizeAdmin: () => !options.denyAdmin,
  });
  return handlers;
}

function makeRes(): { res: Response; captured: Captured } {
  const captured: Captured = { status: 200, body: undefined };
  const res = {
    status(code: number) { captured.status = code; return this; },
    json(payload: unknown) { captured.body = payload; return this; },
  };
  return { res: res as unknown as Response, captured };
}

const contentBase64 = Buffer.from("documento firmado", "utf8").toString("base64");

describe("IGDS Document Seal routes", () => {
  it("sella un documento y nunca autoriza ni ejecuta", async () => {
    const handlers = harness();
    const { res, captured } = makeRes();
    await handlers.get("POST /api/v1/security/document-seal")!(
      { body: { document: { id: "doc-1", title: "Acta" }, contentBase64 } } as unknown as Request,
      res,
    );
    const body = captured.body as { success: boolean; authorizationPerformed: boolean; executionPerformed: boolean; manifest: DocumentSealManifest };
    expect(body.success).toBe(true);
    expect(body.authorizationPerformed).toBe(false);
    expect(body.executionPerformed).toBe(false);
    expect(body.manifest.sealId.startsWith("SHA-ISABELLA-GENESIS-256-ED25519-")).toBe(true);
  });

  it("verifica un manifiesto sellado y reporta firma válida", async () => {
    const handlers = harness();
    const seal = makeRes();
    await handlers.get("POST /api/v1/security/document-seal")!(
      { body: { document: { id: "doc-2", title: "Acta" }, contentBase64 } } as unknown as Request,
      seal.res,
    );
    const manifest = (seal.captured.body as { manifest: DocumentSealManifest }).manifest;

    const verify = makeRes();
    await handlers.get("POST /api/v1/security/document-seal/verify")!(
      { body: { manifest, contentBase64, publicKeyPem: manifest.signer.publicKeyPem } } as unknown as Request,
      verify.res,
    );
    const report = (verify.captured.body as { report: { valid: boolean; signature: string } }).report;
    expect(report.valid).toBe(true);
    expect(report.signature).toBe("valid");
  });

  it("rechaza un sellado sin contenido", async () => {
    const handlers = harness();
    const { res, captured } = makeRes();
    await handlers.get("POST /api/v1/security/document-seal")!(
      { body: { document: { id: "doc-3", title: "Acta" } } } as unknown as Request,
      res,
    );
    expect(captured.status).toBe(400);
  });

  it("rechaza la verificación sin llave pública PEM", async () => {
    const handlers = harness();
    const { res, captured } = makeRes();
    await handlers.get("POST /api/v1/security/document-seal/verify")!(
      { body: { manifest: {}, contentBase64, publicKeyPem: "no-es-pem" } } as unknown as Request,
      res,
    );
    expect(captured.status).toBe(400);
  });

  it("publica el estado honesto del sello vía GET", async () => {
    const handlers = harness();
    const { res, captured } = makeRes();
    await handlers.get("GET /api/v1/security/document-seal")!({} as unknown as Request, res);
    const body = captured.body as { success: boolean; enablement: { implemented: string[] } };
    expect(body.success).toBe(true);
    expect(body.enablement.implemented).toContain("ed25519-signature");
  });

  it("bloquea el endpoint cuando el gate admin deniega", async () => {
    const handlers = harness({ denyAdmin: true });
    const { res, captured } = makeRes();
    await handlers.get("POST /api/v1/security/document-seal")!(
      { body: { document: { id: "doc-4", title: "Acta" }, contentBase64 } } as unknown as Request,
      res,
    );
    expect(captured.body).toBeUndefined();
  });

  it("bloquea el endpoint cuando el rate limit deniega", async () => {
    const handlers = harness({ denyRate: true });
    const { res, captured } = makeRes();
    await handlers.get("POST /api/v1/security/document-seal")!(
      { body: { document: { id: "doc-5", title: "Acta" }, contentBase64 } } as unknown as Request,
      res,
    );
    expect(captured.body).toBeUndefined();
  });
});
