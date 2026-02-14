import { DatabaseSync } from "node:sqlite";

function isoAfter(ms: number): string {
  return new Date(Date.now() + ms).toISOString();
}

export function claimTaskLease(db: DatabaseSync, taskId: string, owner: string, ttlMs: number): boolean {
  const now = new Date().toISOString();
  db.prepare("delete from task_leases where expires_at <= ?").run(now);

  const existing = db.prepare("select owner from task_leases where task_id = ?").get(taskId) as
    | { owner: string }
    | undefined;
  if (existing) {
    return false;
  }

  db.prepare("insert into task_leases (task_id, owner, expires_at) values (?, ?, ?)").run(
    taskId,
    owner,
    isoAfter(ttlMs)
  );
  return true;
}

export function heartbeatTaskLease(db: DatabaseSync, taskId: string, owner: string, ttlMs: number): boolean {
  const updated = db
    .prepare("update task_leases set expires_at = ? where task_id = ? and owner = ?")
    .run(isoAfter(ttlMs), taskId, owner);
  return updated.changes > 0;
}

export function releaseTaskLease(db: DatabaseSync, taskId: string, owner: string): void {
  db.prepare("delete from task_leases where task_id = ? and owner = ?").run(taskId, owner);
}

export function claimPathLease(db: DatabaseSync, path: string, owner: string, ttlMs: number): boolean {
  const now = new Date().toISOString();
  db.prepare("delete from path_leases where expires_at <= ?").run(now);
  const existing = db.prepare("select owner from path_leases where path = ?").get(path) as
    | { owner: string }
    | undefined;
  if (existing) {
    return false;
  }
  db.prepare("insert into path_leases (path, owner, expires_at) values (?, ?, ?)").run(path, owner, isoAfter(ttlMs));
  return true;
}
