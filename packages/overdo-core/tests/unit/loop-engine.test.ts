import { describe, expect, it } from "vitest";

import {
  appendLoopIteration,
  classifyFailure,
  computeBackoffMs,
  evaluateLoop,
  listLoopIterations,
  startLoopRun,
  type LoopContract
} from "../../src/validation/loop-engine.js";
import { setupTestDb } from "../helpers/db.js";

describe("feedback loop engine", () => {
  it("enforces required gate contract before completion", () => {
    const contract: LoopContract = {
      requiredGates: ["lint", "unit", "integration"],
      neverGiveUp: true,
      maxAttempts: 3
    };

    expect(
      evaluateLoop(
        contract,
        [
          { gate: "lint", passed: true },
          { gate: "unit", passed: true },
          { gate: "integration", passed: false }
        ],
        2
      )
    ).toEqual({ canComplete: false, escalationRequired: false });
  });

  it("escalates when finite retries are exhausted", () => {
    const contract: LoopContract = {
      requiredGates: ["lint", "unit"],
      neverGiveUp: false,
      maxAttempts: 2
    };

    expect(
      evaluateLoop(
        contract,
        [
          { gate: "lint", passed: true },
          { gate: "unit", passed: false }
        ],
        2
      )
    ).toEqual({ canComplete: false, escalationRequired: true });
  });

  it("classifies failures and computes deterministic backoff", () => {
    expect(classifyFailure("hook failed on pre-commit")).toBe("recoverable");
    expect(classifyFailure("fatal corruption in workspace")).toBe("escalate");
    expect(classifyFailure("temporary test flake")).toBe("retryable");

    expect(computeBackoffMs(1)).toBe(250);
    expect(computeBackoffMs(4)).toBe(2000);
    expect(computeBackoffMs(99)).toBe(16000);
  });

  it("persists loop runs and iteration decisions", () => {
    const db = setupTestDb();
    const run = startLoopRun(db, "task-1", {
      requiredGates: ["lint", "unit"],
      neverGiveUp: false,
      maxAttempts: 1
    });

    appendLoopIteration(db, {
      runId: run.id,
      taskId: "task-1",
      attempt: 1,
      gateResults: [
        { gate: "lint", passed: true },
        { gate: "unit", passed: false }
      ],
      failureMessage: "fatal corruption"
    });

    const iterations = listLoopIterations(db, run.id);
    expect(iterations).toHaveLength(1);
    expect(iterations[0].decision).toBe("escalate");
    expect(iterations[0].failureClass).toBe("escalate");
  });

  it("rejects loop iteration writes when run/task mismatch", () => {
    const db = setupTestDb();
    const run = startLoopRun(db, "task-1", {
      requiredGates: ["lint"],
      neverGiveUp: true,
      maxAttempts: 3
    });

    expect(() =>
      appendLoopIteration(db, {
        runId: run.id,
        taskId: "task-2",
        attempt: 1,
        gateResults: [{ gate: "lint", passed: true }]
      })
    ).toThrow("loop run task mismatch");
  });
});
