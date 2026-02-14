import { DatabaseSync } from "node:sqlite";

export type TaskState = "pending" | "running" | "done";

export type TaskRecord = {
  id: string;
  title: string;
  status: TaskState;
};

function nowIso(): string {
  return new Date().toISOString();
}

export function createTask(db: DatabaseSync, task: { id: string; title: string; status?: TaskState }): TaskRecord {
  const createdAt = nowIso();
  db.prepare(
    "insert into tasks (id, title, status, created_at, updated_at) values (?, ?, ?, ?, ?)"
  ).run(task.id, task.title, task.status ?? "pending", createdAt, createdAt);
  return getTask(db, task.id);
}

export function getTask(db: DatabaseSync, id: string): TaskRecord {
  const row = db.prepare("select id, title, status from tasks where id = ?").get(id) as
    | { id: string; title: string; status: TaskState }
    | undefined;
  if (!row) {
    throw new Error(`task not found: ${id}`);
  }
  return row;
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

function dependsOnTask(db: DatabaseSync, sourceTask: string, targetTask: string): boolean {
  const direct = db
    .prepare("select depends_on from task_dependencies where task_id = ?")
    .all(sourceTask) as Array<{ depends_on: string }>;
  for (const item of direct) {
    if (item.depends_on === targetTask) {
      return true;
    }
    if (dependsOnTask(db, item.depends_on, targetTask)) {
      return true;
    }
  }
  return false;
}

function hasCycle(db: DatabaseSync, taskId: string): boolean {
  return dependsOnTask(db, taskId, taskId);
}

export function transitionTask(db: DatabaseSync, taskId: string, nextStatus: TaskState): TaskRecord {
  const current = getTask(db, taskId);
  const allowed: Record<TaskState, TaskState[]> = {
    pending: ["running"],
    running: ["done", "pending"],
    done: []
  };
  if (!allowed[current.status].includes(nextStatus)) {
    throw new Error(`invalid transition ${current.status} -> ${nextStatus}`);
  }
  db.prepare("update tasks set status = ?, updated_at = ? where id = ?").run(nextStatus, nowIso(), taskId);
  return getTask(db, taskId);
}

export function nextReadyTask(db: DatabaseSync): TaskRecord | null {
  const rows = db.prepare("select id, title, status from tasks where status = 'pending' order by id asc").all() as TaskRecord[];
  for (const row of rows) {
    const deps = db
      .prepare(
        "select td.depends_on as depends_on, t.status as status from task_dependencies td join tasks t on t.id = td.depends_on where td.task_id = ?"
      )
      .all(row.id) as Array<{ depends_on: string; status: TaskState }>;
    if (deps.every((dep) => dep.status === "done")) {
      return row;
    }
  }
  return null;
}
