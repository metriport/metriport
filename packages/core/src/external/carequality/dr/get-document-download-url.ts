import { InboundDocumentRetrievalReq, DocumentReference } from "@metriport/ihe-gateway-sdk";
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

export async function buildDocumentReferences(
  payload: InboundDocumentRetrievalReq
): Promise<DocumentReference[]> {
  validateBasePayload(payload);

  const documentIds = extractDocumentIds(payload);
  if (documentIds.length === 0) {
    throw new XDSRegistryError("Valid Document ID is not defined");
  }

  return await retrieveDocumentReferences(documentIds);
}

async function retrieveDocumentReferences(documentIds: string[]): Promise<DocumentReference[]> {
  const s3Utils = new S3Utils(region);
  const documentReferences: DocumentReference[] = [];

  // TODO consider making this more robust, so if one fails we still return the rest
  for (const id of documentIds) {
    const { size, contentType, eTag } = await s3Utils.getFileInfoFromS3(
      id,
      medicalDocumentsBucketName
    );
    if (!eTag) {
      const message = `Failed to retrieve ETag for document`;
      console.log(`${message}: ${id}`);
      throw new XDSRegistryError("Document Hash is not defined");
    }
    const documentReference: DocumentReference = {
      homeCommunityId: METRIPORT_HOME_COMMUNITY_ID,
      repositoryUniqueId: METRIPORT_REPOSITORY_UNIQUE_ID,
      docUniqueId: eTag,
      contentType: contentType,
      size: size,
      urn: id,
    };
    documentReferences.push(documentReference);
  }

  return documentReferences;
}

function extractDocumentIds(payload: InboundDocumentRetrievalReq): string[] {
  const documentIds: string[] = [];

  for (const documentReference of payload.documentReference) {
    documentIds.push(extractDocumentUniqueId(documentReference.docUniqueId));
  }
  return documentIds;
}
