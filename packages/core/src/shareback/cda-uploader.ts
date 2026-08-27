import { DocumentReference, Organization } from "@medplum/fhirtypes";
import { errorToString, MetriportError } from "@metriport/shared";
import { S3Utils } from "../external/aws/s3";
import {
  createCcdaDocumentPath,
  createCcdDocumentPath,
  getMetadataFilePathFromDocumentFilePath,
} from "../shareback/file";
import { createDocumentHash } from "../util/hash";
import { out } from "../util/log";
import { XML_APP_MIME_TYPE } from "../util/mime";
import { sizeInBytes } from "../util/string";
import { createAndUploadDocumentMetadataFile } from "./create-and-upload-metadata";

type CdaDocumentUploaderParamsBase = {
  cxId: string;
  patientId: string;
  bundle: string;
  medicalDocumentsBucket: string;
  region: string;
  organization: Organization;
  docRef?: DocumentReference;
};
export type CdaDocumentUploaderParams = CdaDocumentUploaderParamsBase &
  (
    | {
        docId: string;
        isCcd?: false;
      }
    | {
        docId?: never;
        isCcd: true;
      }
  );

export async function cdaDocumentUploaderHandler({
  cxId,
  patientId,
  bundle,
  medicalDocumentsBucket,
  region,
  organization,
  docId,
  docRef,
  isCcd,
}: CdaDocumentUploaderParams): Promise<{ filePath: string; metadataFilePath: string }> {
  const { log } = out(`CDA Upload - cxId: ${cxId} - patientId: ${patientId}`);
  const fileSize = sizeInBytes(bundle);
  const s3Utils = new S3Utils(region);
  const destinationKey = isCcd
    ? createCcdDocumentPath({ cxId, patientId })
    : createCcdaDocumentPath({ cxId, patientId, docId });
  const bundleBuffer = Buffer.from(bundle);
  const hash = createDocumentHash(bundleBuffer);

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

  const metadataS3Key = getMetadataFilePathFromDocumentFilePath(destinationKey);
  try {
    await createAndUploadDocumentMetadataFile({
      s3Utils,
      cxId,
      patientId,
      documentS3Key: destinationKey,
      size: fileSize,
      organization,
      metadataS3Key,
      destinationBucket: medicalDocumentsBucket,
      mimeType: XML_APP_MIME_TYPE,
      docRef,
      hash,
      isCcd,
    });
  } catch (error) {
    const msg = "Failed to create the shareback metadata file of a CDA";
    log(`${msg} - error ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      medicalDocumentsBucket,
      destinationKeyOfCdaFile: destinationKey,
      metadataS3Key,
    });
  }

  return {
    filePath: destinationKey,
    metadataFilePath: metadataS3Key,
  };
}
