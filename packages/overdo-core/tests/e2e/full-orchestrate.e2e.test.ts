import { describe, expect, it } from "vitest";

import { buildUiSnapshot } from "../../src/ui/observability.js";
import { OverdoMcpV1 } from "../../src/mcp/v1.js";
import { setupTestDb } from "../helpers/db.js";

describe("overdo e2e orchestration", () => {
  it("runs plan -> dispatch -> loop -> commit -> telemetry flow", () => {
    const db = setupTestDb();
    const mcp = new OverdoMcpV1(db);

    mcp.tasksCreate({ id: "bootstrap", title: "Bootstrap", priority: 0 });
    mcp.tasksCreate({ id: "foundation", title: "Foundation", priority: 1 });
    mcp.tasksBlock("foundation", "bootstrap");

    const dispatches = mcp.workersDispatch(["w1", "w2"], 2, 60_000);
    expect(dispatches).toHaveLength(1);
    expect(dispatches[0]).toEqual({ taskId: "bootstrap", workerId: "w1" });

    mcp.tasksTransition("bootstrap", "done");

    const ready = mcp.tasksNextReady();
    expect(ready?.id).toBe("foundation");

    mcp.loopsDefine("foundation", { requiredGates: ["lint", "unit", "integration", "e2e"], neverGiveUp: false, maxAttempts: 2 });
    const run = mcp.loopsStart("foundation");

    const firstAttempt = mcp.loopsRecordIteration({
      runId: run.id,
      taskId: "foundation",
      attempt: 1,
      gateResults: [
        { gate: "lint", passed: true },
        { gate: "unit", passed: true },
        { gate: "integration", passed: false },
        { gate: "e2e", passed: false }
      ],
      failureMessage: "validation failed",
      artifact: { repro: "bun run integration" }
    });
    expect(firstAttempt.decision).toBe("retry");

    const secondAttempt = mcp.loopsRecordIteration({
      runId: run.id,
      taskId: "foundation",
      attempt: 2,
      gateResults: [
        { gate: "lint", passed: true },
        { gate: "unit", passed: true },
        { gate: "integration", passed: true },
        { gate: "e2e", passed: true }
      ],
      artifact: { repro: "bun run test" }
    });
    expect(secondAttempt.decision).toBe("complete");

    mcp.tasksTransition("foundation", "running");
    mcp.tasksTransition("foundation", "done");
    mcp.leasesReleaseTask("bootstrap", "w1");

    mcp.commitsEnqueue({
      taskId: "foundation",
      summary: "finalize foundation",
      paths: ["src/foundation/schema.ts"],
      baseRevision: "rev-1",
      currentRevision: "rev-1"
    });
    expect(mcp.commitsProcess({ owner: "commit-worker", taskId: "foundation", commitSha: "abc123" })).toBe(true);

    const telemetry = buildUiSnapshot(db);
    expect(telemetry.queuedCommits).toBe(0);
    expect(telemetry.escalatedLoops).toBe(0);
    expect(telemetry.pendingTasks).toBe(0);

    const replay = mcp.eventsReplay(0, 500);
    expect(replay.length).toBeGreaterThan(6);
    expect(replay.some((event) => event.eventType === "loop.iteration")).toBe(true);
  });
});
