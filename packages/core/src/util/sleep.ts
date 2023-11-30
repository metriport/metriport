/**
 * @deprecated Use `sleep` from @metriport/shared instead.
 */
export function sleep(timeInMs: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, timeInMs));
}
