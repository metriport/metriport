import axios from "axios";
import { MetriportError } from "../../../util/error/metriport-error";
import { S3Utils, parseS3FileName } from "../s3";

const api = axios.create();

const UPLOADS_FOLDER = "uploads";
const MAXIMUM_FILE_SIZE = 50_000_000; // 50 MB

export type FileData = {
  mimeType?: string | undefined;
  size?: number | undefined;
  originalName: string;
  locationUrl: string;
  docId: string;
};

export async function documentUploaderHandler(
  sourceBucket: string,
  sourceKey: string,
  destinationBucket: string,
  region: string,
  apiServerURL: string
): Promise<void | { message: string; size: number }> {
  const s3Utils = new S3Utils(region);
  const copySource = encodeURI(`${sourceBucket}/${sourceKey}`);
  const s3FileNameParts = parseS3FileName(sourceKey);
  if (!s3FileNameParts) {
    const message = "Failed to parse S3 file key";
    console.log(message);
    throw new MetriportError(message, null, { sourceBucket, sourceKey });
  }
  const { cxId, patientId, docId } = s3FileNameParts;
  const destinationKey = buildDestinationKey(cxId, patientId, docId);

  const params = {
    CopySource: copySource,
    Bucket: destinationBucket,
    Key: destinationKey,
  };

  // Make a copy of the file to the general medical documents bucket
  try {
    await s3Utils.s3.copyObject(params).promise();
  } catch (error) {
    const message = "Error copying the uploaded file to medical documents bucket";
    console.log(`${message}: ${error}`);
    throw new MetriportError(message, error, { copySource, destinationBucket, destinationKey });
  }

  // Get file info from the copied file
  const { size, contentType } = await s3Utils.getFileInfoFromS3(destinationKey, destinationBucket);

  const fileData: FileData = {
    mimeType: contentType,
    size,
    originalName: destinationKey,
    locationUrl: s3Utils.buildFileUrl(destinationBucket, destinationKey),
    docId,
  };

  try {
    console.log("Forwarding call to server with this fileData:", JSON.stringify(fileData));
    await forwardCallToServer(cxId, apiServerURL, fileData);
    if (size && size > MAXIMUM_FILE_SIZE) {
      // #1207 TODO: Delete the file if it's too large and alert the customer.
      const message = `Uploaded file size exceeds the maximum allowed size`;
      console.log(`${message}: ${size}`);
      return { message, size };
    }
  } catch (error) {
    const message = "Failed with the call to update the doc-ref of an uploaded file";
    console.log(`${message}: ${error}`);
    throw new MetriportError(message, error, { sourceKey, destinationKey });
  }
}

async function forwardCallToServer(cxId: string, apiServerURL: string, fileData: FileData) {
  const url = `${apiServerURL}?cxId=${cxId}`;
  const encodedUrl = encodeURI(url);

  const resp = await api.post(encodedUrl, fileData);
  console.log(`Server response - status: ${resp.status}`);
  console.log(`Server response - body: ${resp.data}`);
}

function buildDestinationKey(cxId: string, patientId: string, docId: string): string {
  return `${cxId}/${patientId}/${UPLOADS_FOLDER}/${cxId}_${patientId}_${docId}`;
}
