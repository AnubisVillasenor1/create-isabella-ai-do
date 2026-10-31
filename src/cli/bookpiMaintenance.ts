/**
 * BookPI maintenance CLI. state: draft | engine-generated.
 *
 * Usage:
 *   tsx src/cli/bookpiMaintenance.ts verify
 *   tsx src/cli/bookpiMaintenance.ts summary
 *   tsx src/cli/bookpiMaintenance.ts backup --dest <path>
 *   tsx src/cli/bookpiMaintenance.ts restore --src <path>
 *   tsx src/cli/bookpiMaintenance.ts retention [--max-events N] [--max-ms N] [--archive <path>] [--prune]
 *
 * The ledger path comes from --path or BOOKPI_LEDGER_PATH. Commands operate on
 * the durable JSONL ledger; without a path the command fails closed because
 * there is nothing durable to maintain.
 */
import { writeFileSync } from 'node:fs';
import { DurableBookPiLedger } from '../bookpi/ledger';
import { planRetention } from '../bookpi/retention';

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function resolvePath(): string {
  const path = argValue('--path') ?? process.env.BOOKPI_LEDGER_PATH ?? '';
  if (!path.trim())
    throw new Error('BOOKPI_LEDGER_PATH_REQUIRED (use --path or BOOKPI_LEDGER_PATH)');
  return path.trim();
}

function emit(payload: Record<string, unknown>): void {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), ...payload }));
}

function main(): void {
  const command = process.argv[2];
  const path = resolvePath();
  const ledger = new DurableBookPiLedger(path);

  switch (command) {
    case 'verify': {
      const verification = ledger.verify();
      emit({ command, path, verification });
      process.exitCode = verification.valid ? 0 : 1;
      return;
    }
    case 'summary': {
      emit({ command, path, summary: ledger.getSummary(), verification: ledger.verify() });
      return;
    }
    case 'backup': {
      const dest = argValue('--dest');
      if (!dest) throw new Error('--dest is required for backup');
      emit({ command, path, backup: ledger.backup(dest) });
      return;
    }
    case 'restore': {
      const src = argValue('--src');
      if (!src) throw new Error('--src is required for restore');
      const result = ledger.restore(src);
      emit({ command, path, result, verification: ledger.verify() });
      return;
    }
    case 'retention': {
      const maxEvents = argValue('--max-events');
      const maxMs = argValue('--max-ms');
      const archive = argValue('--archive');
      const plan = planRetention(ledger.list(), {
        maxEvents: maxEvents !== undefined ? Number(maxEvents) : undefined,
        maxAgeMs: maxMs !== undefined ? Number(maxMs) : undefined,
      });
      let archivedPath: string | null = null;
      if (archive) {
        const body = plan.archived.map((event) => JSON.stringify(event)).join('\n');
        writeFileSync(archive, body ? `${body}\n` : '', 'utf8');
        archivedPath = archive;
      }
      let pruned: { pruned: number; remaining: number } | null = null;
      if (hasFlag('--prune')) {
        if (!archive)
          throw new Error('--prune requires --archive (archive the prefix before pruning)');
        pruned = ledger.prune(plan);
      }
      emit({
        command,
        path,
        plannedArchive: plan.archived.length,
        kept: plan.kept.length,
        archivePath: archivedPath,
        pruned,
        verification: ledger.verify(),
      });
      return;
    }
    default:
      throw new Error('command required: verify | summary | backup | restore | retention');
  }
}

try {
  main();
} catch (error) {
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      message: error instanceof Error ? error.message : String(error),
    })
  );
  process.exitCode = 2;
}
