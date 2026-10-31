import type { BookPiEventSeed } from "../../src/bookpi/types";
import { BOOKPI_PROTOCOL } from "../../src/bookpi/types";

export function makeSeed(overrides: Partial<BookPiEventSeed> = {}): BookPiEventSeed {
  return {
    header: {
      type: "TEST_EVENT",
      source: "isabella-ai-genesis",
      protocol: BOOKPI_PROTOCOL,
      hehepcontext: { hexagon: "H1", domain: "evolution" },
    },
    schemaVersion: "1.0.0",
    payload: { status: "ok", tick: 1 },
    meta: { kind: "unit-test" },
    ...overrides,
  };
}