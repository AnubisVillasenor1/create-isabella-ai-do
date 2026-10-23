// Durable storage port for the GAME OVER AI Passport registry (TD-05).
//
// state: draft | engine-generated. The registry is application-level state that
// must survive process restarts and be shared across replicas of a single
// writer. This module provides a small JSON-file store with atomic writes; it is
// deliberately dependency-free so it can be swapped for Postgres/Supabase later
// behind the same PassportStorePort interface.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { AIPassport } from "./types";

export interface PassportStorePort {
  /** Returns every persisted passport in insertion order. */
  load(): readonly AIPassport[];
  /** Persists the full registry snapshot. Must be durable on return. */
  save(passports: readonly AIPassport[]): void;
}

function isPassport(value: unknown): value is AIPassport {
  return typeof value === "object" && value !== null && typeof (value as { id?: unknown }).id === "string";
}

/**
 * JSON-file passport store. Reads/writes a single array document atomically via a
 * temp file + rename, so a crash mid-write never truncates the registry. A
 * corrupt or unreadable file fails loudly rather than silently dropping records.
 */
export function createJsonPassportStore(filePath: string): PassportStorePort {
  const target = filePath.trim();
  if (!target) throw new Error("PASSPORT_STORE_PATH_REQUIRED");

  function load(): readonly AIPassport[] {
    if (!existsSync(target)) return [];
    const raw = readFileSync(target, "utf8").trim();
    if (!raw) return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error(`PASSPORT_STORE_CORRUPT: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!Array.isArray(parsed)) throw new Error("PASSPORT_STORE_CORRUPT: expected a JSON array");
    return parsed.filter(isPassport).map((passport) => Object.freeze({ ...passport }));
  }

  function save(passports: readonly AIPassport[]): void {
    mkdirSync(path.dirname(target), { recursive: true });
    const temp = `${target}.tmp`;
    writeFileSync(temp, `${JSON.stringify(passports, null, 2)}\n`, "utf8");
    renameSync(temp, target);
  }

  return { load, save };
}

/** In-process store for tests and single-process deployments. */
export function createMemoryPassportStore(initial: readonly AIPassport[] = []): PassportStorePort {
  let snapshot: readonly AIPassport[] = [...initial];
  return {
    load: () => [...snapshot],
    save: (passports) => {
      snapshot = [...passports];
    },
  };
}
