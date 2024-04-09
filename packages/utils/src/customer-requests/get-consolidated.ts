import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Bundle, DocumentReference } from "@medplum/fhirtypes";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { errorToString } from "@metriport/shared/common/error";
import { formatNumber } from "@metriport/shared/common/numbers";
import axios from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import { getCxData } from "../shared/get-cx-data";
import { getFolderNameForOrg } from "./folder";

dayjs.extend(duration);

/**
 * Utility to get and store consolidated data for a subset of a customer's patients.
 *
 * This will:
 *    - create a new folder in the "runs" dir for the customer, with "consolidated" as prefix
 *    - get each patient's consolidated data as JSON
 *    - store those on the local filesystem
 *
 * Update the respective env variables and run `npm run get-consolidated`
 */

/**
 * List of patients to get consolidated data for.
 */
const patientIds: string[] = [];

const apiUrl = getEnvVarOrFail("API_URL");
const cxId = getEnvVarOrFail("CX_ID");

const endpointUrl = `${apiUrl}/internal/patient/consolidated`;

const getDirName = (orgName: string) => `./runs/consolidated/${getFolderNameForOrg(orgName)}`;

async function main() {
  console.log(
    `########################## Running for cx ${cxId}, ${
      patientIds.length
    } patients... - started at ${new Date().toISOString()}`
  );
  const startedAt = Date.now();

  const { orgName } = await getCxData(cxId, undefined, false);
  const dirName = getDirName(orgName);
  fs.mkdirSync(`./${dirName}`, { recursive: true });
  console.log(`Storing files on dir ${dirName}`);

  for (const patientId of patientIds) {
    const log = (msg: string) => console.log(`${new Date().toISOString()} [${patientId}] ${msg}`);
    const patientStartedAt = Date.now();
    try {
      log(`>>> Getting data...`);
      const data = await getData(patientId);
      if (!data) {
        log(`No data returned, skipping...`);
        continue;
      }
      const timeToGetData = Date.now() - patientStartedAt;
      log(`... Got data in ${timeToGetData} ms, storing it local...`);
      storeData(data, patientId, dirName);

      log("... Patient is done.");
    } catch (error) {
      log(`Error downloading data: ${errorToString(error)}`);
    }
  }
  const duration = Date.now() - startedAt;
  const durationMin = formatNumber(dayjs.duration(duration).asMinutes());
  console.log(`>>> Done all patients in ${Date.now() - startedAt} ms / ${durationMin} min`);
}

async function getData(patientId: string): Promise<Bundle<DocumentReference> | undefined> {
  const params = new URLSearchParams({
    patientId,
    cxId,
  });
  const resp = await axios.get(`${endpointUrl}?${params}`);
  if (!resp.data) return undefined;
  const bundle = resp.data.bundle as Bundle<DocumentReference>;
  return bundle;
}

function storeData(data: Bundle<DocumentReference>, patientId: string, dirName: string): void {
  const extension = "json";
  const filename = `./${dirName}/${patientId}.${extension}`;
  fs.writeFileSync(filename, JSON.stringify(data, null, 2));
}

main();
