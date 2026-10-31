import { describe, expect, it } from "vitest";
import {
  TaskGraphError,
  TaskTimeoutError,
  buildTaskGraph,
  runTaskGraph,
  runWithRetries,
  type TaskDefinition,
} from "../../src/pipeline/task-graph";

function diamond(): TaskDefinition[] {
  return [
    { id: "a", run: () => "a" },
    { id: "b", dependsOn: ["a"], run: (ctx) => `${ctx.results.get("a")}b` },
    { id: "c", dependsOn: ["a"], run: () => "c" },
    { id: "d", dependsOn: ["b", "c"], run: () => "d" },
  ];
}

describe("buildTaskGraph", () => {
  it("produce capas topológicas deterministas", () => {
    const graph = buildTaskGraph(diamond());
    expect(graph.order).toEqual(["a", "b", "c", "d"]);
    expect(graph.layers.map((layer) => [...layer])).toEqual([["a"], ["b", "c"], ["d"]]);
  });

  it("rechaza ids duplicados y vacíos", () => {
    expect(() => buildTaskGraph([{ id: "x", run: () => 1 }, { id: "x", run: () => 2 }])).toThrow(
      TaskGraphError,
    );
    expect(() => buildTaskGraph([{ id: "  ", run: () => 1 }])).toThrow(TaskGraphError);
  });

  it("rechaza dependencias desconocidas y auto-dependencias", () => {
    expect(() => buildTaskGraph([{ id: "a", dependsOn: ["ghost"], run: () => 1 }])).toThrow(
      TaskGraphError,
    );
    expect(() => buildTaskGraph([{ id: "a", dependsOn: ["a"], run: () => 1 }])).toThrow(
      TaskGraphError,
    );
  });

  it("detecta ciclos", () => {
    const cyclic: TaskDefinition[] = [
      { id: "a", dependsOn: ["c"], run: () => 1 },
      { id: "b", dependsOn: ["a"], run: () => 1 },
      { id: "c", dependsOn: ["b"], run: () => 1 },
    ];
    try {
      buildTaskGraph(cyclic);
      throw new Error("debió lanzar");
    } catch (error) {
      expect(error).toBeInstanceOf(TaskGraphError);
      expect((error as TaskGraphError).issues.some((issue) => issue.code === "CYCLE")).toBe(true);
    }
  });
});

describe("runTaskGraph", () => {
  it("ejecuta en orden y propaga resultados entre tareas", async () => {
    const result = await runTaskGraph(diamond());
    expect(result.order).toEqual(["a", "b", "c", "d"]);
    expect(result.results.get("a")).toBe("a");
    expect(result.results.get("b")).toBe("ab");
    expect(result.results.get("d")).toBe("d");
  });

  it("reintenta hasta lograrlo y reporta cada fallo", async () => {
    let calls = 0;
    const failures: number[] = [];
    const result = await runTaskGraph(
      [
        {
          id: "flaky",
          retries: 2,
          run: () => {
            calls += 1;
            if (calls < 3) throw new Error("boom");
            return "ok";
          },
        },
      ],
      { onTaskFailure: (_id, _error, attempt) => failures.push(attempt) },
    );
    expect(calls).toBe(3);
    expect(result.results.get("flaky")).toBe("ok");
    expect(failures).toEqual([1, 2]);
  });

  it("aborta por timeout", async () => {
    await expect(
      runTaskGraph([{ id: "slow", timeoutMs: 20, run: () => new Promise(() => {}) }], {
        defaultTimeoutMs: 20,
      }),
    ).rejects.toThrow(TaskTimeoutError);
  });
});

describe("runWithRetries", () => {
  it("devuelve el número de intentos", async () => {
    let calls = 0;
    const { value, attempts } = await runWithRetries(
      () => {
        calls += 1;
        if (calls < 2) throw new Error("nope");
        return 42;
      },
      { retries: 3 },
    );
    expect(value).toBe(42);
    expect(attempts).toBe(2);
  });

  it("no reintenta si shouldRetry es falso", async () => {
    let calls = 0;
    await expect(
      runWithRetries(
        () => {
          calls += 1;
          throw new Error("fatal");
        },
        { retries: 5, shouldRetry: () => false },
      ),
    ).rejects.toThrow("fatal");
    expect(calls).toBe(1);
  });
});
