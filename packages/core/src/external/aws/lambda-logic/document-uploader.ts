import axios from "axios";
import { MetriportError } from "../../../util/error/metriport-error";
import { getFileInfoFromS3, makeS3Client, parseS3FileName } from "../s3";

const api = axios.create();

export type FileData = {
  mimeType?: string | undefined;
  size?: number | undefined;
  originalName: string;
  locationUrl: string;
  docId: string;
  docRefId: string;
};

export async function documentUploaderHandler(
  sourceBucket: string,
  sourceKey: string,
  destinationBucket: string,
  region: string,
  apiServerURL: string
) {
  const s3Client = makeS3Client(region);
  const copySource = encodeURI(`${sourceBucket}/${sourceKey}`);
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
    const message = "Error copying the uploaded file to medical documents bucket";
    console.log(message, JSON.stringify(error));
    throw new MetriportError(message, null, { copySource, destinationBucket, destinationKey });
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
    throw new MetriportError(message, null, { destinationBucket, destinationKey });
  }
  const { cxId, docId } = s3FileNameParts;

  const fileData: FileData = {
    mimeType: contentType,
    size,
    originalName: destinationKey,
    locationUrl: `https://${destinationBucket}.s3.${region}.amazonaws.com/${destinationKey}`,
    docId,
    docRefId,
  };

  try {
    // POST /internal/docs/doc-ref
    console.log("Forwarding call to server with this fileData:", JSON.stringify(fileData));
    await forwardCallToServer(cxId, apiServerURL, fileData);
  } catch (error) {
    const message = "Failed with the call to update the doc-ref of an uploaded file.";
    console.log(message, JSON.stringify(error));
    throw new MetriportError(message, null, { sourceKey, destinationKey, docRefId });
  }
}

async function forwardCallToServer(cxId: string, apiServerURL: string, fileData: FileData) {
  const url = `${apiServerURL}?cxId=${cxId}`;
  const encodedUrl = encodeURI(url);
  console.log("FileData: ", JSON.stringify(fileData));

  const resp = await api.post(encodedUrl, fileData);
  console.log(`Server response - status: ${resp.status}`);
  console.log(`Server response - body: ${resp.data}`);
}

function getDestinationKeyAndDocRefId(sourceKey: string): {
  destinationKey: string;
  docRefId: string;
} {
  const keyParts = sourceKey.split("_upload_");
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

function removeSuffix(key: string, suffix: string) {
  return key.includes(suffix) ? key.replace(suffix, "") : key;
}
