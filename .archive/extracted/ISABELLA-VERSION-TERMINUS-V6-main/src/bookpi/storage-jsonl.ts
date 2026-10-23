import { mkdir, readFile, appendFile } from "node:fs/promises";
import { dirname } from "node:path";
import { verifyChainLink, ZERO_HASH } from "./crypto";
import { buildBookPiEvent } from "./emitter";
import type { BookPiEventContext, BookPiEventRecord, BookPiEventSeed, BookPiStorage } from "./types";

export function createJsonlStorage(filePath: string): BookPiStorage {
  async function readAll(): Promise<BookPiEventRecord[]> {
    try {
      const raw = await readFile(filePath, "utf8");
      return raw.split("\n").filter((l) => l.trim()).map((line) => JSON.parse(line) as BookPiEventRecord);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async function getLastEvent(): Promise<BookPiEventRecord | null> {
    const events = await readAll();
    return events.at(-1) ?? null;
  }

  async function appendEvent(seed: BookPiEventSeed, ctx: Partial<BookPiEventContext> = {}): Promise<BookPiEventRecord> {
    if (ctx.sequence !== undefined || ctx.prevHash !== undefined || ctx.timestamp !== undefined) {
      throw new Error("createJsonlStorage: sequence/prevHash/timestamp are derived and cannot be supplied.");
    }
    const last = await getLastEvent();
    const record = buildBookPiEvent(seed, {
      sequence: last ? last.sequence + 1 : 1,
      prevHash: last ? last.hash : ZERO_HASH,
      timestamp: new Date().toISOString(),
      actorId: ctx.actorId,
      secret: ctx.secret,
    });
    await mkdir(dirname(filePath), { recursive: true });
    await appendFile(filePath, JSON.stringify(record) + "\n", "utf8");
    return record;
  }

  async function listEvents(): Promise<BookPiEventRecord[]> { return readAll(); }

  async function verifyChain(opts: { secret?: string } = {}): Promise<{ valid: boolean; count: number; failures: string[] }> {
    const events = await readAll();
    const failures: string[] = [];
    let prevHash = ZERO_HASH;
    for (const event of events) {
      if (event.prevHash !== prevHash) failures.push(`evento ${event.sequence} (${event.id}): prevHash no encadena`);
      if (!verifyChainLink(event, opts.secret)) failures.push(`evento ${event.sequence} (${event.id}): hash/integridad inválidos`);
      prevHash = event.hash;
    }
    return { valid: failures.length === 0, count: events.length, failures };
  }

  return { getLastEvent, appendEvent, listEvents, verifyChain };
}
