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
import https from "https";
import { buildGetDirPathInside, initRunsFolder } from "../shared/folder";
import { getCxData } from "../shared/get-cx-data";

dayjs.extend(duration);

/**
 * Utility to generate Medical Records for a subset of a customer's patients.
 *
 * This will:
 *    - create a new folder in the "runs" dir for the customer, with "MR-Summaries" as prefix
 *    - get each patient's consolidated data as PDF
 *    - store each PDF in the "MR-Summaries"
 *
 * Update the respective env variables and run `npm run create-medical-records`
 */

/**
 * List of patients to generate Medical Records for.
 */
const patientIds: string[] = [];

const conversionType = "pdf";

const apiUrl = getEnvVarOrFail("API_URL");
const cxId = getEnvVarOrFail("CX_ID");

const endpointUrl = `${apiUrl}/internal/patient/consolidated`;

const getDirName = buildGetDirPathInside(`MR-Summaries`);

async function main() {
  initRunsFolder();
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
      log(`>>> Generating MR...`);
      const url = await getMedicalRecordURL(patientId);
      if (!url) {
        log(`No Medical Record URL, skipping...`);
        continue;
      }
      const timeToMakeMR = Date.now() - patientStartedAt;
      log(`... Got MR URL in ${timeToMakeMR} ms, downloading the MR file...`);
      await downloadFile(url, patientId, dirName);

      log("... Patient is done.");
    } catch (error) {
      log(`Error downloading MR: ${errorToString(error)}`);
    }
  }
  const duration = Date.now() - startedAt;
  const durationMin = formatNumber(dayjs.duration(duration).asMinutes());
  console.log(`>>> Done all patients in ${Date.now() - startedAt} ms / ${durationMin} min`);
}

async function getMedicalRecordURL(patientId: string): Promise<string | undefined> {
  const params = new URLSearchParams({
    patientId,
    cxId,
    conversionType,
  });
  const resp = await axios.get(`${endpointUrl}?${params}`);
  const bundle = resp.data.bundle as Bundle<DocumentReference>;
  return bundle.entry?.[0]?.resource?.content?.[0]?.attachment?.url;
}

async function downloadFile(url: string, patientId: string, dirName: string) {
  return new Promise(resolve => {
    https.get(url, res => {
      const fileStream = fs.createWriteStream(`./${dirName}/${patientId}.pdf`);
      res.pipe(fileStream);

      fileStream.on("finish", () => {
        fileStream.close();
        resolve("success");
      });
    });
  });
}

main();
