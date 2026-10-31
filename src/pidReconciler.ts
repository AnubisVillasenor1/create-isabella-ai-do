// src/lib/pid/reconcile.ts
// -----------------------------------------------------------------------------
// ISABELLA Ω∞ · PID Reconciliation Engine
// -----------------------------------------------------------------------------
// Valida y reconcilia identificadores persistentes (ORCID, DOI, ISNI)
// bajo principios de soberanía cognitiva, trazabilidad y evidencia.
//
// Principios:
// - Capacidad ≠ Autoridad
// - Evidencia antes que confianza
// - Toda validación produce evidencia auditable
// -----------------------------------------------------------------------------

import { createHash } from 'node:crypto';
import type { PidConfig } from './config.js';

export type PidKind = 'ORCID' | 'DOI' | 'ISNI';

export interface PidRecord {
  kind: PidKind;
  value: string;
  canonical: string;
  source: 'config';
  validFormat: boolean;
  validChecksum: boolean | null; // null = no aplica (DOI)
}

export type CheckSeverity = 'info' | 'warning' | 'error';

export interface PidCheck {
  name: string;
  passed: boolean;
  severity: CheckSeverity;
  details: string;
  recordKinds?: PidKind[];
}

export interface ReconciliationReport {
  passed: boolean;
  reconciledAt: string;
  recordCount: number;
  records: readonly PidRecord[];
  checks: readonly PidCheck[];
  fingerprint: string;
}

// ---------------------------------------------------------------------------
// Regex
// ---------------------------------------------------------------------------

const ORCID_RE = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/i;
const ISNI_RE = /^(?:\d{4} ){3}\d{3}[\dX]$|^\d{16}$/i;
const DOI_RE = /^10\.\d{4,9}\/\S+$/i;

// ---------------------------------------------------------------------------
// Normalización
// ---------------------------------------------------------------------------

function normalizeOrcid(value: string): string {
  return value
    .replace(/^https?:\/\/(?:orcid\.org\/)?/i, '')
    .trim()
    .toUpperCase();
}

function normalizeIsni(value: string): string {
  return value
    .replace(/^https?:\/\/(?:isni\.org\/)?/i, '')
    .replace(/[-\s]/g, '')
    .trim()
    .toUpperCase();
}

function normalizeDoi(value: string): string {
  return value
    .replace(/^https?:\/\/(?:doi\.org\/|dx\.doi\.org\/)/i, '')
    .replace(/^doi:\s*/i, '')
    .trim()
    .toLowerCase();
}

// ---------------------------------------------------------------------------
// Checksum MOD 11-2 (compartido por ORCID e ISNI)
// ---------------------------------------------------------------------------

function isValidMod11_2(digits: string): boolean {
  if (!/^\d{15}[\dX]$/i.test(digits)) return false;
  let total = 0;
  for (const char of digits.slice(0, -1)) {
    total = (total + Number(char)) * 2;
  }
  const remainder = total % 11;
  const check = (12 - remainder) % 11;
  const expected = check === 10 ? 'X' : String(check);
  return expected === digits.slice(-1).toUpperCase();
}

function validOrcid(value: string): boolean {
  const normalized = normalizeOrcid(value);
  if (!ORCID_RE.test(normalized)) return false;
  return isValidMod11_2(normalized.replace(/-/g, ''));
}

