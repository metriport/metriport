// import * as Sentry from "@sentry/serverless";
import status from "http-status";
// import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";
import { S3Event } from "aws-lambda";
import { makeS3Client } from "@metriport/core/external/aws/s3";
import axios from "axios";
import { getFileInfoFromS3 } from "./shared/file-info";

// // Keep this as early on the file as possible
// // capture.init();

const apiServerURL = getEnvOrFail("API_URL");
const api = axios.create();
const region = getEnvOrFail("AWS_REGION");
const s3 = makeS3Client(region);

const buildResponse = (status: number, body?: unknown) => ({
  statusCode: status,
  body,
});

type FileData = {
  mimetype?: string;
  size?: number;
  docId: string;
  cxId: string;
  patientId: string;
};

export const handler = async (event: S3Event) => {
  if (event.Records[0]) {
    const sourceBucket = event.Records[0].s3.bucket.name;
    const sourceKey = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));
    const destinationBucket = "devs.metriport.com";
    const destinationKey = `${removeSuffix(sourceKey, "_upload")}`;

    const params = {
      CopySource: encodeURI(`${sourceBucket}/${sourceKey}`),
      Bucket: destinationBucket,
      Key: destinationKey,
    };

    try {
      // make a copy of the file to the general medical documents bucket
      const resp = await s3.copyObject(params).promise();
      console.log("RESPONSE", JSON.stringify(resp));
      const { size, contentType } = await getFileInfoFromS3(destinationKey, destinationBucket);
      console.log("Got size and content type", size, contentType);

      const fileData: FileData = {
        size,
        mimetype: contentType,
        ...getIdsFromKey(destinationKey),
      };
      console.log("Got file data:", fileData);

      // parse file details and pass to api internal route
      try {
        return forwardCallToServer(fileData);
      } catch (err) {
        console.log("Error forwarding call to server", err);
        return buildResponse(status.INTERNAL_SERVER_ERROR);
      }
    } catch (err) {
      console.log(err);
      const message = `Error getting object ${sourceKey} from bucket ${sourceBucket}. Make sure they exist and your bucket is in the same region as this function.`;
      console.log(message);
      throw new Error(message);
    }
  }
};

function removeSuffix(key: string, arg1: string) {
  const newFileName = key.indexOf(arg1) > -1 ? key.replace(arg1, "") : key;
  console.log("New file name will be", newFileName);
  return newFileName;
}

function getIdsFromKey(destinationKey: string): { cxId: string; patientId: string; docId: string } {
  console.log("Destination key is:", destinationKey);
  if (destinationKey.includes("_")) {
    const keyParts = destinationKey.split("_");
    if (keyParts[0] && keyParts[1] && keyParts[2] && keyParts[0].includes("/")) {
      const cxIdParts = keyParts[0].split("/");
      if (cxIdParts[0]) {
        const cxId = cxIdParts[0];
        const patientId = keyParts[1];
        const docId = keyParts[2];
        const fileData = {
          cxId,
          patientId,
          docId,
        };
        return fileData;
      }
    }
  }
  // Need capture to report to Sentry
  throw new Error("Invalid destination key");
}

async function forwardCallToServer(fileData: FileData) {
  console.log("Forwarding call to server at URL: ", apiServerURL);
  const requestBody = {
    mimeType: fileData.mimetype,
    size: fileData.size,
    originalname: fileData.docId,
  };

  const url = `${apiServerURL}?cxId=${fileData.cxId}&patientId=${fileData.patientId}`;
  console.log("URL is", url);
  const resp = await api.post(url, requestBody);

  console.log(`Server response - status: ${resp.status}`);
  console.log(`Server response - body: ${resp.data}`);
  return buildResponse(resp.status, resp.data);
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
