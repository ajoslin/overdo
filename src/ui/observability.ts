import { DatabaseSync } from "node:sqlite";

export type UiSnapshot = {
  workers: number;
  activeTaskLeases: number;
  activePathLeases: number;
  activeLocks: number;
  queuedCommits: number;
  runningTasks: number;
  pendingTasks: number;
  escalatedLoops: number;
};

export type UiTaskView = {
  id: string;
  title: string;
  status: "pending" | "running" | "done";
  blockedBy: string[];
};

export type UiViews = {
  graph: Array<{ id: string; blockedBy: string[] }>;
  list: UiTaskView[];
  kanban: {
    pending: UiTaskView[];
    running: UiTaskView[];
    done: UiTaskView[];
  };
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
  const runningTasks = Number((db.prepare("select count(*) as count from tasks where status = 'running'").get() as { count: number }).count);
  const pendingTasks = Number((db.prepare("select count(*) as count from tasks where status = 'pending'").get() as { count: number }).count);
  const escalatedLoops = Number(
    (db.prepare("select count(*) as count from loop_runs where run_status = 'escalated'").get() as { count: number }).count
  );

  return {
    workers,
    activeTaskLeases,
    activePathLeases,
    activeLocks,
    queuedCommits,
    runningTasks,
    pendingTasks,
    escalatedLoops
  };
}

export function buildUiViews(db: DatabaseSync): UiViews {
  const tasks = db
    .prepare("select id, title, status from tasks order by created_at asc, id asc")
    .all() as Array<{ id: string; title: string; status: UiTaskView["status"] }>;

  const list = tasks.map((task) => {
    const blockedRows = db
      .prepare("select depends_on from task_dependencies where task_id = ? order by depends_on asc")
      .all(task.id) as Array<{ depends_on: string }>;
    return {
      id: task.id,
      title: task.title,
      status: task.status,
      blockedBy: blockedRows.map((row) => row.depends_on)
    };
  });

  return {
    graph: list.map((task) => ({ id: task.id, blockedBy: task.blockedBy })),
    list,
    kanban: {
      pending: list.filter((task) => task.status === "pending"),
      running: list.filter((task) => task.status === "running"),
      done: list.filter((task) => task.status === "done")
    }
  };
}
