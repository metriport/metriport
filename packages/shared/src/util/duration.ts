/**
 * Wraps a function and logs the time it took to execute it.
 *
 * @param fn - The function to execute.
 * @param name - The name of the function to log.
 * @param log - The logger to use.
 * @returns The result of the function.
 */
export async function timed<T>(fn: () => Promise<T>, name: string, log: typeof console.log) {
  const startedAt = Date.now();
  const res = await fn();
  const elapsedTime = Date.now() - startedAt;
  log(`Done ${name} in ${elapsedTime} ms`);
  return res;
}
