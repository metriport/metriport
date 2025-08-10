import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { getLambdaResultPayload, makeLambdaClient } from "@metriport/core/external/aws/lambda";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { errorToString, getEnvVarOrFail, sleep } from "@metriport/shared";
import axios from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { chunk } from "lodash";
import { getAllPatientIds } from "../patient/get-ids";
import { elapsedTimeAsStr } from "../shared/duration";
import { getCxData } from "../shared/get-cx-data";

dayjs.extend(duration);

/**
 * This script invoke the lambda that merges the patients' CSVs files into single files.
 *
 * It needs to be run after the lambdas that convert the FHIR data to CSV are done
 * (script `1-consolidated-to-csv.ts`).
 *
 * We need the output `fhirToCsvJobId` of that script as an argument.
 *
 * Usage:
 * - set env vars on .env file
 * - set patientIds array with the patient IDs you want to insert (or leave empty to
 *   run for all patients)
 * - run `ts-node src/analytics-platform/2-merge-csvs.ts` <fhirToCsvJobId>
 */

// Leave empty to run for all patients of the customer
const patientIds: string[] = [];

// The job that converted the FHIR data to CSV
const fhirToCsvJobId = process.argv[2];

// TODO ENG-743 Create through infra
const lambdaName = "tmpCsvMerger";
const patientsPerChunk = 600; // important so we don't get an OOM error at the lambda
const numberOfParallelExecutions = 2;
const confirmationTime = dayjs.duration(10, "seconds");

const cxId = getEnvVarOrFail("CX_ID");
const apiUrl = getEnvVarOrFail("API_URL");
const region = getEnvVarOrFail("AWS_REGION");
const bucketName = getEnvVarOrFail("ANALYTICS_BUCKET_NAME");

// This single run, that triggers many lambdas
const mergeCsvJobId = new Date().toISOString().slice(0, 19).replace(/[:.]/g, "-");

const defaultPayload = {
  sourceBucket: bucketName,
  sourcePrefix: "snowflake/fhir-to-csv/" + cxId,
  destinationBucket: bucketName,
  destinationPrefix: "snowflake/merged/" + cxId,
  jsonToCsvJobId: fhirToCsvJobId,
  mergeCsvJobId,
  region,
};

const api = axios.create({ baseURL: apiUrl });
const lambdaClient = makeLambdaClient(region);

async function main() {
  await sleep(100);
  const { log } = out("");

  const startedAt = Date.now();
  log(`>>> Starting...`);
  const { orgName } = await getCxData(cxId, undefined, false);

  const isAllPatients = patientIds.length < 1;
  const patientsToInsert = isAllPatients
    ? await getAllPatientIds({ axios: api, cxId })
    : patientIds;
  const uniquePatientIds = [...new Set(patientsToInsert)];

  const patientIdChunks = chunk(uniquePatientIds, patientsPerChunk);

  await displayWarningAndConfirmation(uniquePatientIds, isAllPatients, orgName, log);
  log(
    `>>> Running it for ${uniquePatientIds.length} patients... ` +
      `mergeCsvJobId: ${mergeCsvJobId}, fhirToCsvJobId: ${fhirToCsvJobId}`
  );

  const failedPatientIds: string[][] = [];

  await executeAsynchronously(
    patientIdChunks,
    async patientIds => {
      const payload = { ...defaultPayload, patientIds };
      try {
        const lambdaResult = await lambdaClient
          .invoke({
            FunctionName: lambdaName,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(payload),
          })
          .promise();

        if (lambdaResult.StatusCode !== 200) {
          throw new Error("Lambda invocation failed");
        }
        if (!lambdaResult.Payload) {
          throw new Error("Payload is undefined");
        }
        getLambdaResultPayload({ result: lambdaResult, lambdaName });
      } catch (error) {
        log(
          `Failed invoking lambda for patients ${patientIds.join(", ")} - reason: ${errorToString(
            error
          )}`
        );
        failedPatientIds.push(patientIds);
      }
    },
    { numberOfParallelExecutions, minJitterMillis: 100, maxJitterMillis: 300 }
  );

  log(``);
  if (failedPatientIds.length > 0) {
    const flatPatientIds = failedPatientIds.flat();
    log(`>>> Failed to invoke lambda for ${flatPatientIds.length} patients:`);
    log(flatPatientIds.join(", "));
    log(`>>> Failed to invoke lambda for ${flatPatientIds.length} patients ^`);
  }

  log(`>>> ALL Done in ${elapsedTimeAsStr(startedAt)}`);
  log(`- fhirToCsvJobId: ${fhirToCsvJobId}`);
  log(`- mergeCsvJobId: ${mergeCsvJobId}`);
}

async function displayWarningAndConfirmation(
  patientsToInsert: string[],
  isAllPatients: boolean,
  orgName: string,
  log: typeof console.log
) {
  const allPatientsMsg = isAllPatients ? ` That's all patients of customer ${cxId}!` : "";
  const msg =
    `You are about to merge CSV files for ${patientsToInsert.length} patients of ` +
    `customer ${orgName} (${cxId}). Are you sure?${allPatientsMsg}`;
  log(msg);
  log("Cancel this now if you're not sure.");
  await sleep(confirmationTime.asMilliseconds());
}

main();
