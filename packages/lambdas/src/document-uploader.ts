// import * as Sentry from "@sentry/serverless";
// import status from "http-status";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";
import { S3Event } from "aws-lambda";
import { makeS3Client, parseS3FileName, getFileInfoFromS3 } from "@metriport/core/external/aws/s3";
import axios from "axios";
import { MetriportError } from "@metriport/core/util/error/metriport-error";

// Keep this as early on the file as possible
capture.init();

const apiServerURL = getEnvOrFail("API_URL");
// const destinationBucket = getEnvOrFail("MEDICAL_DOCUMENTS_BUCKET");
const api = axios.create();
const region = getEnvOrFail("AWS_REGION");
const s3Client = makeS3Client(region);

type FileData = {
  mimetype?: string;
  size?: number;
  locationUrl: string;
  docId: string;
  docRefId: string;
};

export const handler = async (event: S3Event) => {
  if (event.Records[0]) {
    const sourceBucket = event.Records[0].s3.bucket.name;
    const sourceKey = decodeURIComponent(event.Records[0].s3.object.key);
    console.log("SourceKey:", sourceKey);
    const destinationBucket = "devs.metriport.com";
    const { destinationKey, docRefId } = getDestinationKeyAndDocRefId(sourceKey);

    const params = {
      CopySource: encodeURI(`${sourceBucket}/${sourceKey}`),
      Bucket: destinationBucket,
      Key: destinationKey,
    };
    // Make a copy of the file to the general medical documents bucket
    try {
      await s3Client.copyObject(params).promise();
    } catch (error) {
      const message = "Error copying uploaded file to medical documents bucket";
      console.log(message, JSON.stringify(error));
      capture.error(message, {
        extra: { context: `document-upload`, err: error, destinationKey, sourceKey },
      });
      throw error;
    }

    // Get file info from the copied file
    const { size, contentType } = await getFileInfoFromS3({
      key: destinationKey,
      bucket: destinationBucket,
      s3: s3Client,
    });
    const s3FileNameParts = parseS3FileName(destinationKey);
    if (!s3FileNameParts) {
      throw new MetriportError("Invalid S3 file name", null, { destinationKey });
    }
    const { cxId, patientId, docId } = s3FileNameParts;

    const fileData = {
      size,
      mimetype: contentType,
      locationUrl: `https://${destinationBucket}.s3.${region}.amazonaws.com/${destinationKey}`,
      docId,
      docRefId,
    };
    console.log("Got file data:", fileData);

    try {
      // POST /internal/docs/doc-ref
      await forwardCallToServer(cxId, patientId, fileData);
    } catch (error) {
      const message = "Failed with a call to generate a doc-ref on an uploaded file";
      console.log(message, JSON.stringify(error));
      capture.error(message, {
        extra: { context: `document-upload`, err: error, fileData },
      });
    }
  }
};

function removeSuffix(key: string, suffix: string) {
  return key.includes(suffix) ? key.replace(suffix, "") : key;
}

async function forwardCallToServer(cxId: string, patientId: string, fileData: FileData) {
  const url = `${apiServerURL}?cxId=${cxId}&patientId=${patientId}`;
  const encodedUrl = encodeURI(url);
  console.log("FileData: ", fileData);
  console.log("POST /document/doc-ref URL is:", encodedUrl);

  const resp = await api.post(encodedUrl, fileData);
  console.log(`Server response - status: ${resp.status}`);
  console.log(`Server response - body: ${resp.data}`);
}

function getDestinationKeyAndDocRefId(sourceKey: string): {
  destinationKey: string;
  docRefId: string;
} {
  const keyParts = sourceKey.split("?");
  let destinationKey;
  if (keyParts[0]) {
    const index = keyParts[0].lastIndexOf("/");
    destinationKey =
      keyParts[0].substring(0, index) + "/uploads/" + keyParts[0].substring(index + 1);
    destinationKey = removeSuffix(keyParts[0], "_upload");
  }
  if (!destinationKey) {
    throw new Error("Invalid destination key");
  }

  if (keyParts[1]) {
    const docRefId = extractQueryParamInfo(keyParts[1]);
    return { destinationKey, docRefId };
  }
  throw new Error("Invalid query params");
}

function extractQueryParamInfo(queryParam: string) {
  const queryParamValue = queryParam?.split("=")[1];
  if (queryParamValue) return queryParamValue;
  throw new Error("Invalid query param");
}
