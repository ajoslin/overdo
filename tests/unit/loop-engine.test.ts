import { describe, expect, it } from "vitest";

import { classifyFailure, computeBackoffMs, evaluateLoop, type LoopContract } from "../../src/validation/loop-engine.js";

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
});
