import { DatabaseSync } from "node:sqlite";
import { emitCheckpoint } from "../runtime/checkpoints.js";

export type CommitRequest = {
  taskId: string;
  summary: string;
  manifest?: {
    paths: string[];
    baseRevision?: string;
    currentRevision?: string;
  };
};

export function enqueueCommit(db: DatabaseSync, request: CommitRequest): number {
  const now = new Date().toISOString();
  const manifest = request.manifest ?? { paths: [] };
  if (!Array.isArray(manifest.paths) || manifest.paths.length === 0) {
    throw new Error("commit manifest must contain at least one path");
  }
  const result = db
    .prepare(
      "insert into commit_queue (task_id, status, summary, manifest_json, base_revision, current_revision, created_at) values (?, 'queued', ?, ?, ?, ?, ?)"
    )
    .run(
      request.taskId,
      request.summary,
      JSON.stringify({ paths: manifest.paths }),
      manifest.baseRevision ?? null,
      manifest.currentRevision ?? null,
      now
    );
  emitCheckpoint("commit-enqueued-before-lock", { taskId: request.taskId, summary: request.summary });
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

  db.prepare("insert into env_locks (name, owner, expires_at) values ('global_commit', ?, ?)").run(owner, expiresAt);
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
    emitCheckpoint("commit-lock-held", { owner: input.owner, taskId: input.taskId });
    const queued = db
      .prepare(
        "select id, manifest_json, base_revision, current_revision from commit_queue where task_id = ? and status = 'queued' order by id asc limit 1"
      )
      .get(input.taskId) as
      | {
          id: number;
          manifest_json: string;
          base_revision: string | null;
          current_revision: string | null;
        }
      | undefined;

    if (!queued) {
      return false;
    }

    const manifest = JSON.parse(queued.manifest_json) as { paths?: string[] };
    if (!Array.isArray(manifest.paths) || manifest.paths.length === 0) {
      db.prepare("update commit_queue set status = 'failed' where id = ?").run(queued.id);
      return false;
    }

    if (queued.base_revision && queued.current_revision && queued.base_revision !== queued.current_revision) {
      throw new Error("stale base revision detected for queued commit");
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

export function listQueuedCommits(db: DatabaseSync): Array<{
  id: number;
  taskId: string;
  summary: string;
  manifestPaths: string[];
}> {
  const rows = db
    .prepare("select id, task_id, summary, manifest_json from commit_queue where status = 'queued' order by id asc")
    .all() as Array<{ id: number; task_id: string; summary: string; manifest_json: string }>;

  return rows.map((row) => {
    const parsed = JSON.parse(row.manifest_json) as { paths?: string[] };
    return {
      id: row.id,
      taskId: row.task_id,
      summary: row.summary,
      manifestPaths: parsed.paths ?? []
    };
  });
}
