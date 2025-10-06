import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { sleep } from "@metriport/shared/common/sleep";

/**
 * Notify the user about the script being run and wait for 5 seconds before running.
 * @param region - The region the script is running in.
 * @param envType - The environment type the script is running in.
 * @param dryRun - Whether the script is running in dry run mode.
 * @param command - The command the script is running.
 * @returns The start time of the script.
 */
export async function notifyUserOnStart({
  region,
  envType,
  dryRun,
  command,
}: {
  region: string;
  envType: string;
  dryRun: boolean;
  command: string;
}): Promise<number> {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  const startedAt = Date.now();

  console.log(
    `############## Started at ${new Date(startedAt).toISOString()} ############## ${
      dryRun ? "DRY RUN" : "⚠️ WRITE MODE ⚠️"
    }`
  );
  const envTypeMessage = `Running in env type:${
    envType === "dev" ? "dev" : envType === "staging" ? "staging" : "⚠️ PRODUCTION ⚠️"
  }`;
  const isStaging = region === "us-east-2";
  const isProd = region === "us-east-1";
  const regionMessage = `Region is pointing to: ${
    isStaging ? "staging" : isProd ? "⚠️ PRODUCTION ⚠️" : region
  }`;
  console.log(regionMessage);
  console.log(envTypeMessage);
  console.log(`Waiting 5 seconds before running. ${command}`);
  await sleep(5000);
  console.log(`Running...`);
  return startedAt;
}

/**
 * Notify the user about the script being finished and the elapsed time.
 * @param startedAt - The start time of the script.
 * @param command - The command the script is running.
 */
export function notifyUserOnFinish({ startedAt, command }: { startedAt: number; command: string }) {
  const elapsedTime = elapsedTimeFromNow(new Date(startedAt));
  console.log(`========================================`);
  console.log(`Finished ${command}`);
  console.log(`Total elapsed time: ${elapsedTime} ms`);
  console.log(`========================================`);
}
