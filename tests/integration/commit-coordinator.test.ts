import { describe, expect, it } from "vitest";

import { acquireCommitLock, enqueueCommit, processNextCommit } from "../../src/commits/coordinator.js";
import { setupTestDb } from "../helpers/db.js";

describe("commit coordinator", () => {
  it("serializes commit lock acquisition under contention", () => {
    const db = setupTestDb();
    const first = acquireCommitLock(db, "worker-a", 60_000);
    const second = acquireCommitLock(db, "worker-b", 60_000);

    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it("processes queued commits and persists transaction audit trail", () => {
    const db = setupTestDb();
    enqueueCommit(db, { taskId: "task-1", summary: "checkpoint" });

    const processed = processNextCommit(db, {
      owner: "worker-a",
      taskId: "task-1",
      commitSha: "abc123def456"
    });

    expect(processed).toBe(true);

    const queueRow = db.prepare("select status from commit_queue where task_id = ?").get("task-1") as {
      status: string;
    };
    expect(queueRow.status).toBe("committed");

    const txRow = db.prepare("select task_id, commit_sha from commit_transactions where task_id = ?").get("task-1") as {
      task_id: string;
      commit_sha: string;
    };
    expect(txRow).toEqual({ task_id: "task-1", commit_sha: "abc123def456" });
  });
});
