import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Organization } from "@medplum/fhirtypes";
import { APIMode, CarequalityManagementApiFhir } from "@metriport/carequality-sdk";
import { getEnvVarOrFail, sleep } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import { elapsedTimeAsStr } from "../shared/duration";
import { buildGetDirPathInside, initRunsFolder } from "../shared/folder";

dayjs.extend(duration);

/**
 * Downloads the Carequality directory from the Carequality API and saves it to a file.
 *
 * Set the CQ_MANAGEMENT_API_KEY environment variable to your Carequality API key.
 * Set the apiMode to APIMode.production, APIMode.staging, or APIMode.dev.
 *
 * Run the script with `ts-node src/carequality/download-directory.ts`
 */

const apiKey = getEnvVarOrFail("CQ_MANAGEMENT_API_KEY");
const apiMode = APIMode.production;

const BATCH_SIZE = 5_000;
const SLEEP_TIME = dayjs.duration({ milliseconds: 750 });

const dirName = "cq-directory";
const getFolderName = buildGetDirPathInside(dirName);

/**
 * Downloads all active organizations from the Carequality directory
 */
export async function downloadCQDirectory(
  apiKey: string,
  apiMode: APIMode
): Promise<Organization[]> {
  const cq = new CarequalityManagementApiFhir({ apiKey, apiMode });
  const allOrgs: Organization[] = [];
  let currentPosition = 0;
  let isDone = false;

  while (!isDone) {
    const maxPosition = currentPosition + BATCH_SIZE;
    const orgs = await cq.listOrganizations({
      start: currentPosition,
      count: BATCH_SIZE,
      active: true,
      sortKey: "_id",
    });
    console.log(`Downloaded ${orgs.length} organizations (total: ${allOrgs.length})`);

    allOrgs.push(...orgs);

    if (orgs.length < BATCH_SIZE) {
      isDone = true;
    } else {
      await sleep(SLEEP_TIME.asMilliseconds());
      currentPosition = maxPosition;
    }
  }

  return allOrgs;
}

async function main() {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  const startedAt = Date.now();
  console.log(`############## Started at ${new Date(startedAt).toISOString()} ##############`);
  initRunsFolder(dirName);

  const orgs = await downloadCQDirectory(apiKey, apiMode);

  const outputFilename = getFolderName() + ".json";
  fs.writeFileSync(outputFilename, JSON.stringify(orgs, null, 2));

  console.log(`Downloaded ${orgs.length} organizations`);

  console.log(`>>>>>>> Done after ${elapsedTimeAsStr(startedAt)}`);
}

if (require.main === module) {
  main();
}
