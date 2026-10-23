/**
 * Deterministic task graph (DAG) scheduler with layered execution.
 *
 * state: draft | engine-generated (pending human review).
 * Pure orchestration only: it validates the dependency graph, runs independent
 * tasks concurrently per layer and never persists artifacts or invents work.
 */
export interface TaskRunContext {
  readonly id: string;
  readonly results: ReadonlyMap<string, unknown>;
  readonly signal: AbortSignal;
}

export type TaskRunner<T = unknown> = (context: TaskRunContext) => Promise<T> | T;

export interface TaskDefinition<T = unknown> {
  readonly id: string;
  readonly dependsOn?: readonly string[];
  readonly run: TaskRunner<T>;
  readonly timeoutMs?: number;
  readonly retries?: number;
}

export type TaskGraphIssueCode =
  | "EMPTY_ID"
  | "DUPLICATE_ID"
  | "UNKNOWN_DEPENDENCY"
  | "SELF_DEPENDENCY"
  | "CYCLE";

export interface TaskGraphIssue {
  code: TaskGraphIssueCode;
  message: string;
  taskId?: string;
}

export class TaskGraphError extends Error {
  readonly code = "TASK_GRAPH_INVALID";
  readonly issues: readonly TaskGraphIssue[];
  constructor(issues: readonly TaskGraphIssue[]) {
    super(`TASK_GRAPH_INVALID: ${issues.map((issue) => issue.message).join(" ")}`);
    this.name = "TaskGraphError";
    this.issues = issues;
  }
}

export class TaskTimeoutError extends Error {
  readonly code = "TASK_TIMEOUT";
  readonly taskId: string;
  readonly timeoutMs: number;
  constructor(taskId: string, timeoutMs: number) {
    super(`TASK_TIMEOUT: '${taskId}' excedió ${timeoutMs} ms.`);
    this.name = "TaskTimeoutError";
    this.taskId = taskId;
    this.timeoutMs = timeoutMs;
  }
}

export interface TaskGraph {
  readonly order: readonly string[];
  readonly layers: readonly (readonly string[])[];
  readonly tasks: ReadonlyMap<string, TaskDefinition>;
}

export function buildTaskGraph(tasks: readonly TaskDefinition[]): TaskGraph {
  const issues: TaskGraphIssue[] = [];
  const byId = new Map<string, TaskDefinition>();

  for (const task of tasks) {
    if (!task.id || task.id.trim().length === 0) {
      issues.push({ code: "EMPTY_ID", message: "Una tarea no tiene id." });
      continue;
    }
    if (byId.has(task.id)) {
      issues.push({ code: "DUPLICATE_ID", message: `Id duplicado '${task.id}'.`, taskId: task.id });
      continue;
    }
    byId.set(task.id, task);
  }

  for (const task of byId.values()) {
    for (const dependency of task.dependsOn ?? []) {
      if (dependency === task.id) {
        issues.push({ code: "SELF_DEPENDENCY", message: `'${task.id}' depende de sí misma.`, taskId: task.id });
      } else if (!byId.has(dependency)) {
        issues.push({
          code: "UNKNOWN_DEPENDENCY",
          message: `'${task.id}' depende de '${dependency}', que no existe.`,
          taskId: task.id,
        });
      }
    }
  }

  if (issues.length > 0) throw new TaskGraphError(issues);

  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const id of byId.keys()) {
    indegree.set(id, 0);
    dependents.set(id, []);
  }
  for (const task of byId.values()) {
    for (const dependency of task.dependsOn ?? []) {
      indegree.set(task.id, (indegree.get(task.id) ?? 0) + 1);
      dependents.get(dependency)?.push(task.id);
    }
  }

  const layers: string[][] = [];
  const order: string[] = [];
  let frontier = [...byId.keys()].filter((id) => (indegree.get(id) ?? 0) === 0);

  while (frontier.length > 0) {
    layers.push(frontier);
    order.push(...frontier);
    const next: string[] = [];
    for (const id of frontier) {
      for (const dependent of dependents.get(id) ?? []) {
        const remaining = (indegree.get(dependent) ?? 0) - 1;
        indegree.set(dependent, remaining);
        if (remaining === 0) next.push(dependent);
      }
    }
    frontier = next;
  }

  if (order.length !== byId.size) {
    const cyclic = [...byId.keys()].filter((id) => !order.includes(id));
    throw new TaskGraphError([
      { code: "CYCLE", message: `Dependencia cíclica entre: ${cyclic.join(", ")}.` },
    ]);
  }

  return { order, layers, tasks: byId };
}

