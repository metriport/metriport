import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { ProcessPatientResult } from "@metriport/core/command/patient-import/steps/result/patient-import-result";
import { processPatientResult } from "@metriport/core/command/patient-import/steps/result/patient-import-result-command";
import { getLambdaResultPayload, makeLambdaClient } from "@metriport/core/external/aws/lambda";
import { getEnvVarOrFail, sleep } from "@metriport/shared";
import { PatientImportJobStatus } from "@metriport/shared/domain/patient/patient-import/status";
import { PatientImportJob } from "@metriport/shared/domain/patient/patient-import/types";
import axios from "axios";
import { Command } from "commander";
import { elapsedTimeAsStr } from "../shared/duration";

/**
 * Script to finalize the processing of a patient import job.
 *
 * It will call the PatientImportResultLambda to consolidate the patients' records into files in
 * the S3 bucket/prefix, including:
 * - result.csv: all entries w/ the status and reason
 * - invalid.csv: only the entries marked as invalid
 * ...and update the job status at the API to 'completed'.
 *
 * This can take a while, depending on the number of patients in the job (e.g., 5min for 7,500 pts).
 *
 * Relies on the following env vars:
 * - API_URL
 * - AWS_REGION
 * - PATIENT_IMPORT_BUCKET_NAME
 * - PATIENT_IMPORT_RESULT_LAMBDA_NAME
 *
 * Run it with:
 * - ts-node src/patient-import/finalize-processing-job.ts --cx-id <cxId> --job-id <jobId>
 * - ts-node src/patient-import/finalize-processing-job.ts --cx-id <cxId> --job-id <jobId> --local
 *
 * Example:
 * - ts-node src/patient-import/finalize-processing-job.ts --cx-id abc123 --job-id job-456
 */

const apiUrl = getEnvVarOrFail("API_URL");
const region = getEnvVarOrFail("AWS_REGION");

const patientImportBucket = getEnvVarOrFail("PATIENT_IMPORT_BUCKET_NAME");
const lambdaName = "PatientImportResultLambda";

export const ossApi = axios.create({
  baseURL: apiUrl,
  headers: { "Content-Type": "application/json" },
});

const program = new Command();
program
  .name("finalize-processing-job")
  .description("CLI to finalize the processing of a patient import job")
  .requiredOption("-cx, --cx-id <id>", "The customer ID")
  .requiredOption("-job, --job-id <id>", "The patient import job ID")
  .option("-l, --local", "Execute the logic locally instead of calling the lambda", false)
  .showHelpAfterError()
  .action(main)
  .parse();

async function main({
  cxId,
  jobId,
  local: isLocal,
}: {
  cxId: string;
  jobId: string;
  local: boolean;
}) {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's

  const startedAt = Date.now();
  console.log(`############## Started at ${new Date(startedAt).toISOString()} ##############`);

  const patientImport = await getPatientImportJobOrFail({ cxId, jobId });

  console.log(`>>> Patient import job: ${JSON.stringify(patientImport, null, 2)}`);

  await displayWarningAndConfirmation({
    cxId,
    patientImportJobId: jobId,
    patientImportJobStatus: patientImport.status,
    isLocal,
    log: console.log,
  });

  if (isLocal) {
    console.log(`>>> Using local processing`);
    await processPatientResult({
      cxId,
      jobId: jobId,
      patientImportBucket: patientImportBucket,
    });
  } else {
    console.log(`>>> Invoking lambda ${lambdaName}`);
    const lambdaClient = makeLambdaClient(region);
    const payload: ProcessPatientResult = {
      cxId,
      jobId: jobId,
    };
    const lambdaResult = await lambdaClient
      .invoke({
        FunctionName: lambdaName,
        InvocationType: "RequestResponse",
        Payload: JSON.stringify(payload),
      })
      .promise();

    getLambdaResultPayload({
      result: lambdaResult,
      lambdaName: lambdaName,
    });
  }

  console.log(`>>> Done in ${elapsedTimeAsStr(startedAt)}`);
  process.exit(0);
}

async function getPatientImportJobOrFail({
  cxId,
  jobId,
}: {
  cxId: string;
  jobId: string;
}): Promise<PatientImportJob> {
  const params = new URLSearchParams({ cxId });
  const response = await ossApi.get(`/internal/patient/bulk/${jobId}?${params.toString()}`);
  return response.data;
}

async function displayWarningAndConfirmation({
  cxId,
  patientImportJobId,
  patientImportJobStatus,
  isLocal,
  log = console.log,
}: {
  cxId: string;
  patientImportJobId: string;
  patientImportJobStatus: PatientImportJobStatus;
  isLocal: boolean;
  log?: typeof console.log;
}) {
  const progressInstructions = isLocal
    ? "\nLOCAL: The command will run locally and not call the lambda.\n"
    : "\nCheck the lambda's execution log to see the progress.";
  const msg =
    `You are about to terminate the patient import job ${patientImportJobId} with status ${patientImportJobStatus} for the cx ${cxId}.` +
    `\nThis can take a while, depending on the number of patients in the job. ${progressInstructions}`;
  const additionalMsg =
    patientImportJobStatus === "processing"
      ? "\nIMPORTANT: This is a destructive action and will terminate the ongoing patient import job!\n"
      : "";
  log(msg + additionalMsg);
  log("Are you sure you want to proceed? (type YES to continue)");
  const response = await new Promise(resolve => {
    process.stdin.once("data", data => {
      resolve(data.toString().trim());
    });
  });
  if (response !== "YES") {
    log("Operation cancelled");
    process.exit(0);
  }
}

export default program;
