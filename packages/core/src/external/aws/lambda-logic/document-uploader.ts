import { DocumentReference } from "@medplum/fhirtypes";
import { errorToString } from "@metriport/shared";
import axios from "axios";
import { createDocumentFileName } from "../../../domain/document/filename";
import {
  createUploadFilePath,
  createUploadMetadataFilePath,
} from "../../../domain/document/upload";
import { parseFilePath } from "../../../domain/filename";
import { createAndUploadDocumentMetadataFile } from "../../../shareback/create-and-upload-extrinsic-object";
import { MetriportError } from "../../../util/error/metriport-error";
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
  const { cxId, patientId, fileId: docId } = s3FileNameParts;
  const { size, contentType } = await s3Utils.getFileInfoFromS3(sourceKey, sourceBucket);

  const docName = createDocumentFileName(docId, contentType);
  const metadataFileName = createUploadMetadataFilePath(cxId, patientId, docId);

  const destinationKey = createUploadFilePath(cxId, patientId, docName);
  const copySource = encodeURI(`${sourceBucket}/${sourceKey}`);
  const params = {
    CopySource: copySource,
    Bucket: destinationBucket,
    Key: destinationKey,
  };

  // Make a copy of the file to the general medical documents bucket
  try {
    await s3Utils.s3.copyObject(params).promise();
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

  const fileData: FileData = {
    mimeType: contentType,
    size,
    originalName: destinationKey,
    locationUrl: s3Utils.buildFileUrl(destinationBucket, destinationKey),
    docId,
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
        docId: destinationKey,
        size,
        docRef,
        metadataFileName,
        destinationBucket,
        mimeType: contentType,
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

  const resp = await api.post(encodedUrl, fileData);
  log(`Server response - status: ${resp.status}`);
  log(`Server response - body: ${JSON.stringify(resp.data)}`);
  return resp.data;
}
