/**
 * Sleeps for timeInMs milliseconds.
 * @param milliseconds - The amount of time to sleep in milliseconds.
 * @returns A promise that resolves when the sleep is complete.
 */
export function sleep(timeInMs: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, timeInMs));
}

/**
 * Sleeps for a random amount of time between max * multiplierMin and max.
 * @param max - The maximum amount of time to sleep in milliseconds.
 * @param multiplierMin - The minimum multiplier to use. Defaults to 0.1.
 * @returns A promise that resolves when the sleep is complete.
 */
export function sleepRandom(max: number, multiplierMin = 0.1): Promise<void> {
  let multiplier = Math.random();
  if (multiplier < multiplierMin) multiplier += multiplierMin;
  if (multiplier > 1) multiplier = 1;
  const timeToWait = Math.floor(multiplier * max);
  return sleep(timeToWait);
}
