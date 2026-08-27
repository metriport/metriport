import { DocumentReference, Organization } from "@medplum/fhirtypes";
import { S3Utils } from "../external/aws/s3";
import { createPatientUniqueId } from "@metriport/shared";
import { isOrganization } from "../external/fhir/shared/index";
import { XML_APP_MIME_TYPE } from "../util/mime";
import { createMetadataXmlContents } from "./metadata/create-metadata-xml";

export async function createAndUploadDocumentMetadataFile({
  s3Utils,
  cxId,
  patientId,
  documentS3Key,
  size,
  docRef,
  organization,
  metadataS3Key,
  destinationBucket,
  mimeType,
  hash,
  isCcd = false,
}: {
  s3Utils: S3Utils;
  cxId: string;
  patientId: string;
  documentS3Key: string;
  size: number;
  docRef?: DocumentReference | undefined;
  organization?: Organization;
  metadataS3Key: string;
  destinationBucket: string;
  mimeType: string;
  hash: string;
  isCcd?: boolean | undefined;
}): Promise<void> {
  const createdTime = new Date().toISOString();
  const encodedPatientId = createPatientUniqueId(cxId, patientId);
  const title = docRef?.description;
  const classCode = docRef?.type;
  const practiceSettingCode = docRef?.context?.practiceSetting;
  const healthcareFacilityTypeCode = docRef?.context?.facilityType;
  const organizationFromDocRef = docRef?.contained?.find(isOrganization);
  const extrinsicObjectXml = await createMetadataXmlContents({
    createdTime,
    size: size.toString(),
    cxId,
    patientId,
    encodedPatientId: encodedPatientId,
    organization: organization ?? organizationFromDocRef,
    classCode,
    practiceSettingCode,
    healthcareFacilityTypeCode,
    documentS3Key,
    title,
    mimeType,
    hash,
    isCcd,
  });

  await s3Utils.uploadFile({
    bucket: destinationBucket,
    key: metadataS3Key,
    file: Buffer.from(extrinsicObjectXml),
    contentType: XML_APP_MIME_TYPE,
  });
}
