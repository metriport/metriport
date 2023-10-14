import { chunk } from "lodash";
import { sleep } from "./sleep";

export const executeInChunksDefaultOptions = {
  maxJitterMillis: 0,
};

export type ExecuteInChunksOptions = {
  /**
   * How many promises should execute at the same time.
   */
  numberOfParallelExecutions?: number;
  /**
   * Maximum jitter in milliseconds before each run. Makes promises
   * start at slight different times. Defaults to no jitter.
   */
  maxJitterMillis?: number;
  /**
   * Percentage of the maxJitterMillis to use (number between 0 and 1).
   * If not set, it will use a random percentage between 0 and 1.
   */
  jitterPct?: number;
};

export async function executeAsynchronously<T>(
  collection: T[],
  fn: (chunk: T[], chunkIndex: number, chunkCount: number) => Promise<void>,
  {
    numberOfParallelExecutions: numberOfAsyncRuns = collection.length,
    maxJitterMillis: maxJitterMillis = executeInChunksDefaultOptions.maxJitterMillis,
    jitterPct,
  }: ExecuteInChunksOptions = executeInChunksDefaultOptions
): Promise<void> {
  if (jitterPct) {
    if (jitterPct < 0) throw new Error(`maxJitterMillis must be >= 0`);
    if (jitterPct > 1) throw new Error(`maxJitterMillis must be <= 1`);
  }
  const numElementsPerRun = Math.min(collection.length, numberOfAsyncRuns);
  const asyncRuns = chunk(collection, Math.ceil(collection.length / numElementsPerRun));
  const n = asyncRuns.length;

  await Promise.all(
    asyncRuns.map(async (itemsOfRun, i) => {
      // possible jitter before each run so that they don't start at the same time
      const jitter = Math.floor((jitterPct ?? Math.random()) * maxJitterMillis);
      await sleep(jitter);

      await fn(itemsOfRun, i, n);
    })
  );
}
