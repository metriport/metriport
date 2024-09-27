import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { createConsolidatedFromConversions } from "@metriport/core/command/consolidated/consolidated-create";
import { getEnvVarOrFail, sleep } from "@metriport/shared";
import { elapsedTimeAsStr } from "../shared/duration";
import { MetriportMedicalApi } from "@metriport/api-sdk";
import { getDomainFromDTO } from "@metriport/core/command/patient-loader-metriport-api";

/**
 * Utility to run the function that recreates the patient consolidated bundle from the terminal.
 *
 * Usage:
 * - Set the environment variables in the .env file
 * - Set the values of `cxId`, `patientId`, `inputBundleBucket`
 * - Run `ts-node src/fhir/consolidate-patient-data.ts`
 */

const cxId = "";
const patientId = "";
/**
 * The bucket and key of the input bundle to be merged into the consolidated bundle.
 */
const inputBundleBucket = "";
const consolidatedBucket = getEnvVarOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");
const apiKey = getEnvVarOrFail("API_KEY");
const apiUrl = getEnvVarOrFail("API_URL");

const sdk = new MetriportMedicalApi(apiKey, {
  baseAddress: apiUrl,
});

async function main() {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  const startedAt = Date.now();
  console.log(`########################## Started at ${new Date(startedAt).toISOString()}`);

  const patient = await sdk.getPatient(patientId);

  await createConsolidatedFromConversions({
    cxId,
    patientId,
    patient: getDomainFromDTO(patient),
    sourceBucketName: inputBundleBucket,
    destinationBucketName: consolidatedBucket,
  });

  console.log(`>>> Done in ${elapsedTimeAsStr(startedAt)}`);
}

main();
