import type { PrismaClient } from "@/generated/prisma";

type PrismaModelMethod = (...args: unknown[]) => Promise<unknown>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export interface PrismaClientOptions {
  poolConnectionTimeoutMs?: number;
}

async function getPrismaClient(options: PrismaClientOptions = {}): Promise<PrismaClient> {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  const { PrismaClient: PrismaClientConstructor } = await import("../generated/prisma");

  let logLevel: Array<"query" | "info" | "warn" | "error"> = ["error"];
  try {
    const { config } = await import("./config");
    const cfg = config();
    if (cfg.NODE_ENV !== "production") {
      logLevel = ["warn", "error"];
    }
  } catch {
    logLevel = ["error"];
  }

  const client = new PrismaClientConstructor({
    log: logLevel,
    // Frontera transaccional con timeout explícito (P0-12): ninguna operación
    // crítica debe quedarse esperando indefinidamente a un lock del pool.
    transactionOptions: {
      maxWait: Math.max(1, Math.round((options.poolConnectionTimeoutMs ?? 5000) / 2)),
      timeout: Math.max(1000, options.poolConnectionTimeoutMs ?? 10000),
    },
  });

  // Caché global solo fuera de producción; si la config no carga,
  // fail-closed (sin caché global).
  let cacheGlobal = false;
  try {
    const { config } = await import("./config");
    cacheGlobal = config().NODE_ENV !== "production";
  } catch {
    cacheGlobal = false;
  }
  if (cacheGlobal) globalForPrisma.prisma = client;
  return client;
}

/** Health check real de la base de datos (`SELECT 1`). */
export async function prismaHealth(): Promise<{
  ok: boolean;
  latencyMs: number;
  error?: string;
}> {
  const started = Date.now();
  try {
    const client = await getPrismaClient();
    await client.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Date.now() - started };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Ejecuta una transacción con frontera y timeout explícitos (fail-closed). */
export async function withPrismaTransaction<T>(
  callback: (
    client: Omit<
      PrismaClient,
      "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
    >,
  ) => Promise<T>,
  options: { maxWaitMs?: number; timeoutMs?: number } = {},
): Promise<T> {
  const client = await getPrismaClient({
    poolConnectionTimeoutMs: options.timeoutMs ?? 10000,
  });
  return client.$transaction(callback, {
    maxWait: Math.max(500, options.maxWaitMs ?? 5000),
    timeout: Math.max(1000, options.timeoutMs ?? 10000),
  });
}

/** Desconexión ordenada del pool (shutdown limpio). */
export async function prismaShutdown(): Promise<void> {
  const client = globalForPrisma.prisma;
  if (!client) return;
  await client.$disconnect();
  if (globalForPrisma.prisma === client) {
    globalForPrisma.prisma = undefined;
  }
}

export const prisma = new Proxy({} as PrismaClient, {
  get: (_target, model: string) =>
    new Proxy(
      {},
      {
        get: (_modelTarget, method: string) =>
          (async (...args: unknown[]) => {
            const client = await getPrismaClient();
            const modelClient = client[model as keyof PrismaClient] as unknown as Record<
              string,
              PrismaModelMethod
            >;
            return modelClient[method](...args);
          }) as PrismaModelMethod,
      },
    ),
});
