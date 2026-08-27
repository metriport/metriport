import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { sleep } from "@metriport/shared/common/sleep";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";

dayjs.extend(duration);

type AdditionalInfo = Record<string, string | number | boolean | undefined | null>;

const SPLITTER_CHAR = "=";
const REPEAT_SPLITTER_AMOUNT = 60;

export async function startScript({
  nameOfScript,
  dryRun,
  waitForSecondsBeforeRunning = 5,
  optionalParams = {},
}: {
  nameOfScript: string;
  dryRun: boolean;
  waitForSecondsBeforeRunning?: number;
  optionalParams?: AdditionalInfo;
}): Promise<Date> {
  await sleep(50); // Give some time to avoid mixing console.logs w/ Node's
  const dryRunText = dryRun ? `${dryRun}` : `⚠️ ${dryRun} ⚠️`;
  console.log(`\n\n${SPLITTER_CHAR.repeat(REPEAT_SPLITTER_AMOUNT)}`);
  console.log(`About to run ${nameOfScript} with DryRun: ${dryRunText}`);

  if (optionalParams && Object.keys(optionalParams).length > 0) {
    console.log(`Additional info: ${JSON.stringify(optionalParams, null, 2)}`);
  }

  console.log(
    `Waiting ${waitForSecondsBeforeRunning} seconds before running press CTRL + C to cancel.`
  );
  await sleep(dayjs.duration(waitForSecondsBeforeRunning, "seconds").asMilliseconds());
  console.log(`${SPLITTER_CHAR.repeat(REPEAT_SPLITTER_AMOUNT)}\n`);
  const startedAt = new Date();
  console.log(`Starting script at ${new Date(startedAt).toISOString()}`);
  return startedAt;
}

export async function endScript({
  nameOfScript,
  startedAt,
  optionalParams,
}: {
  nameOfScript: string;
  startedAt: Date;
  optionalParams?: AdditionalInfo;
}) {
  const elapsedTime = elapsedTimeFromNow(startedAt);
  console.log(`\n${SPLITTER_CHAR.repeat(REPEAT_SPLITTER_AMOUNT)}`);

  console.log(`${nameOfScript} finished at total elapsed time: ${elapsedTime} ms`);
  if (optionalParams && Object.keys(optionalParams).length > 0) {
    console.log(`Additional info: ${JSON.stringify(optionalParams, null, 2)}`);
  }

  console.log(`${SPLITTER_CHAR.repeat(REPEAT_SPLITTER_AMOUNT)}\n\n`);
}
