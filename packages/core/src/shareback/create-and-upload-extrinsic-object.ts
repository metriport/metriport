import { DocumentReference, Organization } from "@medplum/fhirtypes";
import { S3Utils } from "../external/aws/s3";
import { createExtrinsicObjectXml } from "../external/carequality/dq/create-metadata-xml";
import { createPatientUniqueId } from "../external/carequality/shared";
import { isOrganization } from "../external/fhir/shared";
import { out } from "../util/log";

const { log } = out("Core Create and Upload Extrinsic Object");

export async function createAndUploadDocumentMetadataFile({
  s3Utils,
  cxId,
  patientId,
  docId,
  size,
  docRef,
  organization,
  metadataFileName,
  destinationBucket,
  mimeType,
}: {
  s3Utils: S3Utils;
  cxId: string;
  patientId: string;
  docId: string;
  size: string;
  docRef?: DocumentReference;
  organization?: Organization;
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
  const organizationFromDocRef: Organization | undefined = docRef?.contained?.find(
    (resource): resource is Organization => isOrganization(resource)
  );
  const extrinsicObjectXml = createExtrinsicObjectXml({
    createdTime,
    size,
    patientId: uniquePatientId,
    organization: organization ?? organizationFromDocRef,
    classCode,
    practiceSettingCode,
    healthcareFacilityTypeCode,
    documentUniqueId: docId,
    title,
    mimeType,
  });

  log(`Uploading metadata to S3 with key: ${metadataFileName}`);
  await s3Utils.uploadFile({
    bucket: destinationBucket,
    key: metadataFileName,
    file: Buffer.from(extrinsicObjectXml),
  });
}
