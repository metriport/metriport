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

export async function validateDRAndRetrievePresignedUrls(
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

  const promises = documentIds.map(id =>
    s3Utils
      .getSignedUrl({
        bucketName: medicalDocumentsBucketName,
        fileName: id,
      })
      .then(url => ({
        homeCommunityId: METRIPORT_HOME_COMMUNITY_ID,
        repositoryUniqueId: METRIPORT_REPOSITORY_UNIQUE_ID,
        docUniqueId: id,
        urn: url,
      }))
  );

  const results = await Promise.allSettled(promises);

  const documentReferences = results
    .filter(result => result.status === "fulfilled")
    .map(result => (result as PromiseFulfilledResult<DocumentReference>).value);

  return documentReferences;
}

function extractDocumentIds(payload: DocumentRetrievalReqFromExternalGW): string[] {
  const documentIds: string[] = [];

  for (const documentReference of payload.documentReference) {
    documentIds.push(extractDocumentUniqueId(documentReference.docUniqueId));
  }
  return documentIds;
}
