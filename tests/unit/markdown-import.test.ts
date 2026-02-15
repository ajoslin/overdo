import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { importMarkdownPlan } from "../../src/planning/markdown-import.js";

describe("markdown plan import", () => {
  it("imports milestones into sequentially linked tasks", () => {
    const markdown = readFileSync("BUILD_FROM_ZERO_PLAN.md", "utf8");
    const plan = importMarkdownPlan(markdown);

    expect(plan.tasks.length).toBeGreaterThan(5);
    expect(plan.tasks[0].blockedBy).toEqual([]);
    expect(plan.tasks[1].blockedBy.length).toBe(1);
    expect(plan.tasks.every((task) => task.requiredGates.includes("lint"))).toBe(true);
  });

  it("fails fast when milestone task lines are missing", () => {
    expect(() => importMarkdownPlan("# Empty\n\nNo milestones here")).toThrow(
      "no milestone tasks found in markdown plan"
    );
  });

  it("parses explicit blockers and gate annotations", () => {
    const plan = importMarkdownPlan(`## Milestone Alpha\n1. Bootstrap [gates: lint,unit,integration]\n2. Ship [blocked-by: bootstrap-task] [gates:e2e]`);

    expect(plan.tasks[0].requiredGates).toEqual(["lint", "unit", "integration"]);
    expect(plan.tasks[1].blockedBy).toEqual(["bootstrap-task"]);
    expect(plan.tasks[1].requiredGates).toEqual(["e2e"]);
    expect(plan.tasks[0].milestone).toBe("milestone-alpha");
  });
});
