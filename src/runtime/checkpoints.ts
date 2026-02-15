export type CheckpointName =
  | "lease-claimed-before-running"
  | "loop-started-before-iteration"
  | "loop-failed-before-retry-schedule"
  | "commit-enqueued-before-lock"
  | "commit-lock-held";

type CheckpointContext = Record<string, unknown>;
type CheckpointHook = (name: CheckpointName, context: CheckpointContext) => void;

let hook: CheckpointHook | null = null;

export function setCheckpointHook(nextHook: CheckpointHook | null): void {
  hook = nextHook;
}

export function emitCheckpoint(name: CheckpointName, context: CheckpointContext): void {
  hook?.(name, context);
}
