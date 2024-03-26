import { createExtrinsicObjectXml } from "../external/carequality/dq/create-metadata-xml";
import {
  createPatientUniqueId,
  METRIPORT_HOME_COMMUNITY_ID,
  METRIPORT_REPOSITORY_UNIQUE_ID,
} from "../external/carequality/shared";
import { S3Utils } from "../external/aws/s3";
import { DocumentReference } from "@medplum/fhirtypes";

export async function createAndUploadMetadataFile({
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
  docRef: DocumentReference | undefined;
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
