import { sleep } from "@metriport/shared";

export type RaceControl = { isRaceInProgress: boolean };

export async function checkIfRaceIsComplete(
  isRaceComplete: () => Promise<boolean>,
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

export async function controlDuration(durationMS: number, msg: string): Promise<string> {
  await sleep(durationMS);
  return msg;
}
