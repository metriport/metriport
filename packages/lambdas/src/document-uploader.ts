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
    const copySource = encodeURI(`${sourceBucket}/${sourceKey}`);
    console.log("Copy Source:", copySource);
    const destinationBucket = "devs.metriport.com";
    const { destinationKey, docRefId } = getDestinationKeyAndDocRefId(sourceKey);

    const params = {
      CopySource: copySource,
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
      const message = "Invalid S3 file name";
      capture.error(message, {
        extra: { context: `documentUploader.s3FileNameParse`, destinationKey },
      });
      throw new MetriportError(message, null, { destinationKey });
    }
    const { cxId, docId } = s3FileNameParts;

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
      await forwardCallToServer(cxId, fileData);
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

async function forwardCallToServer(cxId: string, fileData: FileData) {
  const url = `${apiServerURL}?cxId=${cxId}`;
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
  // a19fc9aa-bce0-4487-909b-802eab03aeed/018b3a35-1aea-7c55-a8ab-c60a2638a0ee/a19fc9aa-bce0-4487-909b-802eab03aeed_018b3a35-1aea-7c55-a8ab-c60a2638a0ee_018b5f1e-80c3-78da-a9a2-e7ff43da6446_upload_018b5f1e-80c4-7dfc-9ab7-9c8ab31558c5
  const keyParts = sourceKey.split("_upload_");
  console.log("Key Parts:", keyParts);
  let destinationKey;
  const docRefId = keyParts[1];
  if (keyParts[0]) {
    const index = keyParts[0].lastIndexOf("/");
    destinationKey =
      keyParts[0].substring(0, index) + "/uploads/" + keyParts[0].substring(index + 1);
    destinationKey = removeSuffix(destinationKey, "_upload");
  }

  if (!destinationKey || !docRefId) {
    throw new MetriportError("Invalid Source Key.", null, { sourceKey, destinationKey, docRefId });
  }

  return { destinationKey, docRefId };
}
