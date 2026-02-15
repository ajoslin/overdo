import { describe, expect, it } from "vitest";

import { enqueueCommit } from "../../src/commits/coordinator.js";
import { createTask } from "../../src/foundation/task-graph.js";
import { claimPathLease, claimTaskLease } from "../../src/runtime/leases.js";
import { buildUiSnapshot, buildUiViews } from "../../src/ui/observability.js";
import { startLoopRun } from "../../src/validation/loop-engine.js";
import { setupTestDb } from "../helpers/db.js";

describe("UI observability snapshot", () => {
  it("reports active orchestration telemetry", () => {
    const db = setupTestDb();
    createTask(db, { id: "t1", title: "Task 1" });
    claimTaskLease(db, "t1", "worker-a", 60_000);
    claimPathLease(db, "src/foundation/schema.ts", "worker-a", 60_000);
    enqueueCommit(db, { taskId: "t1", summary: "checkpoint", manifest: { paths: ["src/foundation/schema.ts"] } });
    const run = startLoopRun(db, "t1", { requiredGates: ["lint"], neverGiveUp: false, maxAttempts: 1 });
    db.prepare("update loop_runs set run_status = 'escalated' where id = ?").run(run.id);

    const snapshot = buildUiSnapshot(db);
    expect(snapshot).toEqual({
      workers: 1,
      activeTaskLeases: 1,
      activePathLeases: 1,
      activeLocks: 0,
      queuedCommits: 1,
      runningTasks: 0,
      pendingTasks: 1,
      escalatedLoops: 1
    });
  });

  it("builds graph/list/kanban views from task state", () => {
    const db = setupTestDb();
    createTask(db, { id: "a", title: "Task A", status: "done" });
    createTask(db, { id: "b", title: "Task B", status: "running" });
    createTask(db, { id: "c", title: "Task C", status: "pending" });
    db.prepare("insert into task_dependencies (task_id, depends_on) values (?, ?)").run("c", "a");

    const views = buildUiViews(db);
    expect(views.graph).toEqual([
      { id: "a", blockedBy: [] },
      { id: "b", blockedBy: [] },
      { id: "c", blockedBy: ["a"] }
    ]);
    expect(views.kanban.done.map((task) => task.id)).toEqual(["a"]);
    expect(views.kanban.running.map((task) => task.id)).toEqual(["b"]);
    expect(views.kanban.pending.map((task) => task.id)).toEqual(["c"]);
  });
});
