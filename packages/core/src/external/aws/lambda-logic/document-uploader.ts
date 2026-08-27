import { DocumentReference } from "@medplum/fhirtypes";
import { errorToString, executeWithNetworkRetries, executeWithRetries } from "@metriport/shared";
import axios from "axios";
import { createDocumentFileName } from "../../../domain/document/filename";
import { parseFilePath } from "../../../domain/filename";
import { createAndUploadDocumentMetadataFile } from "../../../shareback/create-and-upload-metadata";
import {
  createUploadFilePath,
  getMetadataFilePathFromDocumentFilePath,
} from "../../../shareback/file";
import { MetriportError } from "../../../util/error/metriport-error";
import { computeS3ObjectSha1 } from "../../../util/hash";
import { out } from "../../../util/log";
import { S3Utils } from "../s3";

const api = axios.create();
const { log } = out(`Core Document Uploader`);
export const MAXIMUM_UPLOAD_FILE_SIZE = 50_000_000; // 50 MB

export type FileData = {
  mimeType?: string | undefined;
  size?: number | undefined;
  originalName: string;
  locationUrl: string;
  docId: string;
  hash?: string | undefined | null;
};

export async function documentUploaderHandler(
  sourceBucket: string,
  sourceKey: string,
  destinationBucket: string,
  region: string,
  apiServerURL: string
): Promise<void | { message: string; size: number }> {
  const s3Utils = new S3Utils(region);

  const s3FileNameParts = parseFilePath(sourceKey);
  if (!s3FileNameParts) {
    const message = "Failed to parse S3 file key";
    log(`${message} - sourceKey: ${sourceKey}`);
    throw new MetriportError(message, null, { sourceBucket, sourceKey });
  }
  const { cxId, patientId, fileId: docFilenameWithoutExtension } = s3FileNameParts;
  const { size, contentType } = await s3Utils.getFileInfoFromS3(sourceKey, sourceBucket);

  const docFilenameWithExtension = createDocumentFileName(docFilenameWithoutExtension, contentType);
  const destinationKey = createUploadFilePath(cxId, patientId, docFilenameWithExtension);
  const copySource = encodeURI(`${sourceBucket}/${sourceKey}`);
  const params = {
    CopySource: copySource,
    Bucket: destinationBucket,
    Key: destinationKey,
  };

  const metadataS3Key = getMetadataFilePathFromDocumentFilePath(destinationKey);

  // Make a copy of the file to the general medical documents bucket
  try {
    await executeWithRetries(() => s3Utils.s3.copyObject(params).promise(), {
      maxAttempts: 3,
      initialDelay: 500,
      log,
    });
    log(`Successfully copied the uploaded file to ${destinationBucket} with key ${destinationKey}`);
  } catch (error) {
    const message = "Error copying the uploaded file to medical documents bucket";
    log(`${message} - error ${errorToString(error)}`);
    throw new MetriportError(message, error, {
      copySource,
      destinationBucket,
      destinationKey,
      cxId,
      patientId,
    });
  }

  const hash = await computeS3ObjectSha1(s3Utils, destinationBucket, destinationKey);

  const fileData: FileData = {
    mimeType: contentType,
    size,
    originalName: destinationKey,
    locationUrl: s3Utils.buildFileUrl(destinationBucket, destinationKey),
    docId: docFilenameWithoutExtension,
    hash,
  };

  try {
    const docRef = await forwardCallToServer(cxId, apiServerURL, fileData);
    if (!contentType) {
      const message = "Failed to get the mime type of the uploaded file";
      log(`${message}: ${contentType}`);
      throw new MetriportError(message, null, { sourceKey, destinationKey, cxId, patientId });
    }
    if (!docRef) {
      const message = "Failed with the call to update the doc-ref of an uploaded file";
      log(`${message}: ${docRef}`);
    } else {
      await createAndUploadDocumentMetadataFile({
        s3Utils,
        cxId,
        patientId,
        documentS3Key: destinationKey,
        size,
        docRef,
        metadataS3Key,
        destinationBucket,
        mimeType: contentType,
        hash,
      });
    }
    if (size && size > MAXIMUM_UPLOAD_FILE_SIZE) {
      // #1207 TODO: Delete the file if it's too large and alert the customer.
      const message = `Uploaded file size exceeds the maximum allowed size`;
      log(`${message}: ${size}`);
      return { message, size };
    }
  } catch (error) {
    const message = "Failed with the call to update the doc-ref of an uploaded file";
    log(`${message} - error ${errorToString(error)}`);
    throw new MetriportError(message, error, { sourceKey, destinationKey, cxId, patientId });
  }
}

async function forwardCallToServer(
  cxId: string,
  apiServerURL: string,
  fileData: FileData
): Promise<DocumentReference | undefined> {
  const url = `${apiServerURL}?cxId=${cxId}`;
  const encodedUrl = encodeURI(url);

  const resp = await executeWithNetworkRetries(() => api.post(encodedUrl, fileData), { log });
  log(`Server response - status: ${resp.status}`);
  log(`Server response - body: ${JSON.stringify(resp.data)}`);
  return resp.data;
}
