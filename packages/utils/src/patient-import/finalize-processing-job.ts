import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { ProcessPatientResult } from "@metriport/core/command/patient-import/steps/result/patient-import-result";
import { getLambdaResultPayload, makeLambdaClient } from "@metriport/core/external/aws/lambda";
import { getEnvVarOrFail, sleep } from "@metriport/shared";
import { PatientImportJobStatus } from "@metriport/shared/domain/patient/patient-import/status";
import { PatientImportJob } from "@metriport/shared/domain/patient/patient-import/types";
import axios from "axios";
import { elapsedTimeAsStr } from "../shared/duration";

/**
 * Script to finalize the processing of a patient import job.
 * It will call the PatientImportResultLambda to consolidate the patients' records into files in
 * the S3 bucket/prefix, including:
 * - result.csv: all entries w/ the status and reason
 * - invalid.csv: only the entries marked as invalid
 *
 * ...and update the job status at the API to 'completed'.
 *
 * This can take a while, depending on the number of patients in the job (e.g., 5min for 7,500 pts).
 *
 * Usage:
 * - set the environment variables in the .env file
 * - pass the CX ID and the patient import job ID as the first and second arguments
 * - run it:
 *   - ts-node src/patient-import/finalize-processing-job.ts <cxId> <patientImportJobId>
 */

// The ID of the CX
const cxId = process.argv[2];
// The ID of the patient import job
const patientImportJobId = process.argv[3];

const apiUrl = getEnvVarOrFail("API_URL");
const region = getEnvVarOrFail("AWS_REGION");

const lambdaName = "PatientImportResultLambda";

export const ossApi = axios.create({
  baseURL: apiUrl,
  headers: { "Content-Type": "application/json" },
});

async function main() {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's

  if (!cxId || !patientImportJobId) {
    console.error("CX ID and patient import job ID are required");
    console.error(
      "Usage: ts-node src/patient-import/finalize-processing-job.ts <cxId> <patientImportJobId>"
    );
    process.exit(1);
  }

  const startedAt = Date.now();
  console.log(`############## Started at ${new Date(startedAt).toISOString()} ##############`);

  const patientImport = await getPatientImportJobOrFail({ cxId, jobId: patientImportJobId });

  console.log(`>>> Patient import job: ${JSON.stringify(patientImport, null, 2)}`);

  await displayWarningAndConfirmation({
    patientImportJobId,
    patientImportJobStatus: patientImport.status,
    log: console.log,
  });

  const lambdaClient = makeLambdaClient(region);
  const payload: ProcessPatientResult = {
    cxId,
    jobId: patientImportJobId,
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
  patientImportJobId,
  patientImportJobStatus,
  log = console.log,
}: {
  patientImportJobId: string;
  patientImportJobStatus: PatientImportJobStatus;
  log?: typeof console.log;
}) {
  const msg =
    `You are about to terminate the patient import job ${patientImportJobId} with status ${patientImportJobStatus} for the cx ${cxId}.` +
    `\nThis can take a while, depending on the number of patients in the job. Check the lambda's execution log to see the progress.`;
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

main();
