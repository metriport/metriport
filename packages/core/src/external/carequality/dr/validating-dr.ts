import { DocumentRetrievalRequestIncoming, DocumentReference } from "@metriport/ihe-gateway-sdk";
import { METRIPORT_HOME_COMMUNITY_ID, METRIPORT_REPOSITORY_UNIQUE_ID } from "../shared";
import { S3Utils } from "../../aws/s3";
import { Config } from "../../../util/config";
import { XDSMissingHomeCommunityId, XDSRegistryError, XDSUnknownDocumentId } from "../error";

const region = Config.getAWSRegion();
const medicalDocumentsBucketName = Config.getMedicalDocumentsBucketName();

export async function validateDR(
  payload: DocumentRetrievalRequestIncoming
): Promise<DocumentReference[]> {
  if (!payload.id) {
    throw new XDSRegistryError("Request id is not defined");
  }

  if (!payload.timestamp) {
    throw new XDSRegistryError("Timestamp is not defined");
  }

  if (!payload.samlAttributes.homeCommunityId) {
    throw new XDSMissingHomeCommunityId("Home Community ID is not defined");
  }

  const documentIds = extractDocumentIds(payload);
  if (documentIds.length === 0) {
    throw new XDSUnknownDocumentId("Valid Dcument ID is not defined");
  }

  return await retrievePreSignedUrls(documentIds);
}

async function retrievePreSignedUrls(documentIds: string[]): Promise<DocumentReference[]> {
  const s3Utils = new S3Utils(region);
  const documentReferences: DocumentReference[] = [];

  for (const id of documentIds) {
    const url = await s3Utils.getSignedUrl({
      bucketName: medicalDocumentsBucketName,
      fileName: id,
    });
    const documentReference: DocumentReference = {
      homeCommunityId: METRIPORT_HOME_COMMUNITY_ID,
      repositoryUniqueId: METRIPORT_REPOSITORY_UNIQUE_ID,
      docUniqueId: id,
      urn: url,
    };
    documentReferences.push(documentReference);
  }

  return documentReferences;
}

function extractDocumentIds(payload: DocumentRetrievalRequestIncoming): string[] {
  const documentIds: string[] = [];

  for (const documentReference of payload.documentReference) {
    documentIds.push(documentReference.docUniqueId);
  }
  return documentIds;
}
