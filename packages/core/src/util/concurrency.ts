import { chunk } from "lodash";
import { sleep } from "./sleep";

export type ExecuteInChunksOptions = {
  /**
   * How many promises should execute at the same time.
   */
  numberOfParallelExecutions?: number;
  /**
   * Maximum jitter in milliseconds before each run. Makes promises
   * start at slight different times. Defaults to 0, no jitter.
   */
  maxJitterMillis?: number;
  /**
   * Minimum jitter in milliseconds before each run. Makes promises
   * start at slight different times. Defaults to 0.
   */
  minJitterMillis?: number;
  /**
   * Whether to keep executing when an error occurs. Defaults to false, which
   * means some might finish execution when the error happens - non-deterministic.
   */
  keepExecutingOnError?: boolean;
};

export type FunctionType<T> = (
  item: T,
  itemIndex: number,
  promiseIndex: number,
  promiseCount: number
) => Promise<void>;

/**
 * Process an array or items asynchronously.
 *
 * For example, with an array of 19 elements and 4 parallel executions,
 * we would have something like this being executed, where:
 * - each row is a promise, like a thread running in parallel to the other promises;
 * - each column is a function call with the respective item of the array, it runs in sequence
 *   to other calls on the same row;
 *
 * promise
 * idx| items being executed
 *   -|---------------------------------------> time
 *   1| item1 | item2 | item3 | item4 | item5 |
 *   -|---------------------------------------|
 *   2| item1 | item2 | item3 | item4 | item5 |
 *   -|---------------------------------------|
 *   3| item1 | item2 | item3 | item4 | item5 |
 *   -|---------------------------------------|
 *   4| item1 | item2 | item3 | item4 |
 *   -|---------------------------------------> time
 *
 * @param collection array of elements to be processed
 * @param fn the function to be executed asynchronously
 * @param options additional settings
 */
export async function executeAsynchronously<T>(
  collection: T[],
  fn: FunctionType<T>,
  {
    numberOfParallelExecutions = collection.length,
    maxJitterMillis = 0,
    minJitterMillis = 0,
    keepExecutingOnError = false,
  }: ExecuteInChunksOptions = {}
): Promise<PromiseSettledResult<void>[]> {
  if (minJitterMillis < 0) throw new Error("minJitterMillis must be >= 0");
  if (maxJitterMillis < 0) throw new Error("maxJitterMillis must be >= 0");
  if (minJitterMillis > maxJitterMillis) {
    throw new Error("minJitterMillis must be <= maxJitterMillis");
  }

  const numItemsPerRun = Math.min(collection.length, numberOfParallelExecutions);
  const asyncRuns = chunk(collection, Math.ceil(collection.length / numItemsPerRun));
  const amountOfPromises = asyncRuns.length;

  const promises = asyncRuns.map(async (itemsOfPromise, promiseIndex) => {
    // possible jitter before each run so that they don't start at the same time
    const jitter = Math.max(minJitterMillis, Math.random() * maxJitterMillis);
    await sleep(jitter);

    await executeSynchronously(itemsOfPromise, fn, promiseIndex, amountOfPromises);
  });
  if (keepExecutingOnError) {
    return await Promise.allSettled(promises);
  }
  return (await Promise.all(promises)).map(p => ({ status: "fulfilled", value: p }));
}

export async function executeSynchronously<T>(
  itemsOfPromise: T[],
  fn: FunctionType<T>,
  promiseIndex: number,
  amountOfPromises: number
): Promise<void> {
  let itemIndex = 0;
  for (const item of itemsOfPromise) {
    await fn(item, itemIndex++, promiseIndex, amountOfPromises);
  }
}
