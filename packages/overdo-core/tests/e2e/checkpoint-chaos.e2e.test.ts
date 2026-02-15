import { afterEach, describe, expect, it } from "vitest";

import { processNextCommit } from "../../src/commits/coordinator.js";
import { listEvents } from "../../src/foundation/event-log.js";
import { OverdoMcpV1 } from "../../src/mcp/v1.js";
import { setCheckpointHook, type CheckpointName } from "../../src/runtime/checkpoints.js";
import { setupTestDb } from "../helpers/db.js";

const CHECKPOINTS: CheckpointName[] = [
  "lease-claimed-before-running",
  "loop-started-before-iteration",
  "loop-failed-before-retry-schedule",
  "commit-enqueued-before-lock",
  "commit-lock-held"
];

describe("checkpoint chaos matrix", () => {
  afterEach(() => {
    setCheckpointHook(null);
  });

  it("recovers across randomized crash checkpoints without violating invariants", () => {
    let seed = 1337;
    for (let i = 0; i < 20; i += 1) {
      const checkpoint = CHECKPOINTS[nextRand(seed) % CHECKPOINTS.length];
      seed = nextSeed(seed);

      const db = setupTestDb();
      const mcp = new OverdoMcpV1(db);

      mcp.tasksCreate({ id: `t-${i}`, title: `Task ${i}` });
      mcp.loopsDefine(`t-${i}`, { requiredGates: ["lint", "unit"], neverGiveUp: false, maxAttempts: 2 });

      setCheckpointHook((name) => {
        if (name === checkpoint) {
          throw new Error(`chaos crash at ${name}`);
        }
      });

      try {
        runFlow(mcp, db, `t-${i}`);
      } catch {
        // expected for crash checkpoint
      }

      setCheckpointHook(null);
      runFlow(mcp, db, `t-${i}`);

      const status = db.prepare("select status from tasks where id = ?").get(`t-${i}`) as { status: string };
      expect(status.status).toBe("done");

      const txCount = db.prepare("select count(*) as count from commit_transactions where task_id = ?").get(`t-${i}`) as {
        count: number;
      };
      expect(txCount.count).toBe(1);

      const lockCount = db.prepare("select count(*) as count from env_locks where name = 'global_commit'").get() as {
        count: number;
      };
      expect(lockCount.count).toBe(0);

      const loopRows = db.prepare("select count(*) as count from loop_iterations where task_id = ?").get(`t-${i}`) as {
        count: number;
      };
      expect(loopRows.count).toBeGreaterThan(0);

      const events = listEvents(db, { taskId: `t-${i}` });
      expect(events.length).toBeGreaterThan(3);
    }
  });
});

function runFlow(mcp: OverdoMcpV1, db: ReturnType<typeof setupTestDb>, taskId: string): void {
  const current = db.prepare("select status from tasks where id = ?").get(taskId) as { status: string };

  if (current.status === "pending") {
    mcp.workersDispatch(["w1"], 1, 300);
  }

  const updated = db.prepare("select status from tasks where id = ?").get(taskId) as { status: string };
  if (updated.status !== "running" && updated.status !== "done") {
    return;
  }

  if (updated.status === "running") {
    const run = mcp.loopsStart(taskId);
    mcp.loopsRecordIteration({
      runId: run.id,
      taskId,
      attempt: 1,
      gateResults: [
        { gate: "lint", passed: true },
        { gate: "unit", passed: false }
      ],
      failureMessage: "first failure"
    });
    mcp.loopsRecordIteration({
      runId: run.id,
      taskId,
      attempt: 2,
      gateResults: [
        { gate: "lint", passed: true },
        { gate: "unit", passed: true }
      ]
    });

    mcp.tasksTransition(taskId, "done");
    mcp.leasesReleaseTask(taskId, "w1");
  }

  const queued = db.prepare("select count(*) as count from commit_queue where task_id = ? and status = 'queued'").get(taskId) as {
    count: number;
  };

  if (queued.count === 0) {
    mcp.commitsEnqueue({
      taskId,
      summary: `checkpoint ${taskId}`,
      paths: ["src/mcp/v1.ts"],
      baseRevision: "r1",
      currentRevision: "r1"
    });
  }
  processNextCommit(db, { owner: "cw", taskId, commitSha: `sha-${taskId}` });
}

function nextSeed(seed: number): number {
  return (seed * 1103515245 + 12345) & 0x7fffffff;
}

function nextRand(seed: number): number {
  return nextSeed(seed);
}
