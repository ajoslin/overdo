import { DatabaseSync } from "node:sqlite";

import { nextReadyTask, transitionTask, type TaskRecord } from "../foundation/task-graph.js";
import { claimTaskLease } from "./leases.js";

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
    if (!claimTaskLease(db, candidate.id, workerId, leaseTtlMs)) {
      continue;
    }
    transitionTask(db, candidate.id, "running");
    results.push({ taskId: candidate.id, workerId });
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
