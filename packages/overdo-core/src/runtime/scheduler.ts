import { DatabaseSync } from "node:sqlite";

import { nextReadyTask, transitionTask, type TaskRecord } from "../foundation/task-graph.js";
import { claimTaskLeaseCas, releaseTaskLease } from "./leases.js";
import { emitCheckpoint } from "./checkpoints.js";

export type DispatchRecord = {
  taskId: string;
  workerId: string;
};

export function dispatchReadyTasks(
  db: DatabaseSync,
  workers: string[],
  maxConcurrency: number,
  leaseTtlMs: number
): DispatchRecord[] {
  const results: DispatchRecord[] = [];
  const selectedWorkers = workers.slice(0, maxConcurrency);

  for (const workerId of selectedWorkers) {
    const candidate = nextReadyTask(db);
    if (!candidate) {
      break;
    }
    if (!claimTaskLeaseCas(db, candidate.id, workerId, leaseTtlMs, null)) {
      continue;
    }
    try {
      emitCheckpoint("lease-claimed-before-running", { taskId: candidate.id, workerId });
      transitionTask(db, candidate.id, "running", { expectedCurrent: "pending" });
      results.push({ taskId: candidate.id, workerId });
    } catch {
      releaseTaskLease(db, candidate.id, workerId);
    }
  }

  return results;
}

export function reclaimExpiredLeases(db: DatabaseSync): number {
  const now = new Date().toISOString();
  const stale = db.prepare("select task_id from task_leases where expires_at <= ?").all(now) as Array<{
    task_id: string;
  }>;
  for (const row of stale) {
    const current = db.prepare("select status from tasks where id = ?").get(row.task_id) as
      | { status: TaskRecord["status"] }
      | undefined;
    if (current?.status === "running") {
      transitionTask(db, row.task_id, "pending");
    }
  }
  db.prepare("delete from task_leases where expires_at <= ?").run(now);
  return stale.length;
}

export function schedulerSnapshot(db: DatabaseSync): {
  running: number;
  pending: number;
  leases: number;
} {
  const running = Number((db.prepare("select count(*) as count from tasks where status = 'running'").get() as { count: number }).count);
  const pending = Number((db.prepare("select count(*) as count from tasks where status = 'pending'").get() as { count: number }).count);
  const leases = Number((db.prepare("select count(*) as count from task_leases").get() as { count: number }).count);
  return { running, pending, leases };
}
