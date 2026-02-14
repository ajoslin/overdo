import { DatabaseSync } from "node:sqlite";

import { appendEvent } from "../foundation/event-log.js";
import {
  addDependency,
  createTask,
  getTask,
  nextReadyTask,
  transitionTask,
  type TaskRecord
} from "../foundation/task-graph.js";

export class OverdoMcpV1 {
  constructor(private readonly db: DatabaseSync) {}

  tasksCreate(input: { id: string; title: string }): TaskRecord {
    const task = createTask(this.db, { id: input.id, title: input.title });
    appendEvent(this.db, {
      taskId: task.id,
      eventType: "task.created",
      payload: JSON.stringify(task),
      idempotencyKey: `task-created:${task.id}`
    });
    return task;
  }

  tasksGet(id: string): TaskRecord {
    return getTask(this.db, id);
  }

  tasksBlock(taskId: string, dependsOn: string): void {
    addDependency(this.db, taskId, dependsOn);
    appendEvent(this.db, {
      taskId,
      eventType: "task.blocked",
      payload: JSON.stringify({ dependsOn }),
      idempotencyKey: `task-blocked:${taskId}:${dependsOn}`
    });
  }

  tasksNextReady(): TaskRecord | null {
    return nextReadyTask(this.db);
  }

  tasksTransition(taskId: string, nextStatus: "pending" | "running" | "done"): TaskRecord {
    const task = transitionTask(this.db, taskId, nextStatus);
    appendEvent(this.db, {
      taskId: task.id,
      eventType: "task.transitioned",
      payload: JSON.stringify({ nextStatus }),
      idempotencyKey: `task-transitioned:${task.id}:${task.status}:${Date.now()}`
    });
    return task;
  }
}
