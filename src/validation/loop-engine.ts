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
