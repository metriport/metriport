import { DocumentReference, Organization } from "@medplum/fhirtypes";
import { S3Utils } from "../external/aws/s3";
import { createPatientUniqueId } from "../external/carequality/shared";
import { isOrganization } from "../external/fhir/shared";
import { out } from "../util/log";
import { XML_APP_MIME_TYPE } from "../util/mime";
import { createExtrinsicObjectXml } from "./metadata/create-metadata-xml";

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
  size: number;
  docRef?: DocumentReference | undefined;
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
  const organizationFromDocRef = docRef?.contained?.find(isOrganization);
  const extrinsicObjectXml = createExtrinsicObjectXml({
    createdTime,
    size: size.toString(),
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
    content: Buffer.from(extrinsicObjectXml),
    contentType: XML_APP_MIME_TYPE,
  });
}
