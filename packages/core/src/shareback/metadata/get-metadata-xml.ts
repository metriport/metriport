import { ON_DEMAND_DOCUMENT_TYPE_UUID } from "@metriport/ihe-gateway-sdk";
import { RequestedDocumentType } from "@metriport/ihe-gateway-sdk/models/document-query/document-query-requests";
import {
  decodeDocumentId,
  errorToString,
  executeWithRetries,
  MetriportError,
} from "@metriport/shared";
import { createXMLParser } from "@metriport/shared/common/xml-parser";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { parseFilePath } from "../../domain/filename";
import { executeWithRetriesS3, S3Utils } from "../../external/aws/s3";
import { Config } from "../../util/config";
import { out } from "../../util/log";
import { XML_APP_MIME_TYPE } from "../../util/mime";
import { capture } from "../../util/notifications";
import { storeMappingAndEncodeDocumentId } from "../doc-id-mapping";
import { buildDocumentId } from "../document-id";
import {
  CCD_METADATA_SUFFIX,
  createSharebackFolderName,
  getFilePathFromDocumentId,
  isCcdDocumentPath,
  METADATA_SUFFIX,
} from "../file";
import { XDSDocumentEntryUniqueId } from "./constants";

dayjs.extend(duration);

const maxAttemptsToLoadDocuments = 8;
const initialTimeToWaitBetweenAttempts = dayjs.duration(100, "milliseconds");
const maxTimeToWaitBetweenAttempts = dayjs.duration(5, "seconds");

const region = Config.getAWSRegion();
const s3Utils = new S3Utils(region);
const bucket = Config.getMedicalDocumentsBucketName();

type FileKeyAndContent = { key: string; contents: string };

/**
 * Called as part of inbound DQ from all HIEs to get the metadata contents of the documents.
 * For ITI-based HIE like CQ and Ehex, the metadata is the actual response.
 * For CW, we convert it to a DocumentReference FHIR resource.
 */
export async function getMetadataDocumentContents(
  cxId: string,
  patientId: string,
  documentTypes: RequestedDocumentType[] = []
): Promise<string[]> {
  const { log } = out(`getMetadataDocumentContents - cxId ${cxId}, patientId ${patientId}`);
  const alreadyLoadedFiles: { key: string; contents: string }[] = [];
  const isLookingForOnDemandCcd = isLookingForOnDemandDocuments(documentTypes);

  await executeWithRetries(
    async () => {
      const filesOfIteration = await retrieveXmlContentsFromMetadataFilesOnS3(
        cxId,
        patientId,
        bucket,
        alreadyLoadedFiles,
        documentTypes
      );
      alreadyLoadedFiles.push(...filesOfIteration);
    },
    {
      shouldRetry: async (_, error) => {
        // We have this in place because of the way we create CCDs: we create an empty one and then
        // trigger the generation of the real one in the background/async. This async operation many
        // times is running when we try load it above, which doesn't find the file.
        if (isLookingForOnDemandCcd) {
          const isCcdAlreadyLoaded = alreadyLoadedFiles.some(item =>
            item.key.endsWith(CCD_METADATA_SUFFIX)
          );
          if (isCcdAlreadyLoaded) return false;
          return true;
        }
        return !!error;
      },
      initialDelay: initialTimeToWaitBetweenAttempts.asMilliseconds(),
      maxDelay: maxTimeToWaitBetweenAttempts.asMilliseconds(),
      maxAttempts: maxAttemptsToLoadDocuments,
      log,
    }
  );

  if (isLookingForOnDemandCcd && alreadyLoadedFiles.length < 1) {
    const msg = `Missing CCD metadata file for patient`;
    log(
      `${msg}, isLookingForOnDemandCcd: ${isLookingForOnDemandCcd}, alreadyLoadedFiles: ${alreadyLoadedFiles.length}`
    );
    capture.error(msg, { extra: { cxId, patientId } });
    throw new MetriportError(msg, undefined, { cxId, patientId });
  }

  const newFileContents = await replaceIdInDocWithShorterId({
    cxId,
    patientId,
    fileKeysAndContents: alreadyLoadedFiles,
  });
  return newFileContents;
}

