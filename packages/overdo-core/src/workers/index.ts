export type WorkerDispatch = {
  taskId: string;
  workerId: string;
};

export function claimTask(taskId: string, workerId: string): WorkerDispatch {
  if (!taskId || !workerId) {
    throw new Error("taskId and workerId are required");
  }
  return { taskId, workerId };
}
