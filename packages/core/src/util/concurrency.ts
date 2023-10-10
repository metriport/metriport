import { chunk } from "lodash";
import { sleep } from "./sleep";

export const executeInChunksDefaultOptions = {
  maxJitterMillis: 0,
};

export type ExecuteInChunksOptions = {
  numberOfAsyncRuns?: number;
  maxJitterMillis?: number;
  jitterPct?: number;
};

export async function executeAsynchronously<T>(
  collection: T[],
  fn: (chunk: T[], chunkIndex: number, chunkCount: number) => Promise<void>,
  {
    numberOfAsyncRuns = collection.length,
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
