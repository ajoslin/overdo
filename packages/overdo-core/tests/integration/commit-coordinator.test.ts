import { describe, expect, it } from "vitest";

import { acquireCommitLock, enqueueCommit, listQueuedCommits, processNextCommit } from "../../src/commits/coordinator.js";
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
    enqueueCommit(db, {
      taskId: "task-1",
      summary: "checkpoint",
      manifest: { paths: ["src/foundation/task-graph.ts"], baseRevision: "r1", currentRevision: "r1" }
    });

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

    expect(listQueuedCommits(db)).toHaveLength(0);
  });

  it("rejects stale base revisions in queued commit", () => {
    const db = setupTestDb();
    enqueueCommit(db, {
      taskId: "task-2",
      summary: "checkpoint",
      manifest: { paths: ["src/mcp/v1.ts"], baseRevision: "r1", currentRevision: "r2" }
    });

    expect(() =>
      processNextCommit(db, {
        owner: "worker-a",
        taskId: "task-2",
        commitSha: "deadbeef"
      })
    ).toThrow("stale base revision detected");

    const queued = db.prepare("select status from commit_queue where task_id = ?").get("task-2") as { status: string };
    expect(queued.status).toBe("queued");
  });

  it("marks malformed queued commit row as failed and continues", () => {
    const db = setupTestDb();
    db.prepare(
      "insert into commit_queue (task_id, status, summary, manifest_json, base_revision, current_revision, created_at) values (?, 'queued', ?, ?, ?, ?, ?)"
    ).run("task-4", "bad manifest", JSON.stringify({ paths: [] }), "r1", "r1", new Date().toISOString());

    const processed = processNextCommit(db, {
      owner: "worker-a",
      taskId: "task-4",
      commitSha: "abc"
    });
    expect(processed).toBe(false);

    const row = db.prepare("select status from commit_queue where task_id = ?").get("task-4") as { status: string };
    expect(row.status).toBe("failed");
  });

  it("rejects enqueue when manifest paths are empty", () => {
    const db = setupTestDb();
    expect(() =>
      enqueueCommit(db, {
        taskId: "task-3",
        summary: "bad",
        manifest: { paths: [] }
      })
    ).toThrow("commit manifest must contain at least one path");
  });
});
