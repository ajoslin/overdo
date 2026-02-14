import { describe, expect, it } from "vitest";

import { health } from "../../src/mcp/index.js";
import { nextReady, type TaskNode } from "../../src/scheduler/index.js";
import { validateMcpReachability } from "../../src/skills/index.js";
import { claimTask } from "../../src/workers/index.js";

describe("baseline modules", () => {
  it("returns a healthy MCP status", () => {
    expect(health()).toEqual({ service: "mcp", status: "ok" });
    expect(validateMcpReachability()).toBe("mcp:ok");
  });

  it("selects the first dependency-ready node", () => {
    const nodes: TaskNode[] = [
      { id: "bootstrap", blockedBy: [], completed: true },
      { id: "foundation", blockedBy: ["bootstrap"], completed: false }
    ];
    expect(nextReady(nodes)?.id).toBe("foundation");
  });

  it("creates worker claim records", () => {
    expect(claimTask("task-1", "worker-A")).toEqual({ taskId: "task-1", workerId: "worker-A" });
    expect(() => claimTask("", "worker-A")).toThrow("taskId and workerId are required");
  });
});
