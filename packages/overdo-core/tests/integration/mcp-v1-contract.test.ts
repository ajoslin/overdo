import { describe, expect, it } from "vitest";

import { listEvents } from "../../src/foundation/event-log.js";
import { OverdoMcpV1 } from "../../src/mcp/v1.js";
import { setupTestDb } from "../helpers/db.js";

describe("MCP v1 contract", () => {
  it("creates tasks, applies blockers, and resolves next ready", () => {
    const db = setupTestDb();
    const mcp = new OverdoMcpV1(db);

    mcp.tasksCreate({ id: "bootstrap", title: "Bootstrap" });
    mcp.tasksCreate({ id: "foundation", title: "Foundation" });
    mcp.tasksBlock("foundation", "bootstrap");

    expect(mcp.tasksNextReady()?.id).toBe("bootstrap");

    mcp.tasksTransition("bootstrap", "running");
    mcp.tasksTransition("bootstrap", "done");

    expect(mcp.tasksNextReady()?.id).toBe("foundation");
  });

  it("guarantees append-only idempotency keys", () => {
    const db = setupTestDb();
    db.prepare(
      "insert into events (task_id, event_type, payload, idempotency_key, created_at) values (?, ?, ?, ?, ?)"
    ).run("t1", "task.created", "{}", "same-key", new Date().toISOString());

    expect(() =>
      db
        .prepare(
          "insert into events (task_id, event_type, payload, idempotency_key, created_at) values (?, ?, ?, ?, ?)"
        )
        .run("t1", "task.created", "{}", "same-key", new Date().toISOString())
    ).toThrow();

    expect(listEvents(db, "t1")).toHaveLength(1);
  });

  it("executes end-to-end loop and commit APIs via MCP", () => {
    const db = setupTestDb();
    const mcp = new OverdoMcpV1(db);

    mcp.tasksCreate({ id: "t1", title: "Task 1", priority: 0 });
    mcp.loopsDefine("t1", { requiredGates: ["lint", "unit"], neverGiveUp: false, maxAttempts: 2 });
    const run = mcp.loopsStart("t1");
    const escalatesAtTwo = mcp.loopsEvaluate(
      run.id,
      [
        { gate: "lint", passed: true },
        { gate: "unit", passed: false }
      ],
      2
    );
    expect(escalatesAtTwo).toEqual({ canComplete: false, escalationRequired: true });

    const first = mcp.loopsRecordIteration({
      runId: run.id,
      taskId: "t1",
      attempt: 1,
      gateResults: [
        { gate: "lint", passed: true },
        { gate: "unit", passed: false }
      ],
      failureMessage: "hook failed"
    });
    expect(first.decision).toBe("retry");

    const second = mcp.loopsRecordIteration({
      runId: run.id,
      taskId: "t1",
      attempt: 2,
      gateResults: [
        { gate: "lint", passed: true },
        { gate: "unit", passed: true }
      ]
    });
    expect(second.decision).toBe("complete");

    const queueId = mcp.commitsEnqueue({
      taskId: "t1",
      summary: "checkpoint",
      paths: ["src/mcp/v1.ts"],
      baseRevision: "r1",
      currentRevision: "r1"
    });
    expect(queueId).toBeGreaterThan(0);
    expect(mcp.commitsProcess({ owner: "worker-a", taskId: "t1", commitSha: "abc" })).toBe(true);
    expect(mcp.commitsQueued()).toHaveLength(0);

    const replay = mcp.eventsReplay(0, 100);
    expect(replay.some((event) => event.eventType === "loop.iteration")).toBe(true);
  });
});
