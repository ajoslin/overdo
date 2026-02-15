import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { nextReady, type TaskNode } from "../../src/scheduler/index.js";
import { claimTask } from "../../src/workers/index.js";

describe("spawn and dispatch proof", () => {
  it("claims the next ready task from fixture graph", () => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const fixturePath = join(__dirname, "..", "fixtures", "task-graph.json");
    const graph = JSON.parse(readFileSync(fixturePath, "utf8")) as {
      nodes: TaskNode[];
    };

    const task = nextReady(graph.nodes);
    expect(task?.id).toBe("foundation");

    const dispatch = claimTask(task!.id, "worker-local-1");
    expect(dispatch).toEqual({ taskId: "foundation", workerId: "worker-local-1" });
  });
});
