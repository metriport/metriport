import * as dotenv from "dotenv";
dotenv.config();

import { createDefaultCohorts } from "../../../api/src/command/medical/cohort/create-default-cohorts";
import initDB from "../../../api/src/models/db";
import { sleep } from "@metriport/shared/common/sleep";
import dayjs, { duration } from "dayjs";
import { Config } from "../../../api/src/shared/config";
dayjs.extend(duration);

/**
 * This script creates the default cohorts for a list of cxIds.
 *
 * Update the `listOfCxIds` array with the list of cxIds you want to create the default cohorts for.
 *
 * Execute this with:
 * $ ts-node src/cohorts/backfill-default-cohorts.ts
 */

const listOfCxIds: string[] = [];
const dryRun = false;

const waitBetweenCxs = dayjs.duration(50, "milliseconds");
async function main() {
  await sleep(50); // Avoid mixing logs with Node's
  const failedCxIds: string[] = [];

  console.log("================================================");
  console.log(`Running in ${dryRun ? "dryRun" : "warning: WRITE"} mode`);
  console.log(
    `Environment: ${Config.isDev() ? "dev" : `${Config.isStaging() ? "staging" : "warning: PROD"}`}`
  );
  const region = Config.getAWSRegion();
  console.log(
    `AWS Region: ${
      region === "us-east-1" ? "Staging" : region === "us-west-2" ? "warning: PROD" : "Other"
    }`
  );
  console.log(`List of cxs: ${listOfCxIds.join(", ")}`);
  console.log(`Waiting 8 seconds before running... (Press Ctrl+C to cancel)`);
  console.log("================================================");
  await sleep(8000);
  console.log(`Creating default cohorts for ${listOfCxIds.length} cxs...`);

  await initDB();
  console.log(`Initialized DB`);
  for (const cxId of listOfCxIds) {
    try {
      await createDefaultCohorts({ cxId });
      console.log(`Completed creating default cohorts for ${cxId}`);
    } catch (error) {
      console.error(`Error creating default cohorts for ${cxId}: ${error}`);
      failedCxIds.push(cxId);
    } finally {
      await sleep(waitBetweenCxs.asMilliseconds());
    }
  }
  const message =
    failedCxIds.length > 0
      ? `Failed to create default cohorts for ${failedCxIds.join(", ")}`
      : "All default cohorts created successfully";
  console.log(message);
}

main();
