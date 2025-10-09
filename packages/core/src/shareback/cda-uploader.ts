import { DocumentReference, Organization } from "@medplum/fhirtypes";
import { errorToString } from "@metriport/shared";
import { createUploadFilePath, createUploadMetadataFilePath } from "../shareback/file";
import { S3Utils } from "../external/aws/s3";
import { MetriportError } from "../util/error/metriport-error";
import { out } from "../util/log";
import { XML_APP_MIME_TYPE } from "../util/mime";
import { sizeInBytes } from "../util/string";
import { createAndUploadDocumentMetadataFile } from "./create-and-upload-extrinsic-object";

export async function cdaDocumentUploaderHandler({
  cxId,
  patientId,
  bundle,
  medicalDocumentsBucket,
  region,
  organization,
  docId,
  docRef,
}: {
  cxId: string;
  patientId: string;
  bundle: string;
  medicalDocumentsBucket: string;
  region: string;
  organization: Organization;
  docId: string;
  docRef?: DocumentReference;
}): Promise<{ filePath: string; metadataFilePath: string }> {
  const { log } = out(`CDA Upload - cxId: ${cxId} - patientId: ${patientId}`);
  const fileSize = sizeInBytes(bundle);
  const s3Utils = new S3Utils(region);
  const destinationKey = createUploadFilePath(cxId, patientId, `${docId}.xml`);

  try {
    await s3Utils.uploadFile({
      bucket: medicalDocumentsBucket,
      key: destinationKey,
      file: Buffer.from(bundle),
      contentType: XML_APP_MIME_TYPE,
    });
  } catch (error) {
    const msg = "Error uploading shareback CDA file to S3";
    log(`${msg}: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      medicalDocumentsBucket,
      destinationKey,
    });
  }

  const metadataFileName = createUploadMetadataFilePath(cxId, patientId, docId);
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
      docRef,
    });
  } catch (error) {
    const msg = "Failed to create the shareback metadata file of a CDA";
    log(`${msg} - error ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      medicalDocumentsBucket,
      destinationKeyOfCdaFile: destinationKey,
    });
  }

  return {
    filePath: destinationKey,
    metadataFilePath: metadataFileName,
  };
}
