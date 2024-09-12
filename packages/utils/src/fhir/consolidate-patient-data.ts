import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { PatientDataConsolidator } from "@metriport/core/command/consolidated/patient-data-consolidator";
import { getEnvVarOrFail, sleep } from "@metriport/shared";
import { elapsedTimeAsStr } from "../shared/duration";

const cxId = "";
const patientId = "";
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
