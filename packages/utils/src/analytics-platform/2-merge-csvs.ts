import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { InvokeCommand } from "@aws-sdk/client-lambda";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { errorToString, getEnvVarOrFail, sleep } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import { chunk } from "lodash";
import { elapsedTimeAsStr } from "../shared/duration";
import { getCxData } from "../shared/get-cx-data";
import { getLambdaResultPayloadV3, makeLambdaClientV3 } from "@metriport/core/external/aws/lambda";

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
 * - run `ts-node src/analytics-platform/2-merge-csvs.ts <fhirToCsvJobId>`
 */

// Leave empty to run for all patients of the selected FhirToCsv job
const patientIds: string[] = [];

const fhirToCsvJobId = process.argv[2];

// TODO ENG-743 Create through infra
const lambdaName = "tmpCsvMerger";

// Too much can result in an OOM error at the lambda
// Too little can result in too small, too many compressed files
const maxPatientCountPerLambda = 1_200;

/** Size of each resulting CSV file, uncompressed. */
const maxUncompressedSizePerFileInMB = 800;

const numberOfParallelLambdaInvocations = 20; // don't increase this too much, as the lambdas already fanout 20x request to S3

const mergeCsvJobId = "MRG_" + buildDayjs().toISOString().slice(0, 19).replace(/[:.]/g, "-");

const lambdaTimeout = dayjs.duration(15, "minutes");
const confirmationTime = dayjs.duration(1, "seconds");

const cxId = getEnvVarOrFail("CX_ID");
const region = getEnvVarOrFail("AWS_REGION");
const bucketName = getEnvVarOrFail("ANALYTICS_BUCKET_NAME");
const s3Utils = new S3Utils(region);

// TODO ENG-743 Type this from core when the code is moved there
const defaultPayload = {
  sourceBucket: bucketName,
  sourcePrefix: "snowflake/fhir-to-csv/" + cxId,
  destinationBucket: bucketName,
  destinationPrefix: "snowflake/merged/" + cxId,
  jsonToCsvJobId: fhirToCsvJobId,
  mergeCsvJobId,
  targetGroupSizeMB: maxUncompressedSizePerFileInMB,
  region,
};

const lambdaClient = makeLambdaClientV3(region, lambdaTimeout.asMilliseconds());

const globalIds: string[] = [];

async function main() {
  await sleep(100);
  const { log } = out("");

  const startedAt = Date.now();
  log(`>>> Starting at ${buildDayjs().toISOString()}...`);
  const { orgName } = await getCxData(cxId, undefined, false);

  const isAllPatients = patientIds.length < 1;
  if (isAllPatients) {
    log(
      `>>> Getting patient IDs from FhirToCsv job ${fhirToCsvJobId} from S3 (this can take a while)...`
    );
  }
  const patientsToMerge = isAllPatients
    ? await getPatientIdsFromFhirToCsvJob({ fhirToCsvJobId })
    : patientIds;
  const uniquePatientIds = [...new Set(patientsToMerge)];
  const patientIdChunks = chunk(uniquePatientIds, maxPatientCountPerLambda);

  await displayWarningAndConfirmation(uniquePatientIds, isAllPatients, orgName, log);
  log(
    `>>> Running it for ${uniquePatientIds.length} patients (${patientIdChunks.length} chunks of ` +
      `${maxPatientCountPerLambda} patients each)...\n- mergeCsvJobId: ${mergeCsvJobId}\n- fhirToCsvJobId: ${fhirToCsvJobId}` +
      `\n- maxPatientCountPerLambda: ${maxPatientCountPerLambda}\n- numberOfParallelLambdaInvocations: ${numberOfParallelLambdaInvocations}` +
      `\n- maxUncompressedSizePerFileInMB: ${maxUncompressedSizePerFileInMB}`
  );

  const failedPatientIds: string[][] = [];
  let amountOfPatientsProcessed = 0;

  await executeAsynchronously(
    patientIdChunks,
    async ptIdsOfThisRun => {
      const runTimestamp = buildDayjs().toISOString();
      const payload = { ...defaultPayload, patientIds: ptIdsOfThisRun };

      // TODO Revert this, for debugging purposes only
      if (globalIds.some(id => ptIdsOfThisRun.includes(id))) {
        log(`>>>>>>>>>>>>>>> These IDs have been processed before: ${ptIdsOfThisRun.join(", ")}`);
        return;
      }
      globalIds.push(...ptIdsOfThisRun);

      try {
        const invokeCommand = new InvokeCommand({
          FunctionName: lambdaName,
          Payload: JSON.stringify(payload),
          InvocationType: "RequestResponse",
        });
        const lambdaResult = await lambdaClient.send(invokeCommand);

        if (lambdaResult.StatusCode !== 200) {
          throw new Error("Lambda invocation failed");
        }
        if (!lambdaResult.Payload) {
          throw new Error("Payload is undefined");
        }
        getLambdaResultPayloadV3({ result: lambdaResult, lambdaName });
        amountOfPatientsProcessed += ptIdsOfThisRun.length;
        log(`>>> Processed ${amountOfPatientsProcessed}/${uniquePatientIds.length} patients`);
      } catch (error) {
        log(
          `${runTimestamp} - Failed invoking lambda for ${ptIdsOfThisRun.length} patients - ` +
            `reason: ${errorToString(error)}`
        );
        const outputFile = `2-merge-csvs_failed-patient-ids_${mergeCsvJobId}_${runTimestamp}.txt`;
        fs.writeFileSync(outputFile, ptIdsOfThisRun.join("\n"));
        failedPatientIds.push(ptIdsOfThisRun);
      }
    },
    {
      numberOfParallelExecutions: numberOfParallelLambdaInvocations,
      minJitterMillis: 100,
      maxJitterMillis: 300,
    }
  );

  log(``);
  if (failedPatientIds.length > 0) {
    const flatPatientIds = failedPatientIds.flat();
    const outputFile = `2-merge-csvs_failed-patient-ids_${mergeCsvJobId}_ALL.txt`;
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
