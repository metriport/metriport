import { sleep } from "@metriport/shared";

export type RaceControl = { isRaceInProgress: boolean };

export async function checkIfRaceIsComplete(
  isRaceComplete: () => Promise<boolean> | boolean,
  raceControl: RaceControl,
  completeMsg: string,
  sleepIntervalMS: number
): Promise<string> {
  while (raceControl.isRaceInProgress) {
    const isComplete = await isRaceComplete();

    if (isComplete) {
      return completeMsg;
    }
    await sleep(sleepIntervalMS);
  }

  return "";
}

export async function controlDuration<T>(durationMS: number, response: T): Promise<T> {
  await sleep(durationMS);
  return response;
}
