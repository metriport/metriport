import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { PatientDataConsolidator } from "@metriport/core/command/consolidated/create-consolidated";
import { getEnvVarOrFail, sleep } from "@metriport/shared";
import { elapsedTimeAsStr } from "../shared/duration";

/**
 * Utility to run the Patient Data Consolidator manually from the terminal.
 *
 * Usage:
 * - Set the environment variables in the .env file
 * - Set the values of `cxId`, `patientId`, `newBundleBucket`, `newBundleS3Key`
 * - Run `ts-node src/fhir/consolidate-patient-data.ts`
 */

const cxId = "";
const patientId = "";
/**
 * The bucket and key of the input bundle to be merged into the consolidated bundle.
 */
const newBundleBucket = "";
const newBundleS3Key = "";

const consolidatedBucket = getEnvVarOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");
const region = getEnvVarOrFail("AWS_REGION");

async function main() {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  const startedAt = Date.now();
  console.log(`########################## Started at ${new Date(startedAt).toISOString()}`);

  const consolidator = new PatientDataConsolidator(consolidatedBucket, region);
  await consolidator.execute({
    cxId,
    patientId,
    newBundleBucket,
    newBundleS3Key,
  });

  console.log(`>>> Done in ${elapsedTimeAsStr(startedAt)}`);
}

main();
