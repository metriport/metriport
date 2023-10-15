// import * as Sentry from "@sentry/serverless";
import status from "http-status";
// import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";
import { S3Event } from "aws-lambda";
import { makeS3Client } from "@metriport/core/external/aws/s3";

// // Keep this as early on the file as possible
// // capture.init();

// // const bucketName = getEnvOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");
const region = getEnvOrFail("AWS_REGION");
const s3 = makeS3Client(region);

const buildResponse = (status: number, body?: unknown) => ({
  statusCode: status,
  body,
});

export const handler = async (event: S3Event) => {
  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));
  const newKey = `devs.metriport.com/ramil/${removeSuffix(key, "_upload")}`;
  const params = {
    CopySource: encodeURI(`${bucket}/${key}`),
    Bucket: bucket,
    Key: newKey,
  };
  try {
    // make a copy of the file to the general medical documents bucket
    const resp = await s3.copyObject(params).promise();
    console.log("RESPONSE", resp);

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
// Get the object from the event and show its content type

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
