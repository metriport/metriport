import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import {
  buildFhirToCsvJobPrefix,
  parsePatientIdFromFhirToCsvPatientPrefix,
} from "@metriport/core/command/analytics-platform/fhir-to-csv/file-name";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { SQSClient } from "@metriport/core/external/aws/sqs";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { errorToString, getEnvVarOrFail, sleep } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import { Command } from "commander";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import { chunk } from "lodash";
import readline from "readline/promises";
import { GroupAndMergeCSVsParamsLambda } from "../../../lambdas/src/analytics-platform/merge-csvs";
import { elapsedTimeAsStr } from "../shared/duration";
import { getCxData } from "../shared/get-cx-data";

dayjs.extend(duration);

/**
 * This script invoke the lambda that merges the patients' CSVs files into single files.
 *
 * It needs to be run after the lambdas that convert the FHIR data to CSV are done
 * (script `1-fhir-to-csv.ts`).
 *
 * We need the output `fhirToCsvJobId` of that script as an argument.
 *
 * Usage:
 * - set env vars on .env file
 * - leave patientIds empty to run for all patients of the selected FhirToCsv job
 *   (optionally, set patientIds array with the patient IDs you want to process)
 * - run `ts-node src/analytics-platform 2-merge-csvs -f2c <fhirToCsvJobId>`
 */

// Leave empty to run for all patients of the selected FhirToCsv job
const patientIds: string[] = [];

// Too much can result in an OOM error at the lambda
// Too little can result in too small, too many compressed files
const maxPatientCountPerLambda = 1_200;

/** Size of each resulting CSV file, uncompressed. */
const maxUncompressedSizePerFileInMB = 800;

const mergeCsvJobId = "MRG_" + buildDayjs().toISOString().slice(0, 19).replace(/[:.]/g, "-");

const messageGroupId = "merge-csvs";
const numberOfParallelPutSqsOperations = 20;

const cxId = getEnvVarOrFail("CX_ID");
const queueUrl = getEnvVarOrFail("ANALYTICS_MERGE_CSVS_QUEUE_URL");
const bucketName = getEnvVarOrFail("ANALYTICS_BUCKET_NAME");
const region = getEnvVarOrFail("AWS_REGION");
const s3Utils = new S3Utils(region);

const program = new Command();
program
  .name("2-merge-csvs")
  .description("CLI to trigger the merging of patients' CSV files into single files")
  .requiredOption("-f2c, --fhir-to-csv-job-id <id>", "The FhirToCsv job ID to merge the CSVs for")
  .showHelpAfterError()
  .action(main);

const sqsClient = new SQSClient({ region });

async function main({ fhirToCsvJobId }: { fhirToCsvJobId: string }) {
  await sleep(100);
  const { log } = out("");

  const startedAt = Date.now();
  log(`>>> Starting at ${buildDayjs().toISOString()}...`);
  const { orgName } = await getCxData(cxId, undefined, false);

  const defaultPayload: Omit<GroupAndMergeCSVsParamsLambda, "patientIds"> = {
    cxId,
    fhirToCsvJobId,
    mergeCsvJobId,
    targetGroupSizeMB: maxUncompressedSizePerFileInMB,
  };

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
      `\n- maxPatientCountPerLambda: ${maxPatientCountPerLambda}\n- numberOfParallelLambdaInvocations: ${numberOfParallelPutSqsOperations}` +
      `\n- maxUncompressedSizePerFileInMB: ${maxUncompressedSizePerFileInMB}`
  );

  const failedPatientIds: string[][] = [];
  let amountOfPatientsProcessed = 0;
  let index = 0;

  await executeAsynchronously(
    patientIdChunks,
    async (ptIdsOfThisRun: string[]) => {
      const runTimestamp = buildDayjs().toISOString();

      try {
        const payload: GroupAndMergeCSVsParamsLambda = {
          ...defaultPayload,
          patientIds: ptIdsOfThisRun,
        };
        const payloadString = JSON.stringify(payload);
        await sqsClient.sendMessageToQueue(queueUrl, payloadString, {
          fifo: true,
          messageDeduplicationId: createUuidFromText(ptIdsOfThisRun.join(",")),
          messageGroupId,
        });

        amountOfPatientsProcessed += ptIdsOfThisRun.length;
        log(
          `>>> Put message ${++index}/${
            patientIdChunks.length
          } on queue (${amountOfPatientsProcessed}/${uniquePatientIds.length} patients)`
        );
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
      numberOfParallelExecutions: numberOfParallelPutSqsOperations,
      minJitterMillis: 20,
      maxJitterMillis: 100,
    }
  );

  log(``);
  if (failedPatientIds.length > 0) {
    const flatPatientIds = failedPatientIds.flat();
    const outputFile = `2-merge-csvs_failed-patient-ids_${mergeCsvJobId}_ALL.txt`;
    log(`>>> FAILED to invoke lambda for ${flatPatientIds.length} patients - see ${outputFile}`);
    fs.writeFileSync(outputFile, flatPatientIds.join("\n"));
  }

  log(`>>> ALL sent to queue in ${elapsedTimeAsStr(startedAt)}`);
  log(`- fhirToCsvJobId: ${fhirToCsvJobId}`);
  log(`- mergeCsvJobId: ${mergeCsvJobId}`);
}

async function getPatientIdsFromFhirToCsvJob({
  fhirToCsvJobId,
}: {
  fhirToCsvJobId: string;
}): Promise<string[]> {
  const basePrefix = buildFhirToCsvJobPrefix({ cxId, jobId: fhirToCsvJobId });
  const files = await s3Utils.listFirstLevelSubdirectories({
    bucket: bucketName,
    prefix: basePrefix + "/",
  });
  const patientIds = files.flatMap(file =>
    file.Prefix ? parsePatientIdFromFhirToCsvPatientPrefix(file.Prefix) : []
  );
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
  log("Are you sure you want to proceed?");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await rl.question("Type 'yes' to proceed: ");
  if (answer !== "yes") {
    log("Aborting...");
    process.exit(0);
  }
  rl.close();
}

export default program;
