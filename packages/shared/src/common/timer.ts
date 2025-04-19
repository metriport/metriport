import { elapsedTimeFromNow } from "./date";

/**
 * Creates a timer object that tracks elapsed time from initialization.
 * @returns An object with methods to:
 * - Get the start time (`getStartedAt`)
 * - Get the elapsed time since initialization (`getElapsedTime`)
 *
 * @example
 * ```ts
 * const timer = initTimer();
 * // ... do some work ...
 * console.log(`Operation took ${timer.getElapsedTime()}ms`);
 * ```
 */
export function initTimer() {
  const startedAt = new Date();
  return {
    getStartedAt: () => startedAt,
    getElapsedTime: () => elapsedTimeFromNow(startedAt),
  };
}
