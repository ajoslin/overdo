import { describe, expect, it } from "vitest";

import { createTask } from "../../src/foundation/task-graph.js";
import { dispatchReadyTasks, reclaimExpiredLeases } from "../../src/runtime/scheduler.js";
import { setupTestDb } from "../helpers/db.js";

describe("scheduler and lease runtime", () => {
  it("dispatches non-overlapping tasks with bounded concurrency", () => {
    const db = setupTestDb();
    createTask(db, { id: "t1", title: "Task 1" });
    createTask(db, { id: "t2", title: "Task 2" });
    createTask(db, { id: "t3", title: "Task 3" });

    const dispatches = dispatchReadyTasks(db, ["w1", "w2", "w3"], 2, 30_000);
    expect(dispatches).toHaveLength(2);
    expect(new Set(dispatches.map((item) => item.taskId)).size).toBe(2);
  });

  it("reclaims stale running tasks back to pending on restart", () => {
    const db = setupTestDb();
    createTask(db, { id: "t1", title: "Task 1" });
    dispatchReadyTasks(db, ["w1"], 1, -1);

    const reclaimed = reclaimExpiredLeases(db);
    expect(reclaimed).toBe(1);

    const row = db.prepare("select status from tasks where id = ?").get("t1") as { status: string };
    expect(row.status).toBe("pending");
  });
});
