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

export function claimTaskLeaseCas(
  db: DatabaseSync,
  taskId: string,
  owner: string,
  ttlMs: number,
  expectedOwner: string | null
): boolean {
  const now = new Date().toISOString();
  db.prepare("delete from task_leases where expires_at <= ?").run(now);
  if (expectedOwner === null) {
    const inserted = db
      .prepare("insert or ignore into task_leases (task_id, owner, expires_at) values (?, ?, ?)")
      .run(taskId, owner, isoAfter(ttlMs));
    return inserted.changes > 0;
  }

  const updated = db
    .prepare("update task_leases set owner = ?, expires_at = ? where task_id = ? and owner = ?")
    .run(owner, isoAfter(ttlMs), taskId, expectedOwner);
  return updated.changes > 0;
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

export function heartbeatPathLease(db: DatabaseSync, path: string, owner: string, ttlMs: number): boolean {
  const updated = db
    .prepare("update path_leases set expires_at = ? where path = ? and owner = ?")
    .run(isoAfter(ttlMs), path, owner);
  return updated.changes > 0;
}

export function releasePathLease(db: DatabaseSync, path: string, owner: string): void {
  db.prepare("delete from path_leases where path = ? and owner = ?").run(path, owner);
}