export interface RetryOptions {
  retries: number;
  delayMs?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  onRetry?: (error: unknown, attempt: number) => void;
}

export async function runWithRetries<T>(
  fn: () => Promise<T> | T,
  options: RetryOptions,
): Promise<{ value: T; attempts: number }> {
  const retries = Math.max(0, Math.floor(options.retries));
  const delayMs = options.delayMs ?? 0;
  let lastError: unknown;

  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    try {
      return { value: await fn(), attempts: attempt };
    } catch (error) {
      lastError = error;
      const more = attempt <= retries;
      const allowed = more && (options.shouldRetry ? options.shouldRetry(error, attempt) : true);
      if (!allowed) throw error;
      options.onRetry?.(error, attempt);
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

export function runWithTimeout<T>(
  factory: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number | undefined,
  taskId = "task",
): Promise<T> {
  if (!timeoutMs || timeoutMs <= 0) return factory(new AbortController().signal);
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new TaskTimeoutError(taskId, timeoutMs));
    }, timeoutMs);
  });
  return Promise.race([factory(controller.signal), timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export interface RunTaskGraphOptions {
  defaultTimeoutMs?: number;
  defaultRetries?: number;
  retryDelayMs?: number;
  onTaskStart?: (id: string) => void;
  onTaskComplete?: (id: string, durationMs: number) => void;
  onTaskFailure?: (id: string, error: unknown, attempts: number) => void;
}

export interface TaskGraphRunResult {
  results: Map<string, unknown>;
  order: string[];
  layers: string[][];
  durationMs: number;
}

export async function runTaskGraph(
  tasks: readonly TaskDefinition[],
  options: RunTaskGraphOptions = {},
): Promise<TaskGraphRunResult> {
  const startedAt = Date.now();
  const graph = buildTaskGraph(tasks);
  const results = new Map<string, unknown>();
  const order: string[] = [];

  const timeoutFor = (task: TaskDefinition): number | undefined =>
    task.timeoutMs ?? options.defaultTimeoutMs;
  const retriesFor = (task: TaskDefinition): number => task.retries ?? options.defaultRetries ?? 0;

  for (const layer of graph.layers) {
    await Promise.all(
      layer.map(async (id) => {
        const task = graph.tasks.get(id);
        if (!task) return;
        options.onTaskStart?.(id);
        const taskStartedAt = Date.now();
        try {
          const attempt = await runWithRetries(
            () =>
              runWithTimeout(
                (signal) => Promise.resolve(task.run({ id, results, signal })),
                timeoutFor(task),
                id,
              ),
            {
              retries: retriesFor(task),
              delayMs: options.retryDelayMs ?? 0,
              onRetry: (error, tries) => options.onTaskFailure?.(id, error, tries),
            },
          );
          results.set(id, attempt.value);
          order.push(id);
          options.onTaskComplete?.(id, Date.now() - taskStartedAt);
        } catch (error) {
          options.onTaskFailure?.(id, error, retriesFor(task) + 1);
          throw error;
        }
      }),
    );
  }

  return {
    results,
    order,
    layers: graph.layers.map((layer) => [...layer]),
    durationMs: Date.now() - startedAt,
  };
}
