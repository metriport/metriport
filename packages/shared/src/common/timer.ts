import { elapsedTimeFromNow } from "./date";

export function initTimer() {
  const startedAt = new Date();
  return {
    getStartedAt: () => startedAt,
    getElapsedTime: () => elapsedTimeFromNow(startedAt),
  };
}
