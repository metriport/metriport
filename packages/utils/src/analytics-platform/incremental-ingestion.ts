import dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { ProcessFhirToCsvIncrementalRequest } from "@metriport/core/command/analytics-platform/fhir-to-csv/command/incremental/fhir-to-csv-incremental";
import { FhirToCsvIncrementalDirect } from "@metriport/core/command/analytics-platform/fhir-to-csv/command/incremental/fhir-to-csv-incremental-direct";
import { readConfigs } from "@metriport/core/command/analytics-platform/fhir-to-csv/configs/read-column-defs";
import { dbCredsSchema, getEnvVarOrFail, sleep } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { elapsedTimeAsStr } from "../shared/duration";

dayjs.extend(duration);

/**
 * Script to run incremental ingestion of a patient into the analytics platform.
 *
 * IMPORTANT: Used for development purposes only.
 *
 * If you need to trigger the re-ingestion of a patient in the cloud environment,
 * use the API endpoint `/internal/analytics-platform/ingestion/incremental`.
 *
 * It relies on the following env vars:
 * - CX_ID
 * - PATIENT_ID
 * - ANALYTICS_BUCKET_NAME
 * - AWS_REGION
 * - ANALYTICS_DB_CREDS
 *
 * Run it with:
 * - ts-node src/analytics-platform/incremental-ingestion.ts
 */

const cxId = getEnvVarOrFail("CX_ID");
const patientId = getEnvVarOrFail("PATIENT_ID");
const analyticsBucketName = getEnvVarOrFail("ANALYTICS_BUCKET_NAME");
const region = getEnvVarOrFail("AWS_REGION");
const dbCredsRaw = getEnvVarOrFail("ANALYTICS_DB_CREDS");
const fhirToCsvConfigurationsFolder = `../data-transformation/fhir-to-csv/src/parseFhir/configurations`;

async function main() {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  const startedAt = Date.now();
  console.log(`############## Started at ${buildDayjs().toISOString()} ##############`);

  const tablesDefinitions = readConfigs(fhirToCsvConfigurationsFolder);

  const dbCreds = dbCredsSchema.parse(JSON.parse(dbCredsRaw));
  const fhirToCsvHandler = new FhirToCsvIncrementalDirect(
    analyticsBucketName,
    region,
    dbCreds,
    tablesDefinitions
  );
  const params: ProcessFhirToCsvIncrementalRequest = {
    cxId,
    patientId,
  };
  await fhirToCsvHandler.processFhirToCsvIncremental(params);

  console.log(`>>>>>>> Done after ${elapsedTimeAsStr(startedAt)}`);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
