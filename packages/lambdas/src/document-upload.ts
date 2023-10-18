// import * as Sentry from "@sentry/serverless";
// import status from "http-status";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";
import { S3Event } from "aws-lambda";
import { makeS3Client } from "@metriport/core/external/aws/s3";
import axios from "axios";
import { getFileInfoFromS3 } from "./shared/file-info";
import { MetriportError } from "@metriport/core/util/error/metriport-error";

// // Keep this as early on the file as possible
capture.init();

const apiServerURL = getEnvOrFail("API_URL");
// const destinationBucket = getEnvOrFail("MEDICAL_DOCUMENTS_BUCKET");
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
    const { destinationKey, queryParams } = getDestinationKeyAndQueryParams(sourceKey);

    const params = {
      CopySource: encodeURI(`${sourceBucket}/${sourceKey}`),
      Bucket: destinationBucket,
      Key: destinationKey,
    };
    // Make a copy of the file to the general medical documents bucket
    try {
      await s3.copyObject(params).promise();
    } catch (err) {
      console.log("Error copying file to general medical documents bucket", JSON.stringify(err));
      capture.error("Error copying file to general medical documents bucket", {
        extra: { context: `document-upload`, err, destinationKey, sourceKey },
      });
      throw err;
    }

    // Get file info from the copied file
    const { size, contentType } = await getFileInfoFromS3(destinationKey, destinationBucket);
    const fileData = {
      size,
      mimetype: contentType,
      ...getIdsFromKey(destinationKey),
    };
    console.log("Got file data:", fileData);

    try {
      // POST /internal/docs/doc-ref
      return forwardCallToServer(fileData, queryParams);
    } catch (err) {
      console.log("Failed to process uploaded file", JSON.stringify(err));
      capture.error("Failed to process uploaded file", {
        extra: { context: `document-upload`, err, fileData },
      });
    }
  }
};

function removeSuffix(key: string, arg1: string) {
  const newFileName = key.indexOf(arg1) > -1 ? key.replace(arg1, "") : key;
  return newFileName;
}

function getIdsFromKey(destinationKey: string): { cxId: string; patientId: string; docId: string } {
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
  capture.error("Invalid destination key", {
    extra: { context: `document-upload.ids-from-key`, destinationKey },
  });
  throw new MetriportError("Invalid destination key", null, { destinationKey });
}

async function forwardCallToServer(fileData: FileData, queryParams?: string) {
  const requestBody = {
    mimeType: fileData.mimetype,
    size: fileData.size,
    originalname: fileData.docId,
  };

  const url = `${apiServerURL}?cxId=${fileData.cxId}&patientId=${fileData.patientId}${queryParams}`;
  const encodedUrl = encodeURI(url);
  console.log("POST doc-ref URL is:", encodedUrl);

  const resp = await api.post(encodedUrl, requestBody);
  console.log(`Server response - status: ${resp.status}`);
  console.log(`Server response - body: ${resp.data}`);
  return buildResponse(resp.status, resp.data);
}

function getDestinationKeyAndQueryParams(sourceKey: string): {
  destinationKey: string;
  queryParams: string | undefined;
} {
  const keyParts = sourceKey.split("?");
  const destinationKey = keyParts[0] ? removeSuffix(keyParts[0], "_upload") : "";
  if (!destinationKey) {
    throw new Error("Invalid destination key");
  }
  const queryParams = keyParts[1] ? `&${keyParts[1]}` : "";

  return { destinationKey, queryParams };
}
