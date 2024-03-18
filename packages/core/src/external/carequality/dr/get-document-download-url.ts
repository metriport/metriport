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

  const [documentIds, uniqueIds] = extractDocumentIds(payload);
  if (documentIds.length === 0) {
    throw new XDSRegistryError("Valid Document ID is not defined");
  }

  return await retrieveDocumentReferences(documentIds, uniqueIds);
}

async function retrieveDocumentReferences(
  documentIds: string[],
  uniqueIds: string[]
): Promise<DocumentReference[]> {
  const s3Utils = new S3Utils(region);
  const documentReferencesPromises = documentIds.map(async (id, index) => {
    const { size, contentType } = await s3Utils.getFileInfoFromS3(id, medicalDocumentsBucketName);
    const uniqueId = uniqueIds[index];
    if (!uniqueId) {
      const message = `Failed to retrieve uniqueId for document`;
      console.log(`${message}: ${id}`);
      throw new XDSRegistryError("Failed to retrieve Document");
    }
    return {
      homeCommunityId: METRIPORT_HOME_COMMUNITY_ID,
      repositoryUniqueId: METRIPORT_REPOSITORY_UNIQUE_ID,
      docUniqueId: uniqueId,
      contentType: contentType,
      size: size,
      urn: id,
    };
  });
  const documentReferences = await Promise.allSettled(documentReferencesPromises);
  const successfulDocRefs = documentReferences.flatMap(p =>
    p.status === "fulfilled" ? p.value : []
  );
  return successfulDocRefs;
}

function extractDocumentIds(payload: InboundDocumentRetrievalReq): [string[], string[]] {
  const documentIds: string[] = [];
  const uniqueIds: string[] = [];

  for (const documentReference of payload.documentReference) {
    uniqueIds.push(documentReference.docUniqueId);
    documentIds.push(extractDocumentUniqueId(documentReference.docUniqueId));
  }
  return [documentIds, uniqueIds];
}
