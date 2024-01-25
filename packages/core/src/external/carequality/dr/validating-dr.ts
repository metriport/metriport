import { DocumentRetrievalReqFromExternalGW, DocumentReference } from "@metriport/ihe-gateway-sdk";
import {
  METRIPORT_HOME_COMMUNITY_ID,
  METRIPORT_REPOSITORY_UNIQUE_ID,
  validateBasePayload,
  extractDocumentUniqueId,
} from "../shared";
import { S3Utils } from "../../aws/s3";
import { Config } from "../../../util/config";
import { XDSRegistryError } from "../error";

const region = Config.getAWSRegion();
const medicalDocumentsBucketName = Config.getMedicalDocumentsBucketName();

export async function validateDR(
  payload: DocumentRetrievalReqFromExternalGW
): Promise<DocumentReference[]> {
  validateBasePayload(payload);

  const documentIds = extractDocumentIds(payload);
  if (documentIds.length === 0) {
    throw new XDSRegistryError("Valid Dcument ID is not defined");
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

function extractDocumentIds(payload: DocumentRetrievalReqFromExternalGW): string[] {
  const documentIds: string[] = [];

  for (const documentReference of payload.documentReference) {
    documentIds.push(extractDocumentUniqueId(documentReference.docUniqueId));
  }
  return documentIds;
}
