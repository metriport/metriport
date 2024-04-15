import { createExtrinsicObjectXml } from "../external/carequality/dq/create-metadata-xml";
import { createPatientUniqueId } from "../external/carequality/shared";
import { S3Utils } from "../external/aws/s3";
import { DocumentReference, Organization } from "@medplum/fhirtypes";
import { out } from "../util/log";

const { log } = out("Core Create and Upload Extrinsic Object");

export async function createAndUploadDocumentdMetadataFile({
  s3Utils,
  cxId,
  patientId,
  docId,
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

  const title = docRef?.description;
  const classCode = docRef?.type;
  const practiceSettingCode = docRef?.context?.practiceSetting;
  const healthcareFacilityTypeCode = docRef?.context?.facilityType;
  const organization: Organization | undefined = docRef?.contained?.find(
    (resource): resource is Organization => resource.resourceType === "Organization"
  );
  log(`Creating metadata file for docId: ${docId}`);
  const extrinsicObjectXml = createExtrinsicObjectXml({
    createdTime,
    size,
    patientId: uniquePatientId,
    organization,
    classCode,
    practiceSettingCode,
    healthcareFacilityTypeCode,
    documentUniqueId: docId,
    title,
    mimeType,
  });

  log(`Uploading metadata to S3 with key: ${metadataFileName}`);
  await s3Utils.uploadFile(destinationBucket, metadataFileName, Buffer.from(extrinsicObjectXml));
}

export async function createAndUploadCDAMetadataFile({
  s3Utils,
  cxId,
  patientId,
  docId,
  size,
  organization,
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
  organization: Organization;
  metadataFileName: string;
  destinationBucket: string;
  mimeType: string;
}): Promise<void> {
  const createdTime = new Date().toISOString();
  const uniquePatientId = createPatientUniqueId(cxId, patientId);
  log(`Creating metadata file for docId: ${docId}`);
  const extrinsicObjectXml = createExtrinsicObjectXml({
    createdTime,
    size,
    patientId: uniquePatientId,
    documentUniqueId: docId,
    organization,
    mimeType,
  });

  log(`Uploading metadata to S3 with key: ${metadataFileName}`);
  await s3Utils.uploadFile(destinationBucket, metadataFileName, Buffer.from(extrinsicObjectXml));
}
