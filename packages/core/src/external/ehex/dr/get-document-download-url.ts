import { DocumentReference, InboundDocumentRetrievalReq } from "@metriport/ihe-gateway-sdk";
import {
  decodeDocumentId,
  errorToString,
  MetriportError,
  METRIPORT_HOME_COMMUNITY_ID,
  METRIPORT_REPOSITORY_UNIQUE_ID,
} from "@metriport/shared";
import { getFilePathFromDocumentId } from "../../../shareback/file";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import { S3Utils } from "../../aws/s3";
import { XDSRegistryError } from "../error";
import { validateBasePayload } from "../shared";

const region = Config.getAWSRegion();
const medicalDocumentsBucketName = Config.getMedicalDocumentsBucketName();

export async function buildDocumentReferences(
  payload: InboundDocumentRetrievalReq
): Promise<DocumentReference[]> {
  const { log } = out(`ehex.buildDocumentReferences`);
  validateBasePayload(payload);

  const [documentIds, uniqueIds] = extractDocumentIds(payload);
  if (documentIds.length === 0) {
    throw new XDSRegistryError("Valid Document ID is not defined");
  }

  // TODO ENG-1802 Remove this
  log(`documentIds: ${documentIds.join(", ")}`);
  log(`uniqueIds: ${uniqueIds.join(", ")}`);

  return await retrieveDocumentReferences(documentIds, uniqueIds);
}

function extractDocumentIds(payload: InboundDocumentRetrievalReq): [string[], string[]] {
  const documentIds: string[] = [];
  const uniqueIds: string[] = [];

  for (const documentReference of payload.documentReference) {
    uniqueIds.push(documentReference.docUniqueId);
    documentIds.push(decodeDocumentId(documentReference.docUniqueId));
  }
  return [documentIds, uniqueIds];
}

async function retrieveDocumentReferences(
  documentIds: string[],
  uniqueIds: string[]
): Promise<DocumentReference[]> {
  const { log } = out(`ehex.retrieveDocumentReferences`);
  const s3Utils = new S3Utils(region);
  const errors: unknown[] = [];
  const documentReferencesPromises = documentIds.map(async (id, index) => {
    try {
      const docFilePath = await getFilePathFromDocumentId(id);

      const fileInfo = await s3Utils.getFileInfoFromS3(docFilePath, medicalDocumentsBucketName);
      if (!fileInfo.exists) {
        // TODO ENG-1814: remove this log when we properly return not found documents
        log(`Document not found - id: ${id}, filePath: ${docFilePath}`);
        return undefined;
      }

      const { sizeInBytes, contentType } = fileInfo;
      const uniqueId = uniqueIds[index];
      if (!uniqueId) {
        const message = `Failed to retrieve uniqueId for document`;
        log(`${message}: ${docFilePath}`);
        const error = new MetriportError("Failed to retrieve Document", undefined, { docFilePath });
        throw error;
      }
      return {
        homeCommunityId: METRIPORT_HOME_COMMUNITY_ID,
        repositoryUniqueId: METRIPORT_REPOSITORY_UNIQUE_ID,
        docUniqueId: uniqueId,
        contentType: contentType,
        size: sizeInBytes,
        urn: docFilePath,
      };
    } catch (error: unknown) {
      log(`Error: ${errorToString(error)}`);
      errors.push(error);
      throw error;
    }
  });
  const documentReferences = await Promise.allSettled(documentReferencesPromises);
  const successfulDocRefs = documentReferences.flatMap(p =>
    p.status === "fulfilled" && p.value ? p.value : []
  );
  if (errors.length > 0) {
    capture.error("Ehex - DR - Failed to retrieve Documents", {
      extra: { errors: errors.map(e => errorToString(e)) },
    });
  }
  return successfulDocRefs;
}
