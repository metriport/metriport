import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { getLambdaResultPayload, makeLambdaClient } from "@metriport/core/external/aws/lambda";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { errorToString, getEnvVarOrFail, sleep } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import { chunk } from "lodash";
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
 *   run for all patients of the selected FhirToCsv job)
 * - run `ts-node src/analytics-platform/2-merge-csvs.ts` <fhirToCsvJobId>
 */

// Leave empty to run for all patients of the selected FhirToCsv job
const patientIds: string[] = [
  // "01981631-4ef0-7db5-b665-aeb60a2f3f39",
  // "0198193d-3631-787d-aa8e-463b9d15edfd",
];

// The job that converted the FHIR data to CSV
const fhirToCsvJobId = process.argv[2];

// TODO ENG-743 Create through infra
const lambdaName = "tmpCsvMerger";
const patientsPerChunk = 5_000; // important so we don't get an OOM error at the lambda
/** Size of each resulting CSV file, uncompressed. */
const targetGroupSizeMB = 3_000;

const numberOfParallelExecutions = 2; // don't increase this too much, as the lambdas already fanout 20x request to S3
const lambdaTimeout = dayjs.duration(15, "minutes");
const confirmationTime = dayjs.duration(10, "seconds");

const cxId = getEnvVarOrFail("CX_ID");
const region = getEnvVarOrFail("AWS_REGION");
const bucketName = getEnvVarOrFail("ANALYTICS_BUCKET_NAME");

const s3Utils = new S3Utils(region);

// This single run, that triggers many lambdas
const mergeCsvJobId = new Date().toISOString().slice(0, 19).replace(/[:.]/g, "-");

// TODO ENG-743 Type this from core when the code is moved there
const defaultPayload = {
  sourceBucket: bucketName,
  // TODO UPDATE THIS
  sourcePrefix: "snowflake/fhir-to-csv/" + cxId,
  // sourcePrefix: "snowflake/fhir-to-csv_pre-2025-08-11/" + cxId,
  destinationBucket: bucketName,
  destinationPrefix: "snowflake/merged/" + cxId,
  jsonToCsvJobId: fhirToCsvJobId,
  mergeCsvJobId,
  targetGroupSizeMB,
  region,
};

const lambdaClient = makeLambdaClient(region, lambdaTimeout.asMilliseconds());

async function main() {
  await sleep(100);
  const { log } = out("");

  const startedAt = Date.now();
  log(`>>> Starting at ${new Date().toISOString()}...`);
  const { orgName } = await getCxData(cxId, undefined, false);

  const isAllPatients = patientIds.length < 1;
  const patientsToMerge = isAllPatients
    ? await getPatientIdsFromFhirToCsvJob({ fhirToCsvJobId })
    : patientIds;
  const uniquePatientIds = [...new Set(patientsToMerge)];

  const patientIdChunks = chunk(uniquePatientIds, patientsPerChunk);

  await displayWarningAndConfirmation(uniquePatientIds, isAllPatients, orgName, log);
  log(
    `>>> Running it for ${uniquePatientIds.length} patients (${patientIdChunks.length} chunks of ` +
      `${patientsPerChunk} patients each)... mergeCsvJobId: ${mergeCsvJobId}, fhirToCsvJobId: ${fhirToCsvJobId}`
  );

  const failedPatientIds: string[][] = [];
  let amountOfPatientsProcessed = 0;

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
        amountOfPatientsProcessed += patientIds.length;
        if (amountOfPatientsProcessed % 100 === 0) {
          log(`>>> Processed ${amountOfPatientsProcessed}/${uniquePatientIds.length} patients`);
        }
        getLambdaResultPayload({ result: lambdaResult, lambdaName });
      } catch (error) {
        log(
          `Failed invoking lambda for ${patientIds.length} patients - reason: ${errorToString(
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
    const outputFile = "2-merge-csvs_failed-patient-ids_" + mergeCsvJobId + ".txt";
    log(`>>> FAILED to invoke lambda for ${flatPatientIds.length} patients - see ${outputFile}`);
    fs.writeFileSync(outputFile, flatPatientIds.join("\n"));
  }

  log(`>>> ALL Done in ${elapsedTimeAsStr(startedAt)}`);
  log(`- fhirToCsvJobId: ${fhirToCsvJobId}`);
  log(`- mergeCsvJobId: ${mergeCsvJobId}`);
}

async function getPatientIdsFromFhirToCsvJob({
  fhirToCsvJobId,
}: {
  fhirToCsvJobId: string;
}): Promise<string[]> {
  const basePrefix = `${defaultPayload.sourcePrefix}/${fhirToCsvJobId}/`;
  const files = await s3Utils.listFirstLevelSubdirectories({
    bucket: bucketName,
    prefix: basePrefix,
  });
  const patientIds = files.flatMap(file => {
    const item = file.Prefix?.endsWith("/") ? file.Prefix.slice(0, -1) : file.Prefix;
    return item?.split("/").pop() ?? [];
  });
  return patientIds;
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
