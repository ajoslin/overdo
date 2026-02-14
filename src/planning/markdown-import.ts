export type ImportedTask = {
  id: string;
  title: string;
  blockedBy: string[];
  requiredGates: Array<"lint" | "unit" | "integration" | "e2e">;
};

export type ImportedPlan = {
  tasks: ImportedTask[];
};

const DEFAULT_GATES: ImportedTask["requiredGates"] = ["lint", "unit"];

export function importMarkdownPlan(markdown: string): ImportedPlan {
  const lines = markdown.split("\n").map((line) => line.trim());
  const tasks: ImportedTask[] = [];
  let currentMilestone: string | null = null;
  let lastTaskId: string | null = null;

  for (const line of lines) {
    if (line.startsWith("## Milestone")) {
      currentMilestone = slugify(line.replace(/^##\s+/, ""));
      lastTaskId = null;
      continue;
    }

    const numbered = line.match(/^\d+\.\s+(.+)/);
    if (!numbered || !currentMilestone) {
      continue;
    }

    const title = numbered[1].trim();
    const taskId = `${currentMilestone}-${tasks.length + 1}`;
    const blockedBy = lastTaskId ? [lastTaskId] : [];
    tasks.push({ id: taskId, title, blockedBy, requiredGates: [...DEFAULT_GATES] });
    lastTaskId = taskId;
  }

  if (tasks.length === 0) {
    throw new Error("no milestone tasks found in markdown plan");
  }

  return { tasks };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
