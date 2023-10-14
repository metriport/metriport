// import * as Sentry from "@sentry/serverless";
import status from "http-status";
// import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";
import { S3Event } from "aws-lambda";
import { makeS3Client } from "@metriport/core/external/aws/s3";
// import { getFileInfoFromS3 } from "./document-downloader";

// Keep this as early on the file as possible
// capture.init();

// const bucketName = getEnvOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");
const region = getEnvOrFail("AWS_REGION");
const s3 = makeS3Client(region);

const buildResponse = (status: number, body?: unknown) => ({
  statusCode: status,
  body,
});

export const handler = async (event: S3Event) => {
  // Get the object from the event and show its content type
  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));
  const newKey = `devs.metrpiport.com/ramil/${removeSuffix(key, "_upload")}`;
  const params = {
    Bucket: bucket,
    CopySource: encodeURI(`${bucket}/${key}`),
    Key: newKey,
  };
  try {
    console.log("Bucket name is:", bucket, "\nAnd key is", key);
    s3.copyObject(params, (err, data) => {
      if (err) console.log("Err copying the file:", err);
      console.log("Data is:", data);
    });
    return buildResponse(status.NOT_FOUND);
  } catch (err) {
    console.log(err);
    const message = `Error getting object ${key} from bucket ${bucket}. Make sure they exist and your bucket is in the same region as this function.`;
    console.log(message);
    throw new Error(message);
  }
};

function removeSuffix(key: string, arg1: string) {
  const newFileName = key.indexOf(arg1) > -1 ? key.replace(arg1, "") : key;
  console.log("New file name will be", newFileName);
  return newFileName;
}
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
