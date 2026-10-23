import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { EpistemicProfile, LitleId } from "./types";
import { toCanonical } from "./id";
import { getQualityTier, type QualityTier } from "./epistemic";

export interface LitleCertificate {
  version: "LITLE-DAC-1";
  litleId: string;
  evidenceRoot: string;
  epistemicScore: number;
  qualityTier: QualityTier;
  issuedAt: string;
  issuer: string;
  signature: string;
}

function payload(certificate: Omit<LitleCertificate, "signature">): string {
  return JSON.stringify(certificate);
}

export function issueCertificate(input: {
  id: LitleId;
  evidenceRoot: string;
  profile: EpistemicProfile;
  issuer?: string;
  secret: string;
  at?: string;
}): LitleCertificate {
  if (!input.secret || input.secret.length < 16) throw new Error("LITLE certificate: signing secret too short");
  if (!/^[a-f0-9]{128}$/i.test(input.evidenceRoot)) throw new Error("LITLE certificate: invalid evidence root");
  const unsigned = {
    version: "LITLE-DAC-1" as const,
    litleId: toCanonical(input.id),
    evidenceRoot: input.evidenceRoot.toLowerCase(),
    epistemicScore: input.profile.compositeScore,
    // A numerical score supplied by the requester is not independent peer review.
    qualityTier: input.profile.assessmentBasis === "INDEPENDENTLY_VERIFIED"
      ? getQualityTier(input.profile.compositeScore)
      : "unrated" as const,
    issuedAt: input.at ?? new Date().toISOString(),
    issuer: input.issuer ?? "genesisai-litle-fabric",
  };
  const signature = createHmac("sha256", input.secret).update(payload(unsigned)).digest("hex");
  return Object.freeze({ ...unsigned, signature });
}

export function verifyCertificate(certificate: LitleCertificate, secret: string): boolean {
  try {
    if (!certificate || typeof certificate !== "object" || !secret || secret.length < 16 ||
      certificate.version !== "LITLE-DAC-1" ||
      typeof certificate.litleId !== "string" || !certificate.litleId.startsWith("litle:") ||
      typeof certificate.evidenceRoot !== "string" || !/^[a-f0-9]{128}$/i.test(certificate.evidenceRoot) ||
      !Number.isFinite(certificate.epistemicScore) || certificate.epistemicScore < 0 || certificate.epistemicScore > 5 ||
      !["platinum", "gold", "silver", "bronze", "unrated"].includes(certificate.qualityTier) ||
      typeof certificate.issuedAt !== "string" || !Number.isFinite(Date.parse(certificate.issuedAt)) ||
      typeof certificate.issuer !== "string" || !certificate.issuer.trim() ||
      typeof certificate.signature !== "string" || !/^[a-f0-9]{64}$/i.test(certificate.signature)) return false;
    const unsigned = {
      version: certificate.version,
      litleId: certificate.litleId,
      evidenceRoot: certificate.evidenceRoot,
      epistemicScore: certificate.epistemicScore,
      qualityTier: certificate.qualityTier,
      issuedAt: certificate.issuedAt,
      issuer: certificate.issuer,
    };
    const expected = createHmac("sha256", secret).update(payload(unsigned)).digest("hex");
    const actualBytes = Buffer.from(certificate.signature, "hex");
    const expectedBytes = Buffer.from(expected, "hex");
    return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
  } catch {
    return false;
  }
}

export function attestationBinding(certificate: LitleCertificate): string {
  const unsigned = {
    version: certificate.version,
    litleId: certificate.litleId,
    evidenceRoot: certificate.evidenceRoot,
    epistemicScore: certificate.epistemicScore,
    qualityTier: certificate.qualityTier,
    issuedAt: certificate.issuedAt,
    issuer: certificate.issuer,
  };
  return createHash("sha256").update(payload(unsigned)).digest("hex");
}
