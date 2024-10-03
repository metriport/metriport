import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { errorToString, MetriportError } from "@metriport/shared";
import AWS from "aws-sdk";
import { PatientImportCreateBody } from "./patient-import-create";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";
import { prefixedLog } from "./shared/log";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");
const region = getEnvOrFail("AWS_REGION");
// Set by us
const patientImportBucket = getEnvOrFail("PATIENT_IMPORT_BUCKET_NAME");
const patientCreateQueueURL = getEnvOrFail("PATIENT_CREATE_QUEUE_URL");

type EventBody = {
  cxId: string;
  jobId?: string | undefined;
  s3BucketName: string;
  s3FileName: string;
  // TODO 2230 Remove this
  // TODO 2230 Remove this
  // TODO 2230 Remove this
  amountOfPatients: number;
};

const sqs = new AWS.SQS({ region });

// Don't use Sentry's default error handler b/c we want to use our own and send more context-aware data
export async function handler(event: EventBody) {
  let errorHandled = false;
  const errorMsg = "Error processing event on " + lambdaName;
  const startedAt = new Date().getTime();
  try {
    console.log(`Running with unparsed body: ${JSON.stringify(event)}`);
    const parsedBody = parseBody(event);
    const { cxId, jobId = uuidv7(), s3BucketName, s3FileName, amountOfPatients } = parsedBody;

    const jobStartedAt = new Date().toISOString();

    const log = prefixedLog(`cxId ${cxId}, job ${jobId}`);
    try {
      // TODO 2330 call the logic from Core
      // TODO 2330 call the logic from Core
      // TODO 2330 call the logic from Core
      log(
        `Parsed: ${JSON.stringify(
          parsedBody
        )}, s3BucketName ${s3BucketName}, s3FileName ${s3FileName},patientImportBucket ${patientImportBucket}`
      );

      // TODO 2330 MOCKED BEHAVIOR
      // TODO 2330 MOCKED BEHAVIOR
      // TODO 2330 MOCKED BEHAVIOR
      log(`(MOCKED) Creating ${amountOfPatients} patients`);
      for (const i of Array(amountOfPatients).keys()) {
        // TODO 2230 replace this w/ the data from the CSV
        const patientId = `${cxId}_`.padEnd(cxId.length + 5, i + "");
        // TODO 2330 Move this to Core, we should have diff implementations for this, so we can run it
        // local and on the cloud
        const body: PatientImportCreateBody = {
          cxId,
          jobId,
          jobStartedAt,
          patientId,
        };
        const sendParams = {
          MessageBody: JSON.stringify(body),
          QueueUrl: patientCreateQueueURL,
          MessageGroupId: cxId,
          MessageDeduplicationId: patientId,
        };
        log(`Sending message ${i + 1}, patient ${patientId} to create lambda...`);
        await sqs.sendMessage(sendParams).promise();
      }

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

function parseBody(body?: unknown): EventBody {
  if (!body) throw new Error(`Missing message body`);

  const bodyAsJson = typeof body === "string" ? JSON.parse(body) : body;

  const cxIdRaw = bodyAsJson.cxId;
  if (!cxIdRaw) throw new Error(`Missing cxId`);
  if (typeof cxIdRaw !== "string") throw new Error(`Invalid cxId`);

  const jobIdRaw = bodyAsJson.jobId;
  if (!jobIdRaw) throw new Error(`Missing jobId`);
  if (typeof jobIdRaw !== "string") throw new Error(`Invalid jobId`);

  const s3BucketNameRaw = bodyAsJson.s3BucketName;
  if (!s3BucketNameRaw) throw new Error(`Missing s3BucketName`);
  if (typeof s3BucketNameRaw !== "string") throw new Error(`Invalid s3BucketName`);

  const s3FileNameRaw = bodyAsJson.s3FileName;
  if (!s3FileNameRaw) throw new Error(`Missing s3FileName`);
  if (typeof s3FileNameRaw !== "string") throw new Error(`Invalid s3FileName`);

  const jobId = jobIdRaw as string;
  const cxId = cxIdRaw as string;
  const s3BucketName = s3BucketNameRaw as string;
  const s3FileName = s3FileNameRaw as string;

  // TODO 2230 remove this
  const amountOfPatientsRaw = bodyAsJson.amountOfPatients;
  const amountOfPatients =
    typeof amountOfPatientsRaw === "number"
      ? (amountOfPatientsRaw as number)
      : typeof amountOfPatientsRaw === "string"
      ? parseInt(amountOfPatientsRaw)
      : 1;

  return { cxId, jobId, s3BucketName, s3FileName, amountOfPatients };
}
