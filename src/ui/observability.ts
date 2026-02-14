import { DatabaseSync } from "node:sqlite";

export type UiSnapshot = {
  workers: number;
  activeTaskLeases: number;
  activePathLeases: number;
  activeLocks: number;
  queuedCommits: number;
};

export function buildUiSnapshot(db: DatabaseSync): UiSnapshot {
  const workers = Number((db.prepare("select count(*) as count from task_leases").get() as { count: number }).count);
  const activeTaskLeases = workers;
  const activePathLeases = Number(
    (db.prepare("select count(*) as count from path_leases").get() as { count: number }).count
  );
  const activeLocks = Number((db.prepare("select count(*) as count from env_locks").get() as { count: number }).count);
  const queuedCommits = Number(
    (
      db
        .prepare("select count(*) as count from commit_queue where status = 'queued'")
        .get() as { count: number }
    ).count
  );

  return {
    workers,
    activeTaskLeases,
    activePathLeases,
    activeLocks,
    queuedCommits
  };
}
