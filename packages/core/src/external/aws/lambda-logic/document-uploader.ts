import { DocumentReference } from "@medplum/fhirtypes";
import axios from "axios";
import { createDocumentFileName } from "../../../domain/document/filename";
import {
  createUploadFilePath,
  createUploadMetadataFilePath,
} from "../../../domain/document/upload";
import { parseFilePath } from "../../../domain/filename";
import { MetriportError } from "../../../util/error/metriport-error";
import { createExtrinsicObjectXml } from "../../carequality/dq/create-metadata-xml";
import {
  createPatientUniqueId,
  METRIPORT_HOME_COMMUNITY_ID,
  METRIPORT_REPOSITORY_UNIQUE_ID,
} from "../../carequality/shared";
import { S3Utils } from "../s3";

const api = axios.create();

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

  const s3FileNameParts = parseFilePath(sourceKey);
  if (!s3FileNameParts) {
    const message = "Failed to parse S3 file key";
    console.log(`${message} - sourceKey: ${sourceKey}`);
    throw new MetriportError(message, null, { sourceBucket, sourceKey });
  }
  const { cxId, patientId, fileId: docId } = s3FileNameParts;
  const { size, contentType, eTag } = await s3Utils.getFileInfoFromS3(sourceKey, sourceBucket);

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
    console.log(
      `Successfully copied the uploaded file to ${destinationBucket} with key ${destinationKey}`
    );
  } catch (error) {
    const message = "Error copying the uploaded file to medical documents bucket";
    console.log(`${message}: ${error}`);
    throw new MetriportError(message, error, { copySource, destinationBucket, destinationKey });
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
    const stringSize = size ? size.toString() : "";
    const hash = eTag ? eTag : "";
    if (!contentType) {
      const message = "Failed to get the mime type of the uploaded file";
      console.log(`${message}: ${contentType}`);
      throw new MetriportError(message, null, { sourceKey, destinationKey });
    }
    if (!docRef) {
      const message = "Failed with the call to update the doc-ref of an uploaded file";
      console.log(`${message}: ${docRef}`);
    } else {
      await createAndUploadMetadataFile({
        s3Utils,
        cxId,
        patientId,
        docId: destinationKey,
        hash,
        size: stringSize,
        docRef,
        metadataFileName,
        destinationBucket,
        mimeType: contentType,
      });
    }
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

async function forwardCallToServer(
  cxId: string,
  apiServerURL: string,
  fileData: FileData
): Promise<DocumentReference | undefined> {
  const url = `${apiServerURL}?cxId=${cxId}`;
  const encodedUrl = encodeURI(url);

  const resp = await api.post(encodedUrl, fileData);
  console.log(`Server response - status: ${resp.status}`);
  console.log(`Server response - body: ${JSON.stringify(resp.data)}`);
  return resp.data;
}

async function createAndUploadMetadataFile({
  s3Utils,
  cxId,
  patientId,
  docId,
  hash,
  size,
  docRef,
  metadataFileName,
  destinationBucket,
  mimeType,
}: {
  s3Utils: S3Utils;
  cxId: string;
  patientId: string;
  docId: string;
  hash: string;
  size: string;
  docRef: DocumentReference;
  metadataFileName: string;
  destinationBucket: string;
  mimeType: string;
}): Promise<void> {
  const createdTime = new Date().toISOString();
  const uniquePatientId = createPatientUniqueId(cxId, patientId);
  const title = docRef.description;
  const classCode = docRef.type;
  const practiceSettingCode = docRef.context?.practiceSetting;
  const healthcareFacilityTypeCode = docRef.context?.facilityType;
  console.log(`Creating metadata file for docId: ${docId}`);
  const extrinsicObjectXml = createExtrinsicObjectXml({
    createdTime,
    hash,
    repositoryUniqueId: METRIPORT_REPOSITORY_UNIQUE_ID,
    homeCommunityId: METRIPORT_HOME_COMMUNITY_ID,
    size,
    patientId: uniquePatientId,
    classCode,
    practiceSettingCode,
    healthcareFacilityTypeCode,
    documentUniqueId: docId,
    title,
    mimeType,
  });

  console.log(`Uploading metadata to S3 with key: ${metadataFileName}`);
  await s3Utils.uploadFile(destinationBucket, metadataFileName, Buffer.from(extrinsicObjectXml));
}
