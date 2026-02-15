import { DatabaseSync } from "node:sqlite";

export type GateName = "lint" | "unit" | "integration" | "e2e";

export type GateResult = {
  gate: GateName;
  passed: boolean;
};

export type LoopContract = {
  requiredGates: GateName[];
  neverGiveUp: boolean;
  maxAttempts: number;
};

export type RetryClass = "retryable" | "recoverable" | "escalate";

export type LoopRunRecord = {
  id: number;
  taskId: string;
  runStatus: "running" | "completed" | "escalated";
  contractSnapshot: LoopContract;
  createdAt: string;
};

export type LoopIterationRecord = {
  id: number;
  runId: number;
  taskId: string;
  attempt: number;
  gateResults: GateResult[];
  failureClass: RetryClass | null;
  decision: "retry" | "complete" | "escalate";
  artifact: Record<string, unknown>;
  createdAt: string;
};

const ESCALATION_MATCHERS = ["permission denied", "no space left", "fatal", "corruption"];
const RECOVERABLE_MATCHERS = ["hook failed", "validation", "rate limit", "conflict"];

export function classifyFailure(message: string): RetryClass {
  const normalized = message.toLowerCase();
  if (ESCALATION_MATCHERS.some((entry) => normalized.includes(entry))) {
    return "escalate";
  }
  if (RECOVERABLE_MATCHERS.some((entry) => normalized.includes(entry))) {
    return "recoverable";
  }
  return "retryable";
}

export function computeBackoffMs(attempt: number): number {
  const bounded = Math.max(1, Math.min(attempt, 7));
  return 250 * 2 ** (bounded - 1);
}

export function evaluateLoop(contract: LoopContract, gateResults: GateResult[], attemptsUsed: number): {
  canComplete: boolean;
  escalationRequired: boolean;
} {
  const gateMap = new Map(gateResults.map((item) => [item.gate, item.passed]));
  const gatesGreen = contract.requiredGates.every((gate) => gateMap.get(gate) === true);
  if (gatesGreen) {
    return { canComplete: true, escalationRequired: false };
  }
  if (!contract.neverGiveUp && attemptsUsed >= contract.maxAttempts) {
    return { canComplete: false, escalationRequired: true };
  }
  return { canComplete: false, escalationRequired: false };
}

export function startLoopRun(db: DatabaseSync, taskId: string, contract: LoopContract): LoopRunRecord {
  const now = new Date().toISOString();
  const result = db
    .prepare("insert into loop_runs (task_id, run_status, contract_snapshot, created_at) values (?, 'running', ?, ?)")
    .run(taskId, JSON.stringify(contract), now);
  const id = Number(result.lastInsertRowid);
  return {
    id,
    taskId,
    runStatus: "running",
    contractSnapshot: contract,
    createdAt: now
  };
}

export function appendLoopIteration(
  db: DatabaseSync,
  input: {
    runId: number;
    taskId: string;
    attempt: number;
    gateResults: GateResult[];
    failureMessage?: string;
    artifact?: Record<string, unknown>;
  }
): LoopIterationRecord {
  const run = getLoopRun(db, input.runId);
  if (run.taskId !== input.taskId) {
    throw new Error(`loop run task mismatch: run=${run.taskId} iteration=${input.taskId}`);
  }

  const evaluation = evaluateLoop(run.contractSnapshot, input.gateResults, input.attempt);
  const decision: LoopIterationRecord["decision"] = evaluation.canComplete
    ? "complete"
    : evaluation.escalationRequired
      ? "escalate"
      : "retry";
  const failureClass = input.failureMessage ? classifyFailure(input.failureMessage) : null;
  const now = new Date().toISOString();

  const result = db
    .prepare(
      "insert into loop_iterations (run_id, task_id, attempt, gate_results, failure_class, decision, artifact, created_at) values (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(
      input.runId,
      input.taskId,
      input.attempt,
      JSON.stringify(input.gateResults),
      failureClass,
      decision,
      JSON.stringify(input.artifact ?? {}),
      now
    );

  if (decision === "complete") {
    db.prepare("update loop_runs set run_status = 'completed' where id = ?").run(input.runId);
  }
  if (decision === "escalate") {
    db.prepare("update loop_runs set run_status = 'escalated' where id = ?").run(input.runId);
  }

  return {
    id: Number(result.lastInsertRowid),
    runId: input.runId,
    taskId: input.taskId,
    attempt: input.attempt,
    gateResults: input.gateResults,
    failureClass,
    decision,
    artifact: input.artifact ?? {},
    createdAt: now
  };
}

export function getLoopRun(db: DatabaseSync, runId: number): LoopRunRecord {
  const row = db
    .prepare("select id, task_id, run_status, contract_snapshot, created_at from loop_runs where id = ?")
    .get(runId) as
    | {
        id: number;
        task_id: string;
        run_status: LoopRunRecord["runStatus"];
        contract_snapshot: string;
        created_at: string;
      }
    | undefined;
  if (!row) {
    throw new Error(`loop run not found: ${runId}`);
  }
  return {
    id: row.id,
    taskId: row.task_id,
    runStatus: row.run_status,
    contractSnapshot: JSON.parse(row.contract_snapshot) as LoopContract,
    createdAt: row.created_at
  };
}

export function listLoopIterations(db: DatabaseSync, runId: number): LoopIterationRecord[] {
  const rows = db
    .prepare(
      "select id, run_id, task_id, attempt, gate_results, failure_class, decision, artifact, created_at from loop_iterations where run_id = ? order by attempt asc"
    )
    .all(runId) as Array<{
    id: number;
    run_id: number;
    task_id: string;
    attempt: number;
    gate_results: string;
    failure_class: RetryClass | null;
    decision: LoopIterationRecord["decision"];
    artifact: string;
    created_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    runId: row.run_id,
    taskId: row.task_id,
    attempt: row.attempt,
    gateResults: JSON.parse(row.gate_results) as GateResult[],
    failureClass: row.failure_class,
    decision: row.decision,
    artifact: JSON.parse(row.artifact) as Record<string, unknown>,
    createdAt: row.created_at
  }));
}
