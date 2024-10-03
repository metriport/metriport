import { errorToString, MetriportError, sleep } from "@metriport/shared";
import { SQSEvent } from "aws-lambda";
import AWS from "aws-sdk";
import { PatientImportQueryBody } from "./patient-import-query";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";
import { prefixedLog } from "./shared/log";
import { getSingleMessageOrFail } from "./shared/sqs";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");
const region = getEnvOrFail("AWS_REGION");
// Set by us
const patientImportBucket = getEnvOrFail("PATIENT_IMPORT_BUCKET_NAME");
const apiURL = getEnvOrFail("API_URL");
const patientQueryQueueURL = getEnvOrFail("PATIENT_QUERY_QUEUE_URL");
const waitTimeMillisRaw = getEnvOrFail("WAIT_TIME_IN_MILLIS");
const waitTimeMillis = parseInt(waitTimeMillisRaw);

export type PatientImportCreateBody = {
  cxId: string;
  jobId: string;
  jobStartedAt: string; // TODO consider moving to Date if we need to work with it here
  // TODO 2230 Prob want to expand this to include the columns of the CSV
  patientId: string;
};

const sqs = new AWS.SQS({ region });

// Don't use Sentry's default error handler b/c we want to use our own and send more context-aware data
export async function handler(event: SQSEvent) {
  let errorHandled = false;
  const errorMsg = "Error processing event on " + lambdaName;
  const startedAt = new Date().getTime();
  try {
    const message = getSingleMessageOrFail(event.Records, lambdaName);
    if (!message) return;

    console.log(`Body: ${message.body}, patientImportBucket ${patientImportBucket}`);
    const parsedBody = parseBody(message.body);
    const { cxId, patientId, jobId, jobStartedAt } = parsedBody;

    const log = prefixedLog(`cxId ${cxId}, patientId ${patientId}, job ${jobId}`);
    try {
      // TODO 2330 call the logic from Core
      // TODO 2330 call the logic from Core
      // TODO 2330 call the logic from Core
      log(`apiURL: ${apiURL}`);
      log(`Parsed: ${JSON.stringify(parsedBody)}`);

      // TODO 2330 MOCKED BEHAVIOR
      // TODO 2330 MOCKED BEHAVIOR
      // TODO 2330 MOCKED BEHAVIOR
      await sleep(waitTimeMillis);

      // TODO 2330 Move this to Core, we should have diff implementations for this, so we can run it
      // local and on the cloud
      const body: PatientImportQueryBody = {
        cxId,
        jobId,
        jobStartedAt,
        patientId,
      };
      const sendParams = {
        MessageBody: JSON.stringify(body),
        QueueUrl: patientQueryQueueURL,
        MessageGroupId: cxId,
        MessageDeduplicationId: patientId,
      };
      log(`Sending message to query lambda...`);
      await sqs.sendMessage(sendParams).promise();

      const finishedAt = new Date().getTime();
      console.log(`Done local duration: ${finishedAt - startedAt}ms`);
    } catch (error) {
      errorHandled = true;
      console.log(`${errorMsg}: ${errorToString(error)}`);
      capture.error(errorMsg, {
        extra: { event, context: lambdaName, error },
      });
      throw new MetriportError(errorMsg, error, { ...parsedBody });
    }
  } catch (error) {
    if (errorHandled) throw error;
    console.log(`${errorMsg}: ${errorToString(error)}`);
    capture.error(errorMsg, {
      extra: { event, context: lambdaName, error },
    });
    throw new MetriportError(errorMsg, error);
  }
}

function parseBody(body?: unknown): PatientImportCreateBody {
  if (!body) throw new Error(`Missing message body`);

  const bodyString = typeof body === "string" ? (body as string) : undefined;
  if (!bodyString) throw new Error(`Invalid body`);

  const bodyAsJson = JSON.parse(bodyString);

  const cxIdRaw = bodyAsJson.cxId;
  if (!cxIdRaw) throw new Error(`Missing cxId`);
  if (typeof cxIdRaw !== "string") throw new Error(`Invalid cxId`);

  const patientIdRaw = bodyAsJson.patientId;
  if (!patientIdRaw) throw new Error(`Missing patientId`);
  if (typeof patientIdRaw !== "string") throw new Error(`Invalid patientId`);

  const jobIdRaw = bodyAsJson.jobId;
  if (!jobIdRaw) throw new Error(`Missing jobId`);
  if (typeof jobIdRaw !== "string") throw new Error(`Invalid jobId`);

  const jobStartedAtRaw = bodyAsJson.jobStartedAt;
  if (!jobStartedAtRaw) throw new Error(`Missing jobStartedAt`);
  if (typeof jobStartedAtRaw !== "string") throw new Error(`Invalid jobStartedAt`);

  const cxId = cxIdRaw as string;
  const patientId = patientIdRaw as string;
  const jobId = jobIdRaw as string;
  const jobStartedAt = jobStartedAtRaw as string;

  return { cxId, patientId, jobId, jobStartedAt };
}
