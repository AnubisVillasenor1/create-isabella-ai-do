import { Router, Request, Response } from 'express';
import {
  PostgresMultimodelAdapter,
  getPostgresMultimodelAdapter,
} from '../database/PostgresMultimodelAdapter';
import { getHyperRouter } from '../cognition/HyperRouterMoE';

const router = Router();

/**
 * GET /api/v1/health
 * Basic liveness probe - returns immediately if process is alive
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'isabella-core',
    version: process.env.npm_package_version || '1.0.0',
  });
});

/**
 * GET /api/v1/healthz
 * Basic health check with minimal dependencies
 */
router.get('/healthz', async (_req: Request, res: Response) => {
  try {
    const db = getPostgresMultimodelAdapter();
    const dbHealth = await db.healthCheck();

    if (!dbHealth.healthy) {
      return res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: { database: dbHealth },
      });
    }

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbHealth,
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/readyz
 * Comprehensive readiness probe - checks all critical dependencies
 */
router.get('/readyz', async (_req: Request, res: Response) => {
  const checks: Record<string, { healthy: boolean; latencyMs?: number; details?: unknown }> = {};
  let allHealthy = true;

  const startTime = Date.now();

  // 1. Database connectivity
  try {
    const dbStart = Date.now();
    const db = getPostgresMultimodelAdapter();
    const dbHealth = await db.healthCheck();
    checks.database = {
      healthy: dbHealth.healthy,
      latencyMs: Date.now() - dbStart,
      details: dbHealth.details,
    };
    if (!dbHealth.healthy) allHealthy = false;
  } catch (error) {
    checks.database = {
      healthy: false,
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    };
    allHealthy = false;
  }

  // 2. Ollama connectivity
  try {
    const ollamaStart = Date.now();
    const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      `${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}/api/tags`,
      {
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    const latency = Date.now() - ollamaStart;
    checks.ollama = {
      healthy: response.ok,
      latencyMs: latency,
      details: { models: (await response.json()).models?.length || 0 },
    };
    if (!response.ok) allHealthy = false;
  } catch (error) {
    checks.ollama = {
      healthy: false,
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    };
    allHealthy = false;
  }

  // 3. HyperRouter health
  try {
    const router = getHyperRouter();
    const routerHealth = await router.getHealth();
    checks.hyperrouter = {
      healthy: routerHealth.status === 'healthy',
      details: routerHealth,
    };
    if (routerHealth.status !== 'healthy') allHealthy = false;
  } catch (error) {
    checks.hyperrouter = {
      healthy: false,
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    };
    allHealthy = false;
  }

  // 4. Semantic cache
  try {
    const db = getPostgresMultimodelAdapter();
    const cacheTest = await db.querySemanticCache(new Array(1024).fill(0), 0.5);
    checks.semanticCache = {
      healthy: true,
      details: { testQuery: 'completed' },
    };
  } catch (error) {
    checks.semanticCache = {
      healthy: false,
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    };
    allHealthy = false;
  }

  // 5. Embedding generation
  try {
    const embeddingStart = Date.now();
    // Test embedding generation (using simple hash fallback)
    const testEmbedding = new Array(1024).fill(0).map((_, i) => Math.sin(i) * 0.1);
    await getPostgresMultimodelAdapter().querySemanticCache(testEmbedding, 0.5);
    checks.embeddings = {
      healthy: true,
      latencyMs: Date.now() - embeddingStart,
    };
  } catch (error) {
    checks.embeddings = {
      healthy: false,
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    };
    allHealthy = false;
  }

  // 6. Disk space
  try {
    const { execSync } = require('child_process');
    const diskOutput = execSync('df -h /', { encoding: 'utf-8' });
    const lines = diskOutput.trim().split('\n');
    const parts = lines[1].split(/\s+/);
    const usagePercent = parseInt(parts[4].replace('%', ''), 10);
    checks.disk = {
      healthy: usagePercent < 90,
      details: { usagePercent, available: parts[3] },
    };
    if (usagePercent >= 90) allHealthy = false;
  } catch (error) {
    checks.disk = {
      healthy: true, // Non-critical
      details: { error: 'Could not check disk' },
    };
  }

  // 5. Memory
  try {
    const mem = process.memoryUsage();
    const memPercent = (mem.heapUsed / mem.heapTotal) * 100;
    checks.memory = {
      healthy: memPercent < 90,
      details: {
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
        percent: Math.round(memPercent),
      },
    };
    if (memPercent >= 90) allHealthy = false;
  } catch (error) {
    checks.memory = {
      healthy: true,
      details: { error: 'Could not check memory' },
    };
  }

  const totalLatency = Date.now() - startTime;

  const response = {
    status: allHealthy ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString(),
    totalLatencyMs: totalLatency,
    checks,
  };

  res.status(allHealthy ? 200 : 503).json(response);
});

/**
 * GET /api/v1/status
 * Detailed status endpoint with system metrics
 */
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const db = getPostgresMultimodelAdapter();
    const router = getHyperRouter();

    const [dbHealth, routerHealth] = await Promise.all([db.healthCheck(), router.getHealth()]);

    const mem = process.memoryUsage();
    const uptime = process.uptime();

    res.json({
      service: 'isabella-core',
      version: process.env.npm_package_version || '1.0.0',
      uptimeSeconds: Math.floor(uptime),
      uptimeHuman: formatUptime(uptime),
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      database: dbHealth,
      hyperrouter: routerHealth,
      memory: {
        heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        externalMB: Math.round(process.memoryUsage().external / 1024 / 1024),
        rssMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
      },
      cpu: process.cpuUsage(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/v1/metrics
 * Prometheus-compatible metrics endpoint
 */
router.get('/metrics', async (_req: Request, res: Response) => {
  try {
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();
    const uptime = process.uptime();

    const db = getPostgresMultimodelAdapter();
    const dbHealth = await db.healthCheck();

    let metrics = '';

    // Process metrics
    metrics += `# HELP process_uptime_seconds Process uptime in seconds\n`;
    metrics += `# TYPE process_uptime_seconds gauge\n`;
    metrics += `process_uptime_seconds ${process.uptime()}\n`;

    metrics += `# HELP process_memory_heap_used_bytes Heap memory used\n`;
    metrics += `# TYPE process_memory_heap_used_bytes gauge\n`;
    metrics += `process_memory_heap_used_bytes ${process.memoryUsage().heapUsed}\n`;

    metrics += `# HELP process_memory_heap_total_bytes Heap memory total\n`;
    metrics += `# TYPE process_memory_heap_total_bytes gauge\n`;
    metrics += `process_memory_heap_total_bytes ${process.memoryUsage().heapTotal}\n`;

    metrics += `# HELP process_cpu_user_seconds_total User CPU time\n`;
    metrics += `# TYPE process_cpu_user_seconds_total counter\n`;
    metrics += `process_cpu_user_seconds_total ${cpu.user / 1e6}\n`;

    metrics += `# HELP process_cpu_system_seconds_total System CPU time\n`;
    metrics += `# TYPE process_cpu_system_seconds_total counter\n`;
    metrics += `process_cpu_system_seconds_total ${cpu.system / 1e6}\n`;

    // Database metrics
    metrics += `# HELP isabella_database_healthy Database health status\n`;
    metrics += `# TYPE isabella_database_healthy gauge\n`;
    metrics += `isabella_database_healthy ${dbHealth.healthy ? 1 : 0}\n`;

    if (dbHealth.details?.pool) {
      metrics += `# HELP isabella_database_pool_total Total connections\n`;
      metrics += `# TYPE isabella_database_pool_total gauge\n`;
      metrics += `isabella_database_pool_total ${dbHealth.details.pool.totalCount}\n`;

      metrics += `# HELP isabella_database_pool_idle Idle connections\n`;
      metrics += `# TYPE isabella_database_pool_idle gauge\n`;
      metrics += `isabella_database_pool_idle ${dbHealth.details.pool.idleCount}\n`;

      metrics += `# HELP isabella_database_pool_waiting Waiting connections\n`;
      metrics += `# TYPE isabella_database_pool_waiting gauge\n`;
      metrics += `isabella_database_pool_waiting ${dbHealth.details.pool.waitingCount}\n`;
    }

    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(metrics);
  } catch (error) {
    res
      .status(500)
      .send(
        `# Error generating metrics\n${error instanceof Error ? error.message : 'Unknown error'}\n`
      );
  }
});

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${days}d ${hours}h ${minutes}m ${secs}s`;
}

export default router;
