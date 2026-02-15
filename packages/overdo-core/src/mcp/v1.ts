import { DatabaseSync } from "node:sqlite";

import { enqueueCommit, listQueuedCommits, processNextCommit } from "../commits/coordinator.js";
import { appendEvent, listEvents, replayEvents, type EventFilter } from "../foundation/event-log.js";
import {
  addDependency,
  createTask,
  getTask,
  isTaskReady,
  listBlockedBy,
  nextReadyTask,
  transitionTask,
  type TaskRecord
} from "../foundation/task-graph.js";
import { claimPathLease, claimTaskLease, releasePathLease, releaseTaskLease } from "../runtime/leases.js";
import { dispatchReadyTasks, reclaimExpiredLeases, schedulerSnapshot } from "../runtime/scheduler.js";
import {
  appendLoopIteration,
  evaluateLoop,
  listLoopIterations,
  startLoopRun,
  type GateResult,
  type LoopContract
} from "../validation/loop-engine.js";

export class OverdoMcpV1 {
  constructor(private readonly db: DatabaseSync) {}

  tasksCreate(input: { id: string; title: string; priority?: number }): TaskRecord {
    const task = createTask(this.db, { id: input.id, title: input.title, priority: input.priority });
    this.recordEvent(task.id, "task.created", task, `task-created:${task.id}`);
    return task;
  }

  tasksGet(id: string): TaskRecord {
    return getTask(this.db, id);
  }

  tasksBlock(taskId: string, dependsOn: string): void {
    addDependency(this.db, taskId, dependsOn);
    this.recordEvent(taskId, "task.blocked", { dependsOn }, `task-blocked:${taskId}:${dependsOn}`);
  }

  tasksBlockedBy(taskId: string): string[] {
    return listBlockedBy(this.db, taskId);
  }

  tasksNextReady(): TaskRecord | null {
    return nextReadyTask(this.db);
  }

  tasksIsReady(taskId: string): boolean {
    return isTaskReady(this.db, taskId);
  }

  tasksTransition(taskId: string, nextStatus: "pending" | "running" | "done"): TaskRecord {
    const previous = getTask(this.db, taskId);
    const task = transitionTask(this.db, taskId, nextStatus);
    this.recordEvent(
      task.id,
      "task.transitioned",
      { from: previous.status, to: nextStatus },
      `task-transitioned:${task.id}:${previous.status}:${nextStatus}:${Date.now()}`
    );
    return task;
  }

  eventsList(filter?: EventFilter): ReturnType<typeof listEvents> {
    return listEvents(this.db, filter);
  }

  eventsReplay(afterEventId = 0, limit = 100): ReturnType<typeof replayEvents> {
    return replayEvents(this.db, afterEventId, limit);
  }

  loopsDefine(taskId: string, contract: LoopContract): void {
    this.db
      .prepare(
        "insert into loop_definitions (task_id, required_gates, never_give_up, max_attempts) values (?, ?, ?, ?) on conflict(task_id) do update set required_gates = excluded.required_gates, never_give_up = excluded.never_give_up, max_attempts = excluded.max_attempts"
      )
      .run(taskId, JSON.stringify(contract.requiredGates), contract.neverGiveUp ? 1 : 0, contract.maxAttempts);
    this.recordEvent(taskId, "loop.defined", contract, `loop-defined:${taskId}`);
  }

  loopsStart(taskId: string, contractOverride?: LoopContract): ReturnType<typeof startLoopRun> {
    const contract = contractOverride ?? this.loopContract(taskId);
    const run = startLoopRun(this.db, taskId, contract);
    this.recordEvent(taskId, "loop.started", { runId: run.id }, `loop-started:${taskId}:${run.id}`);
    return run;
  }

  loopsEvaluate(runId: number, gateResults: GateResult[], attemptsUsed: number): ReturnType<typeof evaluateLoop> {
    const row = this.db.prepare("select contract_snapshot from loop_runs where id = ?").get(runId) as
      | { contract_snapshot: string }
      | undefined;
    if (!row) {
      throw new Error(`loop run not found: ${runId}`);
    }
    return evaluateLoop(JSON.parse(row.contract_snapshot) as LoopContract, gateResults, attemptsUsed);
  }

  loopsRecordIteration(input: {
    runId: number;
    taskId: string;
    attempt: number;
    gateResults: GateResult[];
    failureMessage?: string;
    artifact?: Record<string, unknown>;
  }): ReturnType<typeof appendLoopIteration> {
    const iteration = appendLoopIteration(this.db, input);
    this.recordEvent(
      input.taskId,
      "loop.iteration",
      { runId: input.runId, attempt: input.attempt, decision: iteration.decision },
      `loop-iteration:${input.runId}:${input.attempt}`
    );
    return iteration;
  }

  loopsIterations(runId: number): ReturnType<typeof listLoopIterations> {
    return listLoopIterations(this.db, runId);
  }

  leasesClaimTask(taskId: string, owner: string, ttlMs: number): boolean {
    return claimTaskLease(this.db, taskId, owner, ttlMs);
  }

  leasesReleaseTask(taskId: string, owner: string): void {
    releaseTaskLease(this.db, taskId, owner);
  }

  leasesClaimPath(path: string, owner: string, ttlMs: number): boolean {
    return claimPathLease(this.db, path, owner, ttlMs);
  }

  leasesReleasePath(path: string, owner: string): void {
    releasePathLease(this.db, path, owner);
  }

  workersDispatch(workers: string[], maxConcurrency: number, leaseTtlMs: number) {
    return dispatchReadyTasks(this.db, workers, maxConcurrency, leaseTtlMs);
  }

  workersReclaimExpired() {
    return reclaimExpiredLeases(this.db);
  }

  workersSnapshot() {
    return schedulerSnapshot(this.db);
  }

  commitsEnqueue(input: { taskId: string; summary: string; paths: string[]; baseRevision?: string; currentRevision?: string }): number {
    return enqueueCommit(this.db, {
      taskId: input.taskId,
      summary: input.summary,
      manifest: {
        paths: input.paths,
        baseRevision: input.baseRevision,
        currentRevision: input.currentRevision
      }
    });
  }

  commitsProcess(input: { owner: string; commitSha: string; taskId: string }): boolean {
    return processNextCommit(this.db, input);
  }

  commitsQueued() {
    return listQueuedCommits(this.db);
  }

  private loopContract(taskId: string): LoopContract {
    const row = this.db
      .prepare("select required_gates, never_give_up, max_attempts from loop_definitions where task_id = ?")
      .get(taskId) as
      | { required_gates: string; never_give_up: number; max_attempts: number }
      | undefined;
    if (!row) {
      return { requiredGates: ["lint", "unit"], neverGiveUp: true, maxAttempts: 5 };
    }
    return {
      requiredGates: JSON.parse(row.required_gates) as LoopContract["requiredGates"],
      neverGiveUp: row.never_give_up === 1,
      maxAttempts: row.max_attempts
    };
  }

  private recordEvent(taskId: string, eventType: string, payload: unknown, idempotencyKey: string): void {
    appendEvent(this.db, {
      taskId,
      eventType,
      payload: JSON.stringify(payload),
      idempotencyKey,
      source: "mcp",
      correlationId: taskId
    });
  }
}
