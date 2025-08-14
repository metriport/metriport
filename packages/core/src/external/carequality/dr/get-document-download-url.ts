import { DocumentReference, InboundDocumentRetrievalReq } from "@metriport/ihe-gateway-sdk";
import { createUploadFilePath } from "../../../domain/document/upload";
import { parseFileName } from "../../../domain/filename";
import { Config } from "../../../util/config";
import { S3Utils } from "../../aws/s3";
import { XDSRegistryError } from "../error";
import {
  extractDocumentUniqueId,
  METRIPORT_HOME_COMMUNITY_ID,
  METRIPORT_REPOSITORY_UNIQUE_ID,
  validateBasePayload,
} from "../shared";

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

function extractDocumentIds(payload: InboundDocumentRetrievalReq): [string[], string[]] {
  const documentIds: string[] = [];
  const uniqueIds: string[] = [];

  for (const documentReference of payload.documentReference) {
    uniqueIds.push(documentReference.docUniqueId);
    documentIds.push(extractDocumentUniqueId(documentReference.docUniqueId));
  }
  return [documentIds, uniqueIds];
}

async function retrieveDocumentReferences(
  documentIds: string[],
  uniqueIds: string[]
): Promise<DocumentReference[]> {
  const s3Utils = new S3Utils(region);
  const documentReferencesPromises = documentIds.map(async (id, index) => {
    const docFilePath = rebuildUploadsFilePath(id);

    const { size, contentType } = await s3Utils.getFileInfoFromS3(
      docFilePath,
      medicalDocumentsBucketName
    );
    const uniqueId = uniqueIds[index];
    if (!uniqueId) {
      const message = `Failed to retrieve uniqueId for document`;
      console.log(`${message}: ${docFilePath}`);
      throw new XDSRegistryError("Failed to retrieve Document");
    }
    return {
      homeCommunityId: METRIPORT_HOME_COMMUNITY_ID,
      repositoryUniqueId: METRIPORT_REPOSITORY_UNIQUE_ID,
      docUniqueId: uniqueId,
      contentType: contentType,
      size: size,
      urn: docFilePath,
    };
  });
  const documentReferences = await Promise.allSettled(documentReferencesPromises);
  const successfulDocRefs = documentReferences.flatMap(p =>
    p.status === "fulfilled" ? p.value : []
  );
  return successfulDocRefs;
}

function rebuildUploadsFilePath(id: string): string {
  if (id.includes("/")) return id;

  const fileNameParts = parseFileName(id);
  if (!fileNameParts) return id;

  return createUploadFilePath(fileNameParts.cxId, fileNameParts.patientId, fileNameParts.fileId);
}
