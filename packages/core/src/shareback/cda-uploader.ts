import { Organization } from "@medplum/fhirtypes";
import { errorToString } from "@metriport/shared";
import { createUploadFilePath, createUploadMetadataFilePath } from "../domain/document/upload";
import { MAXIMUM_UPLOAD_FILE_SIZE } from "../external/aws/lambda-logic/document-uploader";
import { S3Utils } from "../external/aws/s3";
import BadRequestError from "../util/error/bad-request";
import { MetriportError } from "../util/error/metriport-error";
import { out } from "../util/log";
import { XML_APP_MIME_TYPE } from "../util/mime";
import { capture } from "../util/notifications";
import { sizeInBytes } from "../util/string";
import { createAndUploadDocumentMetadataFile } from "./create-and-upload-extrinsic-object";

export async function cdaDocumentUploaderHandler({
  cxId,
  patientId,
  cdaBundle,
  medicalDocumentsBucket,
  region,
  organization,
  docId,
}: {
  cxId: string;
  patientId: string;
  cdaBundle: string;
  medicalDocumentsBucket: string;
  region: string;
  organization: Organization;
  docId: string;
}): Promise<void> {
  const { log } = out(`CDA Upload - cxId: ${cxId} - patientId: ${patientId}`);
  const fileSize = sizeInBytes(cdaBundle);
  checkFileSizeRestrictions(fileSize, log);

  const s3Utils = new S3Utils(region);
  const metadataFileName = createUploadMetadataFilePath(cxId, patientId, docId);
  const destinationKey = createUploadFilePath(cxId, patientId, `${docId}.xml`);

  try {
    await s3Utils.uploadFile({
      bucket: medicalDocumentsBucket,
      key: destinationKey,
      file: Buffer.from(cdaBundle),
    });
    log(`Successfully uploaded the file to ${medicalDocumentsBucket} with key ${destinationKey}`);
  } catch (error) {
    const msg = "Error uploading file to medical documents bucket";
    log(`${msg}: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      medicalDocumentsBucket,
      destinationKey,
    });
  }

  try {
    await createAndUploadDocumentMetadataFile({
      s3Utils,
      cxId,
      patientId,
      docId: destinationKey,
      size: fileSize,
      organization,
      metadataFileName,
      destinationBucket: medicalDocumentsBucket,
      mimeType: XML_APP_MIME_TYPE,
    });
    log(`Successfully uploaded the metadata file`);
  } catch (error) {
    const msg = "Failed to create the metadata file of a CDA";
    log(`${msg} - error ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      medicalDocumentsBucket,
      destinationKey,
    });
  }
}

function checkFileSizeRestrictions(fileSize: number, log: typeof console.log): void {
  if (fileSize > MAXIMUM_UPLOAD_FILE_SIZE) {
    const msg = `Uploaded file size exceeds the maximum allowed size of ${MAXIMUM_UPLOAD_FILE_SIZE} bytes`;
    log(`${msg} - error ${fileSize}`);
    const error = new BadRequestError(msg);
    capture.message(msg, { extra: { error }, level: "info" });
    throw error;
  }
}
