import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { nextReady, type TaskNode } from "../../src/scheduler/index.js";
import { claimTask } from "../../src/workers/index.js";

describe("spawn and dispatch proof", () => {
  it("claims the next ready task from fixture graph", () => {
    const graph = JSON.parse(readFileSync("tests/fixtures/task-graph.json", "utf8")) as {
      nodes: TaskNode[];
    };

    const task = nextReady(graph.nodes);
    expect(task?.id).toBe("foundation");

    const dispatch = claimTask(task!.id, "worker-local-1");
    expect(dispatch).toEqual({ taskId: "foundation", workerId: "worker-local-1" });
  });
});
