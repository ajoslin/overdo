import { describe, expect, it } from "vitest";

import { enqueueCommit } from "../../src/commits/coordinator.js";
import { createTask } from "../../src/foundation/task-graph.js";
import { claimPathLease, claimTaskLease } from "../../src/runtime/leases.js";
import { buildUiSnapshot } from "../../src/ui/observability.js";
import { setupTestDb } from "../helpers/db.js";

describe("UI observability snapshot", () => {
  it("reports active orchestration telemetry", () => {
    const db = setupTestDb();
    createTask(db, { id: "t1", title: "Task 1" });
    claimTaskLease(db, "t1", "worker-a", 60_000);
    claimPathLease(db, "src/foundation/schema.ts", "worker-a", 60_000);
    enqueueCommit(db, { taskId: "t1", summary: "checkpoint" });

    const snapshot = buildUiSnapshot(db);
    expect(snapshot).toEqual({
      workers: 1,
      activeTaskLeases: 1,
      activePathLeases: 1,
      activeLocks: 0,
      queuedCommits: 1
    });
  });
});
