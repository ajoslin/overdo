export type ImportedTask = {
  id: string;
  title: string;
  blockedBy: string[];
  requiredGates: Array<"lint" | "unit" | "integration" | "e2e">;
  milestone: string;
};

export type ImportedPlan = {
  tasks: ImportedTask[];
};

const DEFAULT_GATES: ImportedTask["requiredGates"] = ["lint", "unit"];
const ALL_GATES: ImportedTask["requiredGates"] = ["lint", "unit", "integration", "e2e"];

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

    const raw = numbered[1].trim();
    const explicitBlockers = parseBlockers(raw);
    const gates = parseGates(raw);
    const title = stripAnnotations(raw);
    const taskId = `${currentMilestone}-${tasks.length + 1}`;
    const blockedBy = explicitBlockers.length > 0 ? explicitBlockers : lastTaskId ? [lastTaskId] : [];
    tasks.push({
      id: taskId,
      title,
      blockedBy,
      requiredGates: gates,
      milestone: currentMilestone
    });
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

function parseBlockers(value: string): string[] {
  const match = value.match(/\[blocked-by:\s*([^\]]+)\]/i);
  if (!match) {
    return [];
  }
  return match[1]
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parseGates(value: string): ImportedTask["requiredGates"] {
  const match = value.match(/\[gates:\s*([^\]]+)\]/i);
  if (!match) {
    return [...DEFAULT_GATES];
  }

  const parsed = match[1]
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item): item is ImportedTask["requiredGates"][number] => ALL_GATES.includes(item as never));
  return parsed.length > 0 ? parsed : [...DEFAULT_GATES];
}

function stripAnnotations(value: string): string {
  return value
    .replace(/\[blocked-by:[^\]]+\]/gi, "")
    .replace(/\[gates:[^\]]+\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}
