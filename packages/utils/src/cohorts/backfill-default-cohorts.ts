import * as dotenv from "dotenv";
dotenv.config();

import { createDefaultCohorts } from "../../../api/src/command/medical/cohort/create-default-cohorts";
import initDB from "../../../api/src/models/db";
import { sleep } from "@metriport/shared/common/sleep";
import dayjs, { duration } from "dayjs";
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
const waitBetweenCxs = dayjs.duration(50, "milliseconds");

async function main() {
  await sleep(50); // Avoid mixing logs with Node's
  const failedCxIds: string[] = [];

  console.log(`Creating default cohorts for ${listOfCxIds.length} cxs...`);
  await sleep(3000); // Give time for user to cancel if needed
  await initDB();
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
