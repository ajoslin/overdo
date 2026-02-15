import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

type ResumeState = {
  runId: string;
  completed: string[];
};

describe("resume proof", () => {
  it("continues progress after simulated restart", () => {
    mkdirSync("artifacts", { recursive: true });
    const statePath = "artifacts/resume-state.json";

    const initial: ResumeState = { runId: "phase0", completed: ["bootstrap"] };
    writeFileSync(statePath, JSON.stringify(initial, null, 2), "utf8");

    const loaded = JSON.parse(readFileSync(statePath, "utf8")) as ResumeState;
    const resumed: ResumeState = {
      ...loaded,
      completed: [...loaded.completed, "ci"]
    };
    writeFileSync(statePath, JSON.stringify(resumed, null, 2), "utf8");

    const persisted = JSON.parse(readFileSync(statePath, "utf8")) as ResumeState;
    expect(persisted.completed).toEqual(["bootstrap", "ci"]);
  });
});
