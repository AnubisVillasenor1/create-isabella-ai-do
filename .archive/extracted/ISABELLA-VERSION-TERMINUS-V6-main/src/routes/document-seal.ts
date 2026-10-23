// IGDS-v1 Document Seal HTTP surface — seals a document (SHA-256 content
// integrity + real Ed25519 signature + textual watermark) and verifies an
// existing manifest fail-closed.
//
// Invariant: sealing computes integrity/provenance and returns a manifest; it
// NEVER authorizes an action, NEVER publishes the document, and does NOT
// implement RFC 3161 trusted timestamps, C2PA or post-quantum signatures —
// those are reported as unsupported and never faked.
//
// state: draft | engine-generated.
import type { Application, Request, Response } from "express";
import type { FixedWindowRateLimiter } from "../security/rate-limit";
import type {
  DocumentSealEnablement,
  DocumentSealManifest,
  SealDocumentInput,
  SealVerificationReport,
} from "../security/document-seal";

export const DOCUMENT_SEAL_ROUTES_VERSION = "1.0.0";

/** Hard cap on the decoded document size accepted by the sealing endpoint. */
export const DOCUMENT_SEAL_MAX_BYTES = 2 * 1024 * 1024;

export interface DocumentSealRouteDeps {
  readonly app: Application;
  readonly sealDocument: (input: SealDocumentInput) => Promise<DocumentSealManifest>;
  readonly verifyDocumentSeal: (input: {
    manifest: DocumentSealManifest;
    bytes: Uint8Array;
    publicKeyPem: string;
  }) => Promise<SealVerificationReport>;
  readonly documentSealEnablement: () => DocumentSealEnablement;
  readonly enforceRateLimit: (
    req: Request,
    res: Response,
    limiter: FixedWindowRateLimiter,
    bucket: string,
  ) => boolean;
  readonly rateLimiter: FixedWindowRateLimiter;
  /** Admin gate; required for every route in this module. */
  readonly authorizeAdmin: (req: Request, res: Response) => boolean;
}

function decodeContentBase64(value: unknown): Uint8Array | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  const cleaned = value.startsWith("base64,") ? value.slice("base64,".length) : value;
  if (!/^[A-Za-z0-9+/=_-]+$/.test(cleaned)) return undefined;
  const bytes = Buffer.from(cleaned, "base64");
  if (bytes.length === 0 || bytes.length > DOCUMENT_SEAL_MAX_BYTES) return undefined;
  return new Uint8Array(bytes);
}

export function registerDocumentSealRoutes(deps: DocumentSealRouteDeps): void {
  const { app } = deps;

  app.post("/api/v1/security/document-seal", async (req, res) => {
    if (!deps.authorizeAdmin(req, res)) return;
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, "security-document-seal")) return;
    try {
      const body = (req.body ?? {}) as {
        document?: SealDocumentInput["document"];
        contentBase64?: string;
        createdAt?: string;
        prevSealId?: string | null;
        generateWatermark?: boolean;
      };
      const document = body.document;
      if (!document || typeof document.id !== "string" || !document.id.trim() || typeof document.title !== "string") {
        res.status(400).json({ success: false, error: "document.id y document.title son requeridos" });
        return;
      }
      const bytes = decodeContentBase64(body.contentBase64);
      if (!bytes) {
        res.status(400).json({ success: false, error: `contentBase64 es requerido (1..${DOCUMENT_SEAL_MAX_BYTES} bytes decodificados)` });
        return;
      }
      const manifest = await deps.sealDocument({
        document,
        bytes,
        ...(typeof body.createdAt === "string" ? { createdAt: body.createdAt } : {}),
        ...(body.prevSealId !== undefined ? { prevSealId: body.prevSealId } : {}),
        ...(body.generateWatermark !== undefined ? { generateWatermark: body.generateWatermark } : {}),
      });
      res.json({ success: true, authorizationPerformed: false, executionPerformed: false, manifest });
    } catch (err) {
      res.status(400).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post("/api/v1/security/document-seal/verify", async (req, res) => {
    if (!deps.authorizeAdmin(req, res)) return;
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, "security-document-seal-verify")) return;
    try {
      const body = (req.body ?? {}) as {
        manifest?: DocumentSealManifest;
        contentBase64?: string;
        publicKeyPem?: string;
      };
      if (!body.manifest || typeof body.manifest !== "object") {
        res.status(400).json({ success: false, error: "manifest es requerido" });
        return;
      }
      if (typeof body.publicKeyPem !== "string" || !body.publicKeyPem.includes("BEGIN PUBLIC KEY")) {
        res.status(400).json({ success: false, error: "publicKeyPem es requerido (SPKI PEM)" });
        return;
      }
      const bytes = decodeContentBase64(body.contentBase64);
      if (!bytes) {
        res.status(400).json({ success: false, error: `contentBase64 es requerido (1..${DOCUMENT_SEAL_MAX_BYTES} bytes decodificados)` });
        return;
      }
      const report = await deps.verifyDocumentSeal({ manifest: body.manifest, bytes, publicKeyPem: body.publicKeyPem });
      res.json({ success: true, verificationPerformed: true, executionPerformed: false, report });
    } catch (err) {
      res.status(400).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/api/v1/security/document-seal", (req, res) => {
    if (!deps.authorizeAdmin(req, res)) return;
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, "security-document-seal-info")) return;
    res.json({ success: true, enablement: deps.documentSealEnablement() });
  });
}
