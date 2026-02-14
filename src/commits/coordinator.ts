import { DatabaseSync } from "node:sqlite";

export type CommitRequest = {
  taskId: string;
  summary: string;
};

export function enqueueCommit(db: DatabaseSync, request: CommitRequest): number {
  const now = new Date().toISOString();
  const result = db
    .prepare("insert into commit_queue (task_id, status, created_at) values (?, 'queued', ?)")
    .run(request.taskId, now);
  return Number(result.lastInsertRowid);
}

export function acquireCommitLock(db: DatabaseSync, owner: string, ttlMs = 30_000): boolean {
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  db.prepare("delete from env_locks where name = 'global_commit' and expires_at <= ?").run(now);

  const existing = db.prepare("select owner from env_locks where name = 'global_commit'").get() as
    | { owner: string }
    | undefined;
  if (existing) {
    return false;
  }

  db.prepare("insert into env_locks (name, owner, expires_at) values ('global_commit', ?, ?)").run(
    owner,
    expiresAt
  );
  return true;
}

export function releaseCommitLock(db: DatabaseSync, owner: string): void {
  db.prepare("delete from env_locks where name = 'global_commit' and owner = ?").run(owner);
}

export function processNextCommit(
  db: DatabaseSync,
  input: { owner: string; commitSha: string; taskId: string }
): boolean {
  if (!acquireCommitLock(db, input.owner)) {
    return false;
  }

  try {
    const queued = db
      .prepare("select id from commit_queue where task_id = ? and status = 'queued' order by id asc limit 1")
      .get(input.taskId) as { id: number } | undefined;

    if (!queued) {
      return false;
    }

    db.prepare("update commit_queue set status = 'committed' where id = ?").run(queued.id);
    db.prepare("insert into commit_transactions (task_id, commit_sha, created_at) values (?, ?, ?)").run(
      input.taskId,
      input.commitSha,
      new Date().toISOString()
    );
    return true;
  } finally {
    releaseCommitLock(db, input.owner);
  }
}