async function retrieveXmlContentsFromMetadataFilesOnS3(
  cxId: string,
  patientId: string,
  bucketName: string,
  alreadyLoadedFiles: { key: string; contents: string }[],
  documentTypes: RequestedDocumentType[]
): Promise<{ key: string; contents: string }[]> {
  const { log } = out(
    `retrieveXmlContentsFromMetadataFilesOnS3 - cxId ${cxId}, patientId ${patientId}`
  );
  const errors: { s3Key: string; errorAsString: string }[] = [];

  const prefix = createSharebackFolderName({ cxId, patientId });

  const files = await executeWithRetriesS3(() => s3Utils.listObjectsV3(bucketName, prefix));
  const filesToLoadContents = files.filter(item => item.Key && item.Key.endsWith(METADATA_SUFFIX));
  const keysAndMetaContentsPromises = await Promise.allSettled(
    filesToLoadContents.map(async item => {
      const s3Key = item.Key;
      if (s3Key && !alreadyLoadedFiles.some(item => item.key === s3Key)) {
        try {
          const data = await executeWithRetriesS3(() =>
            s3Utils.getFileContentsAsString(bucketName, s3Key)
          );
          if (documentTypes.length < 1 || documentTypes.some(d => data.includes(d))) {
            return { key: s3Key, contents: data };
          }
          return undefined;
        } catch (error) {
          errors.push({ s3Key, errorAsString: errorToString(error) });
          throw error;
        }
      }
      return undefined;
    }) || []
  );
  const keysAndMetaContents = keysAndMetaContentsPromises
    .flatMap(p => (p.status === "fulfilled" ? p.value : []))
    .filter((item): item is { key: string; contents: string } => Boolean(item));

  if (errors.length > 0) {
    const msg = "Failed to load some metadata files";
    const details = errors.map(e => `${e.s3Key}: ${e.errorAsString}`).join("; ");
    log(`${msg}: ${details}`);
    capture.error(msg, { extra: { errors: details } });
  }

  return keysAndMetaContents;
}

async function replaceIdInDocWithShorterId({
  cxId,
  patientId,
  fileKeysAndContents,
}: {
  cxId: string;
  patientId: string;
  fileKeysAndContents: FileKeyAndContent[];
}): Promise<string[]> {
  const errors: { fileKey: string; error: unknown }[] = [];

  const results = await Promise.allSettled(
    fileKeysAndContents.map(fileKeyAndContent =>
      processSingleFileKeyAndContent({ cxId, patientId, fileKeyAndContent })
    )
  );

  const successfulResults: string[] = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      successfulResults.push(result.value.newContent);
    } else {
      errors.push({ fileKey: fileKeysAndContents[index]?.key ?? "unknown", error: result.reason });
    }
  });
  if (errors.length > 0) {
    const msg = "Failed to process some metadata files during ID replacement";
    const errorStrings = errors.map(e => errorToString(e.error));
    capture.error(msg, {
      extra: {
        totalFiles: fileKeysAndContents.length,
        failedCount: errors.length,
        successCount: successfulResults.length,
        errors: errorStrings,
      },
    });
  }
  return successfulResults;
}

async function processSingleFileKeyAndContent({
  cxId,
  patientId,
  fileKeyAndContent,
}: {
  cxId: string;
  patientId: string;
  fileKeyAndContent: FileKeyAndContent;
}): Promise<{ newContent: string }> {
  const { key: metadataS3Key, contents: metadataContents } = fileKeyAndContent;

  const parser = createXMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "_",
    textNodeName: "_text",
    parseAttributeValue: false,
    removeNSPrefix: true,
  });
  const jsonObj = parser.parse(metadataContents);
  const encodedDocumentId = getEncodedDocumentIdFromMetadataXml(jsonObj);
  if (!encodedDocumentId || typeof encodedDocumentId !== "string") {
    throw new MetriportError("Document ID not found in content", undefined, { metadataS3Key });
  }
  const decodedDocumentId = decodeDocumentId(encodedDocumentId);
  const documentIdInOldFormat = parseFilePath(decodedDocumentId);

  const isShortId = !documentIdInOldFormat;
  if (isShortId) return { newContent: metadataContents };

  const actualDocumentS3Key = await getFilePathFromDocumentId(decodedDocumentId);

  const isCcd = isCcdDocumentPath(actualDocumentS3Key);
  const shortDocumentId = buildDocumentId(cxId, patientId, isCcd);

  const encodedShortDocumentId = await storeMappingAndEncodeDocumentId({
    cxId,
    patientId,
    documentUuid: shortDocumentId,
    documentFullPath: actualDocumentS3Key,
  });

  const newMetadataContent = metadataContents.split(encodedDocumentId).join(encodedShortDocumentId);

  await s3Utils.uploadFile({
    bucket,
    key: metadataS3Key,
    file: Buffer.from(newMetadataContent),
    contentType: XML_APP_MIME_TYPE,
  });

  return { newContent: newMetadataContent };
}

/**
 * TODO Once we update the XML parser on parse-metadata-xml.ts to use createXMLParser() we can
 * move this there - where it should live, and update parseMetadataXmlToDocumentReference() to
 * use this function to get the document ID from the XML/json object.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getEncodedDocumentIdFromMetadataXml(jsonObj: any): string | undefined {
  const externalIdentifiers = jsonObj.ExtrinsicObject?.ExternalIdentifier;
  if (externalIdentifiers && Array.isArray(externalIdentifiers)) {
    const identifier = externalIdentifiers.find(
      (id: Record<string, unknown>) => id._identificationScheme === XDSDocumentEntryUniqueId
    );
    if (identifier && typeof identifier._value === "string") {
      return identifier._value;
    }
  }
  return undefined;
}

/**
 * Returns true if the document type represents an on-demand, CCD document.
 */
function isLookingForOnDemandDocuments(documentTypes: RequestedDocumentType[]): boolean {
  if (documentTypes.length < 1) return true;
  return documentTypes.includes(ON_DEMAND_DOCUMENT_TYPE_UUID);
}
