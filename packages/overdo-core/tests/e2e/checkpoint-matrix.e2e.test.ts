import { afterEach, describe, expect, it } from "vitest";

import { OverdoMcpV1 } from "../../src/mcp/v1.js";
import { processNextCommit } from "../../src/commits/coordinator.js";
import { setCheckpointHook, type CheckpointName } from "../../src/runtime/checkpoints.js";
import { setupTestDb } from "../helpers/db.js";

function crashAt(name: CheckpointName): void {
  setCheckpointHook((checkpoint) => {
    if (checkpoint === name) {
      throw new Error(`simulated crash at ${name}`);
    }
  });
}

describe("checkpoint crash matrix", () => {
  afterEach(() => {
    setCheckpointHook(null);
  });

  it("recovers from lease-claimed-before-running checkpoint crash", () => {
    const db = setupTestDb();
    const mcp = new OverdoMcpV1(db);
    mcp.tasksCreate({ id: "t1", title: "Task" });

    crashAt("lease-claimed-before-running");
    expect(() => mcp.workersDispatch(["w1"], 1, 60_000)).not.toThrow();

    setCheckpointHook(null);
    const status = db.prepare("select status from tasks where id = ?").get("t1") as { status: string };
    expect(status.status).toBe("pending");

    const second = mcp.workersDispatch(["w1"], 1, 60_000);
    expect(second).toHaveLength(1);
    const running = db.prepare("select status from tasks where id = ?").get("t1") as { status: string };
    expect(running.status).toBe("running");
  });

  it("recovers from loop-started-before-iteration checkpoint crash", () => {
    const db = setupTestDb();
    const mcp = new OverdoMcpV1(db);
    mcp.tasksCreate({ id: "t1", title: "Task" });
    mcp.loopsDefine("t1", { requiredGates: ["lint"], neverGiveUp: false, maxAttempts: 2 });

    crashAt("loop-started-before-iteration");
    expect(() => mcp.loopsStart("t1")).toThrow("simulated crash");

    setCheckpointHook(null);
    const run = mcp.loopsStart("t1");
    const iter = mcp.loopsRecordIteration({
      runId: run.id,
      taskId: "t1",
      attempt: 1,
      gateResults: [{ gate: "lint", passed: true }]
    });
    expect(iter.decision).toBe("complete");
  });

  it("recovers from loop-failed-before-retry-schedule checkpoint crash", () => {
    const db = setupTestDb();
    const mcp = new OverdoMcpV1(db);
    mcp.tasksCreate({ id: "t1", title: "Task" });
    mcp.loopsDefine("t1", { requiredGates: ["lint"], neverGiveUp: false, maxAttempts: 2 });
    const run = mcp.loopsStart("t1");

    crashAt("loop-failed-before-retry-schedule");
    expect(() =>
      mcp.loopsRecordIteration({
        runId: run.id,
        taskId: "t1",
        attempt: 1,
        gateResults: [{ gate: "lint", passed: false }],
        failureMessage: "failed"
      })
    ).toThrow("simulated crash");

    setCheckpointHook(null);
    const iterations = mcp.loopsIterations(run.id);
    expect(iterations).toHaveLength(1);
    expect(iterations[0].decision).toBe("retry");

    const second = mcp.loopsRecordIteration({
      runId: run.id,
      taskId: "t1",
      attempt: 2,
      gateResults: [{ gate: "lint", passed: true }]
    });
    expect(second.decision).toBe("complete");
  });

  it("recovers from commit-enqueued-before-lock checkpoint crash", () => {
    const db = setupTestDb();
    const mcp = new OverdoMcpV1(db);
    mcp.tasksCreate({ id: "t1", title: "Task" });

    crashAt("commit-enqueued-before-lock");
    expect(() =>
      mcp.commitsEnqueue({
        taskId: "t1",
        summary: "checkpoint",
        paths: ["src/mcp/v1.ts"],
        baseRevision: "r1",
        currentRevision: "r1"
      })
    ).toThrow("simulated crash");

    setCheckpointHook(null);
    expect(processNextCommit(db, { owner: "w1", taskId: "t1", commitSha: "abc" })).toBe(true);
  });

  it("recovers from commit-lock-held checkpoint crash", () => {
    const db = setupTestDb();
    const mcp = new OverdoMcpV1(db);
    mcp.tasksCreate({ id: "t1", title: "Task" });
    mcp.commitsEnqueue({
      taskId: "t1",
      summary: "checkpoint",
      paths: ["src/mcp/v1.ts"],
      baseRevision: "r1",
      currentRevision: "r1"
    });

    crashAt("commit-lock-held");
    expect(() => processNextCommit(db, { owner: "w1", taskId: "t1", commitSha: "abc" })).toThrow("simulated crash");

    const lockCount = db.prepare("select count(*) as count from env_locks where name = 'global_commit'").get() as {
      count: number;
    };
    expect(lockCount.count).toBe(0);

    setCheckpointHook(null);
    expect(processNextCommit(db, { owner: "w1", taskId: "t1", commitSha: "abc" })).toBe(true);
  });
});
