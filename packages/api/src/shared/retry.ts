import { Util } from "./util";

/**
 * @deprecated Use `executeWithRetries` from @metriport/shared instead.
 */
export const retryFunction = async <K>(
  fn: () => Promise<K>,
  maxRetries = 3,
  waitTime = 3000,
  testFn?: (result: K) => boolean
) => {
  let count = 0;
  let retry = true;
  let result;

  while (retry) {
    count++;
    result = await fn();
    if (testFn && testFn(result)) break;
    if (!testFn && result) break;
    retry = count < maxRetries;
    await Util.sleep(waitTime);
  }

  return result;
};
