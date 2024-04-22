import { Organization } from "@medplum/fhirtypes";
import { errorToString } from "@metriport/shared";
import { createUploadFilePath, createUploadMetadataFilePath } from "../domain/document/upload";
import { MAXIMUM_UPLOAD_FILE_SIZE } from "../external/aws/lambda-logic/document-uploader";
import { S3Utils } from "../external/aws/s3";
import { MetriportError } from "../util/error/metriport-error";
import { out } from "../util/log";
import { capture } from "../util/notifications";
import { sizeInBytes } from "../util/string";
import { uuidv7 } from "../util/uuid-v7";
import { createAndUploadDocumentdMetadataFile } from "./create-and-upload-extrinsic-object";
const { log } = out(`Core CDA Uploader`);

export async function cdaDocumentUploaderHandler({
  cxId,
  patientId,
  cdaBundle,
  medicalDocumentsBucket,
  region,
  organization,
}: {
  cxId: string;
  patientId: string;
  cdaBundle: string;
  medicalDocumentsBucket: string;
  region: string;
  organization: Organization;
}): Promise<void | { message: string; size: number }> {
  checkFileSizeRestrictions(cdaBundle);

  const s3Utils = new S3Utils(region);
  const docId = uuidv7();
  const metadataFileName = createUploadMetadataFilePath(cxId, patientId, docId);
  const destinationKey = createUploadFilePath(cxId, patientId, docId);

  try {
    await s3Utils.uploadFile(
      medicalDocumentsBucket,
      `${destinationKey}.xml`,
      Buffer.from(cdaBundle)
    );
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
    const { size } = await s3Utils.getFileInfoFromS3(destinationKey, medicalDocumentsBucket);

    const stringSize = size ? size.toString() : "";
    await createAndUploadDocumentdMetadataFile({
      s3Utils,
      cxId,
      patientId,
      docId: destinationKey,
      size: stringSize,
      organization,
      metadataFileName,
      destinationBucket: medicalDocumentsBucket,
      mimeType: "application/xml",
    });
  } catch (error) {
    const msg = "Failed to create the metadata file of a CDA";
    log(`${msg} - error ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      medicalDocumentsBucket,
      destinationKey,
    });
  }
}

export function checkFileSizeRestrictions(cdaBundle: string): void {
  const fileSize = sizeInBytes(cdaBundle);
  if (fileSize > MAXIMUM_UPLOAD_FILE_SIZE) {
    const msg = `Uploaded file size exceeds the maximum allowed size of ${MAXIMUM_UPLOAD_FILE_SIZE} bytes`;
    log(`${msg} - error ${fileSize}`);
    const error = new Error(msg);
    capture.message(msg, { extra: { error }, level: "info" });
    throw error;
  }
}
