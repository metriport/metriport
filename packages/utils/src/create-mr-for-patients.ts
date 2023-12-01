import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Bundle, DocumentReference } from "@medplum/fhirtypes";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import axios from "axios";
import fs from "fs";
import https from "https";
import { getCxData } from "./shared/get-cx-data";

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
const patientIds: string[] = [""];

const conversionType = "pdf";

const apiUrl = getEnvVarOrFail("API_URL");
const cxId = getEnvVarOrFail("CX_ID");

const getDirName = (orgName: string) => `./runs/${orgName?.replaceAll(" ", "-")}_MR-Summaries`;

async function main() {
  const startedAt = Date.now();

  const { orgName } = await getCxData(cxId, undefined, false);
  const dirName = getDirName(orgName);
  fs.mkdirSync(`./${dirName}`, { recursive: true });

  console.log(`>>> Starting with ${patientIds.length} patient IDs...`);
  for (const patientId of patientIds) {
    try {
      console.log(`>>> Getting MR for patient ${patientId}...`);
      const url = await getMedicalRecordURL(patientId);
      if (!url) {
        console.log(`No Medical Record URL for patient ${patientId}, skipping...`);
        continue;
      }

      console.log(`>>> Downloading the MR file of ${patientId}...`);
      await downloadFile(url, patientId, dirName);

      console.log(">>> Completed patient ", patientId);
    } catch (error) {
      console.log(`Error downloading MR for patient ${patientId}: ${error}`);
    }
  }
  console.log(`>>> Done querying docs for all patients in ${Date.now() - startedAt} ms`);
}

async function getMedicalRecordURL(patientId: string): Promise<string | undefined> {
  const params = new URLSearchParams({
    patientId,
    cxId,
    conversionType,
  });
  const resp = await axios.get(`${apiUrl}/internal/patient/consolidated?${params}`);
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
