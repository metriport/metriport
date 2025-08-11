import { UploadDocumentResult } from "@metriport/api-sdk";
import { createDocumentFilePath } from "@metriport/core/domain/document/filename";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { composeDocumentReference } from "../../../external/fhir/document/draft-update-document-reference";
import { upsertDocumentToFHIRServer } from "../../../external/fhir/document/save-document-reference";
import { Config } from "../../../shared/config";
import { getOrganizationOrFail } from "../organization/get-organization";
import {} from "../patient/update-hie-opt-out";

const region = Config.getAWSRegion();
const s3Utils = new S3Utils(region);

import { DocumentReference } from "@medplum/fhirtypes";
import { S3Utils } from "@metriport/core/external/aws/s3";

export async function getUploadUrlAndCreateDocRef({
  cxId,
  patientId,
  inputDocRef,
}: {
  cxId: string;
  patientId: string;
  inputDocRef: DocumentReference;
}): Promise<UploadDocumentResult> {
  const docRefId = uuidv7();
  const s3FileName = createDocumentFilePath(cxId, patientId, docRefId);
  const organization = await getOrganizationOrFail({ cxId });

  const docRef = composeDocumentReference({
    inputDocRef,
    organization,
    patientId,
    docRefId,
    s3Key: s3FileName,
    s3BucketName: Config.getMedicalDocumentsUploadBucketName(),
  });

  async function upsertOnFHIRServer() {
    // Make a temporary DocumentReference on the FHIR server.
    console.log("Creating a temporary DocumentReference on the FHIR server with ID:", docRef.id);
    await upsertDocumentToFHIRServer(cxId, docRef);
  }

  async function getPresignedUrl() {
    return s3Utils.getPresignedUploadUrl({
      bucket: Config.getMedicalDocumentsUploadBucketName(),
      key: s3FileName,
    });
  }

  const [, url] = await Promise.all([upsertOnFHIRServer(), getPresignedUrl()]);

  return { documentReferenceId: docRefId, uploadUrl: url };
}