function validIsni(value: string): boolean {
  const normalized = normalizeIsni(value);
  if (!ISNI_RE.test(normalized)) return false;
  return isValidMod11_2(normalized.replace(/\s/g, ''));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function canonicalFor(kind: PidKind, raw: string): string {
  switch (kind) {
    case 'ORCID':
      return normalizeOrcid(raw);
    case 'ISNI':
      return normalizeIsni(raw);
    case 'DOI':
    default:
      return normalizeDoi(raw);
  }
}

function formatValidFor(kind: PidKind, canonical: string): boolean {
  switch (kind) {
    case 'ORCID':
      return ORCID_RE.test(canonical);
    case 'ISNI':
      return ISNI_RE.test(canonical);
    case 'DOI':
    default:
      return DOI_RE.test(canonical);
  }
}

function checksumValidFor(kind: PidKind, raw: string): boolean | null {
  switch (kind) {
    case 'ORCID':
      return validOrcid(raw);
    case 'ISNI':
      return validIsni(raw);
    case 'DOI':
    default:
      return null; // DOI no lleva checksum en el identificador
  }
}

// ---------------------------------------------------------------------------
// Fingerprint determinista (orden estable por bytes)
// ---------------------------------------------------------------------------

function fingerprint(records: readonly PidRecord[]): string {
  const sorted = [...records].map(({ kind, canonical }) => `${kind}:${canonical}`).sort(); // orden lexicográfico por UTF-16 code units — estable

  return createHash('sha256').update(sorted.join('\n')).digest('hex');
}

// ---------------------------------------------------------------------------
// Reconciliación principal
// ---------------------------------------------------------------------------

export async function reconcilePids(cfg: PidConfig): Promise<ReconciliationReport> {
  const records: PidRecord[] = [];
  const checks: PidCheck[] = [];

  const addRecord = (kind: PidKind, raw: string | undefined | null) => {
    if (raw == null) return; // null o undefined
    if (typeof raw !== 'string') return; // defensa extra
    const trimmed = raw.trim();
    if (!trimmed) return;

    const canonical = canonicalFor(kind, trimmed);
    const validFormat = formatValidFor(kind, canonical);
    const validChecksum = checksumValidFor(kind, trimmed);

    records.push({
      kind,
      value: trimmed,
      canonical,
      source: 'config',
      validFormat,
      validChecksum,
    });

    // Check de formato
    checks.push({
      name: `${kind} format`,
      passed: validFormat,
      severity: validFormat ? 'info' : 'error',
      details: validFormat
        ? `${kind} has a valid format`
        : `${kind} failed canonical format validation`,
      recordKinds: [kind],
    });

    // Check de checksum (solo ORCID/ISNI)
    if (validChecksum !== null) {
      checks.push({
        name: `${kind} checksum`,
        passed: validChecksum,
        severity: validChecksum ? 'info' : 'error',
        details: validChecksum
          ? `${kind} checksum (MOD 11-2) is valid`
          : `${kind} checksum (MOD 11-2) is invalid`,
        recordKinds: [kind],
      });
    }
  };

  addRecord('ORCID', cfg?.identifiers?.orcid);
  addRecord('DOI', cfg?.identifiers?.zenodoDoi);
  addRecord('DOI', cfg?.identifiers?.dataCiteDoi);
  addRecord('ISNI', cfg?.identifiers?.isni);

  // Unicidad
  const unique = new Set(records.map((r) => `${r.kind}:${r.canonical}`));
  const uniqueOk = unique.size === records.length;
  checks.push({
    name: 'identifier uniqueness',
    passed: uniqueOk,
    severity: uniqueOk ? 'info' : 'error',
    details: uniqueOk
      ? 'No duplicate canonical identifiers'
      : 'Duplicate canonical identifiers detected',
    recordKinds: [...new Set(records.map((r) => r.kind))],
  });

  // Presencia en modo estricto
  if (cfg?.strict && records.length === 0) {
    checks.push({
      name: 'identifier presence',
      passed: false,
      severity: 'error',
      details: 'Strict reconciliation requires at least one configured PID',
    });
  }

  // Namespace esperado
  const rawNs = cfg?.expected?.namespace;
  if (rawNs != null) {
    const expectedNs = String(rawNs).trim();
    if (!expectedNs) {
      checks.push({
        name: 'namespace',
        passed: false,
        severity: 'error',
        details: 'Configured namespace is empty',
      });
    } else {
      const doiRecords = records.filter((r) => r.kind === 'DOI');
      const nsOk = doiRecords.every((r) => r.canonical.startsWith(`${expectedNs.toLowerCase()}/`));
      checks.push({
        name: 'doi namespace match',
        passed: nsOk,
        severity: nsOk ? 'info' : 'warning',
        details: nsOk
          ? `All DOIs match expected namespace "${expectedNs}"`
          : `Some DOIs do not match expected namespace "${expectedNs}"`,
        recordKinds: ['DOI'],
      });
    }
  }

  const passed = checks.every((check) => check.passed || check.severity !== 'error');

  return {
    passed,
    reconciledAt: new Date().toISOString(),
    recordCount: records.length,
    records,
    checks,
    fingerprint: fingerprint(records),
  };
}
