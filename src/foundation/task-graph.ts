import { DatabaseSync } from "node:sqlite";

export type TaskState = "pending" | "running" | "done";

export type TaskRecord = {
  id: string;
  title: string;
  status: TaskState;
  priority: number;
};

type TransitionOptions = {
  expectedCurrent?: TaskState;
  allowWhenBlocked?: boolean;
};

function nowIso(): string {
  return new Date().toISOString();
}

export function createTask(db: DatabaseSync, task: { id: string; title: string; status?: TaskState; priority?: number }): TaskRecord {
  const createdAt = nowIso();
  const priority = task.priority ?? 1;
  db.prepare(
    "insert into tasks (id, title, status, priority, created_at, updated_at) values (?, ?, ?, ?, ?, ?)"
  ).run(task.id, task.title, task.status ?? "pending", priority, createdAt, createdAt);
  return getTask(db, task.id);
}

export function getTask(db: DatabaseSync, id: string): TaskRecord {
  const row = db.prepare("select id, title, status, priority from tasks where id = ?").get(id) as
    | { id: string; title: string; status: TaskState; priority?: number }
    | undefined;
  if (!row) {
    throw new Error(`task not found: ${id}`);
  }
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    priority: row.priority ?? 1
  };
}

export function addDependency(db: DatabaseSync, taskId: string, dependsOn: string): void {
  if (taskId === dependsOn) {
    throw new Error("task cannot depend on itself");
  }
  db.prepare("insert or ignore into task_dependencies (task_id, depends_on) values (?, ?)").run(
    taskId,
    dependsOn
  );
  if (hasCycle(db, taskId)) {
    db.prepare("delete from task_dependencies where task_id = ? and depends_on = ?").run(taskId, dependsOn);
    throw new Error("dependency cycle detected");
  }
}

function dependsOnTask(db: DatabaseSync, sourceTask: string, targetTask: string, seen = new Set<string>()): boolean {
  if (seen.has(sourceTask)) {
    return false;
  }
  seen.add(sourceTask);
  const direct = db
    .prepare("select depends_on from task_dependencies where task_id = ?")
    .all(sourceTask) as Array<{ depends_on: string }>;
  for (const item of direct) {
    if (item.depends_on === targetTask) {
      return true;
    }
    if (dependsOnTask(db, item.depends_on, targetTask, seen)) {
      return true;
    }
  }
  return false;
}

function hasCycle(db: DatabaseSync, taskId: string): boolean {
  return dependsOnTask(db, taskId, taskId);
}

export function transitionTask(
  db: DatabaseSync,
  taskId: string,
  nextStatus: TaskState,
  options: TransitionOptions = {}
): TaskRecord {
  const current = getTask(db, taskId);
  if (options.expectedCurrent && current.status !== options.expectedCurrent) {
    throw new Error(`optimistic lock failed ${current.status} != ${options.expectedCurrent}`);
  }
  const allowed: Record<TaskState, TaskState[]> = {
    pending: ["running"],
    running: ["done", "pending"],
    done: []
  };
  if (!allowed[current.status].includes(nextStatus)) {
    throw new Error(`invalid transition ${current.status} -> ${nextStatus}`);
  }
  if (nextStatus === "running" && !options.allowWhenBlocked && !isTaskReady(db, taskId)) {
    throw new Error(`task is blocked and cannot transition to running: ${taskId}`);
  }

  db.prepare("update tasks set status = ?, updated_at = ? where id = ?").run(nextStatus, nowIso(), taskId);
  return getTask(db, taskId);
}

export function nextReadyTask(db: DatabaseSync): TaskRecord | null {
  const rows = db
    .prepare("select id, title, status, priority from tasks where status = 'pending' order by priority asc, created_at asc, id asc")
    .all() as Array<{ id: string; title: string; status: TaskState; priority?: number }>;
  for (const row of rows) {
    if (isTaskReady(db, row.id)) {
      return {
        id: row.id,
        title: row.title,
        status: row.status,
        priority: row.priority ?? 1
      };
    }
  }
  return null;
}

export function isTaskReady(db: DatabaseSync, taskId: string): boolean {
  const deps = db
    .prepare(
      "select td.depends_on as depends_on, t.status as status from task_dependencies td join tasks t on t.id = td.depends_on where td.task_id = ?"
    )
    .all(taskId) as Array<{ depends_on: string; status: TaskState }>;
  return deps.every((dep) => dep.status === "done");
}

export function listBlockedBy(db: DatabaseSync, taskId: string): string[] {
  const rows = db.prepare("select depends_on from task_dependencies where task_id = ? order by depends_on asc").all(taskId) as Array<{
    depends_on: string;
  }>;
  return rows.map((row) => row.depends_on);
}
