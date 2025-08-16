import { DocumentReference } from "@medplum/fhirtypes";
import { UploadDocumentResult } from "@metriport/api-sdk";
import { createDocumentFilePath } from "@metriport/core/domain/document/filename";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { composeDocumentReference } from "../../../external/fhir/document/draft-update-document-reference";
import { upsertDocumentToFHIRServer } from "../../../external/fhir/document/save-document-reference";
import { Config } from "../../../shared/config";
import { getOrganizationOrFail } from "../organization/get-organization";

const region = Config.getAWSRegion();
const s3Utils = new S3Utils(region);

export async function getUploadUrlAndCreateDocRef({
  cxId,
  patientId,
  docRefDraft,
}: {
  cxId: string;
  patientId: string;
  docRefDraft: DocumentReference;
}): Promise<UploadDocumentResult> {
  const medicalDocumentsUploadBucketName = Config.getMedicalDocumentsUploadBucketName();
  const docRefId = uuidv7();
  const s3FileName = createDocumentFilePath(cxId, patientId, docRefId);
  const organization = await getOrganizationOrFail({ cxId });

  const docRef = composeDocumentReference({
    inputDocRef: docRefDraft,
    organization,
    patientId,
    docRefId,
    s3Key: s3FileName,
    s3BucketName: medicalDocumentsUploadBucketName,
  });

  async function upsertOnFHIRServer() {
    // Make a temporary DocumentReference on the FHIR server.
    console.log("Creating a temporary DocumentReference on the FHIR server with ID:", docRef.id);
    await upsertDocumentToFHIRServer(cxId, docRef);
  }

  async function getPresignedUrl() {
    return s3Utils.getPresignedUploadUrl({
      bucket: medicalDocumentsUploadBucketName,
      key: s3FileName,
    });
  }

  const [, url] = await Promise.all([upsertOnFHIRServer(), getPresignedUrl()]);

  return { documentReferenceId: docRefId, uploadUrl: url };
}
