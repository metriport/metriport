import { PatientDataConsolidator } from "@metriport/core/command/consolidated/patient-data-consolidator";
import { errorToString, MetriportError } from "@metriport/shared";
import { SQSEvent } from "aws-lambda";
import { capture } from "./shared/capture";
import { logMemoryUsage } from "./shared/cloudwatch";
import { getEnvOrFail } from "./shared/env";
import { prefixedLog } from "./shared/log";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");
const region = getEnvOrFail("AWS_REGION");
// Set by us
const consolidatedBucket = getEnvOrFail("CONSOLIDATED_PATIENT_DATA_BUCKET_NAME");

const dataConsolidator = new PatientDataConsolidator(consolidatedBucket, region);

type EventBody = {
  s3BucketName: string;
  s3FileName: string;
};

export async function handler(event: SQSEvent) {
  try {
    const records = event.Records;
    if (!records || records.length < 1) {
      console.log(`No records, discarding this event: ${JSON.stringify(event)}`);
      return;
    }
    if (records.length > 1) {
      const msg = "Got more than one message from SQS";
      const additional = `This lambda is supposed to run w/ only 1 message per batch, got ${records.length} (still processing them all)`;
      console.log(msg + " - " + additional);
      capture.message(msg, {
        extra: {
          event,
          context: lambdaName,
          additional,
        },
        level: "warning",
      });
    }
    console.log(`Processing ${records.length} records...`);
    for (const [i, message] of records.entries()) {
      // Process one record from the SQS message
      console.log(`Record ${i}, messageId: ${message.messageId}`);
      if (!message.messageAttributes) throw new Error(`Missing message attributes`);
      if (!message.body) throw new Error(`Missing message body`);
      const attrib = message.messageAttributes;
      const cxId = attrib.cxId?.stringValue;
      const patientId = attrib.patientId?.stringValue;
      const jobId = attrib.jobId?.stringValue;
      if (!cxId) throw new Error(`Missing cxId`);
      if (!patientId) throw new Error(`Missing patientId`);
      const log = prefixedLog(`${i}, patient ${patientId}, job ${jobId}`);

      log(`Body: ${message.body}`);
      const { s3BucketName: newBundleBucket, s3FileName: newBundleS3Key } = parseBody(message.body);

      await dataConsolidator.execute({
        cxId,
        patientId,
        newBundleBucket,
        newBundleS3Key,
        logMemUsage: () => logMemoryUsage(),
      });
    }
    console.log(`Done`);
  } catch (error) {
    const msg = "Error processing event on " + lambdaName;
    console.log(`${msg}: ${errorToString(error)}`);
    capture.error(msg, {
      extra: { event, context: lambdaName, error },
    });
    throw new MetriportError(msg, error);
  }
}

function parseBody(body: unknown): EventBody {
  const bodyString = typeof body === "string" ? (body as string) : undefined;
  if (!bodyString) throw new Error(`Invalid body`);

  const bodyAsJson = JSON.parse(bodyString);

  const s3BucketNameRaw = bodyAsJson.s3BucketName;
  if (!s3BucketNameRaw) throw new Error(`Missing s3BucketName`);
  if (typeof s3BucketNameRaw !== "string") throw new Error(`Invalid s3BucketName`);

  const s3FileNameRaw = bodyAsJson.s3FileName;
  if (!s3FileNameRaw) throw new Error(`Missing s3FileName`);
  if (typeof s3FileNameRaw !== "string") throw new Error(`Invalid s3FileName`);

  const s3BucketName = s3BucketNameRaw as string;
  const s3FileName = s3FileNameRaw as string;

  return { s3BucketName, s3FileName };
}
