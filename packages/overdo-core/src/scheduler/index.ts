export type TaskNode = {
  id: string;
  blockedBy: string[];
  completed: boolean;
};

export function nextReady(nodes: TaskNode[]): TaskNode | null {
  const completed = new Set(nodes.filter((node) => node.completed).map((node) => node.id));
  return (
    nodes.find(
      (node) => !node.completed && node.blockedBy.every((blocker) => completed.has(blocker))
    ) ?? null
  );
}
