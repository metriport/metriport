export function sleep(timeInMs: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, timeInMs));
}
