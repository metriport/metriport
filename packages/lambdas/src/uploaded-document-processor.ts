import * as Sentry from "@sentry/serverless";
import status from "http-status";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";
import { SQSClient } from "@metriport/core/external/aws/sqs";
// import { getFileInfoFromS3 } from "./document-downloader";

// Keep this as early on the file as possible
capture.init();

const bucketName = getEnvOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");
const region = getEnvOrFail("AWS_REGION");

const buildResponse = (status: number, body?: unknown) => ({
  statusCode: status,
  body,
});

export const handler = Sentry.AWSLambda.wrapHandler(async event => {
  console.log(
    `Triggered the upload document process lambda! Bucket to watch: ${bucketName} Type of event: `,
    typeof event
  );
  console.log("Event is:", JSON.stringify(event));

  try {
    if (event.Records && event.Records.length) {
      const s3Event = event.Records[0].s3;
      const bucket = s3Event.bucket.name;
      const key = s3Event.object.key;
      console.log(`Bucket: ${bucket} Key: ${key}`);
    } else {
      console.log("No records found in event.");
    }
  } catch (err) {
    console.log("Something went wrong with the event.", err);
  }

  try {
    const sqs = new SQSClient({ region });
    console.log("SQS client created successfully.", sqs);
  } catch (err) {
    console.log("Couldn't start an sqs client.", err);
  }

  return buildResponse(status.NOT_FOUND);
});

// from getFileInfoFromS3

// const head = await s3Client
//       .headObject({
//         Bucket: bucket,
//         Key: key,
//       })
//       .promise();
//     return {
//       exists: true,
//       size: head.ContentLength ?? 0,
//       contentType: head.ContentType ?? undefined,
//     };

// export function isConvertible(mimeType?: string): boolean {
//     return mimeType != null && ["text/xml", "application/xml"].includes(mimeType);
//   }

// const fhirServerConnector = makeFHIRServerConnector();
//
// const connector = makeFHIRConverterConnector();
//     await connector.requestConvert({

// await sidechainConvertCDAToFHIR({
//     patient,
//     document: params.document,
//     s3FileName,
//     s3BucketName,
//     requestId,
//   });
// }

// upsertDocumentToFHIRServer

// export class FHIRServerConnectorSQS implements FHIRServerConnector {
//     async upsertBatch({
//       cxId,
//       patientId,
//       documentId,
//       payload,
//       requestId,
//     }: FHIRServerRequest): Promise<void> {
//       const queueUrl = Config.getFHIRServerQueueURL();

//       await sendMessageToQueue(queueUrl, payload, {
//         messageAttributes: {
//           cxId,
//           patientId,
//           jobId: `${requestId}_${documentId}`,
//           startedAt: dayjs.utc().toISOString(),
//         },
//       });
//     }
//   }
