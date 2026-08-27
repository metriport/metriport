import { createFileName, createFolderName, parseFilePath } from "../domain/filename";
import { out } from "../util";
import { getFileExtension, XML_FILE_EXTENSION } from "../util/mime";
import { getDocumentS3KeyFromDocIdOrFail } from "./doc-id-mapping";

export const UPLOADS_FOLDER = "uploads";
export const CCD_SUFFIX = "ccd";
export const CCD_DOCUMENT_NAME = `${CCD_SUFFIX}.${XML_FILE_EXTENSION}`;
export const METADATA_SUFFIX = `_metadata.${XML_FILE_EXTENSION}`;
export const CCD_METADATA_SUFFIX = `${CCD_SUFFIX}${METADATA_SUFFIX}`;
export const FHIR_BUNDLE_SUFFIX = "FHIR_BUNDLE";
export const sentToFhirServerPrefix = "toFhirServer";

export function createSharebackFolderName({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}) {
  const folderName = createFolderName(cxId, patientId);
  const prefix = `${folderName}/${UPLOADS_FOLDER}`;
  return prefix;
}

export function isInUploadFolder(filePath: string): boolean {
  return filePath.includes(`/${UPLOADS_FOLDER}/`);
}

export function createUploadFilePath(cxId: string, patientId: string, docName: string): string {
  const sharebackFolderName = createSharebackFolderName({ cxId, patientId });
  const fileName = createFileName(cxId, patientId, docName);
  return `${sharebackFolderName}/${fileName}`;
}

export function getMetadataFilePathFromDocumentFilePath(documentFilePath: string): string {
  const lastDotIndex = documentFilePath.lastIndexOf(".");
  const documentPathWithoutExtension =
    lastDotIndex > -1 ? documentFilePath.slice(0, lastDotIndex) : documentFilePath;
  return `${documentPathWithoutExtension}${METADATA_SUFFIX}`;
}

export function isCcdDocumentPath(path: string): boolean {
  return path.endsWith(CCD_DOCUMENT_NAME);
}
export function createCcdDocumentPath({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): string {
  return createUploadFilePath(cxId, patientId, CCD_DOCUMENT_NAME);
}

export function createCcdaDocumentPath({
  cxId,
  patientId,
  docId,
}: {
  cxId: string;
  patientId: string;
  docId: string;
}): string {
  return createUploadFilePath(cxId, patientId, `${docId}.${XML_FILE_EXTENSION}`);
}

export function createAttachmentUploadFilePath({
  filePath,
  attachmentId,
  mimeType,
}: {
  filePath: string;
  attachmentId: string;
  mimeType: string | undefined;
}): string {
  const extension = getFileExtension(mimeType);
  const finalExtension = extension === "" ? ".unknown" : extension;
  return `${filePath}_${attachmentId}${finalExtension}`;
}

/**
 * Rebuilds the full s3 prefix from the document ID, be it in legacy format or new short ID format.
 *
 * @param id document ID, in one of the following formats:
 * - legacy, full s3 prefix: <cxId>/<patientId>/uploads/<cxId>_<patientId>_<fileId>.<extension>
 * - legacy ID: <cxId>_<patientId>_<fileId>.<extension>
 * - new short ID: <documentUuid>
 * @returns the full s3 prefix: <cxId>/<patientId>/uploads/<cxId>_<patientId>_<fileId>.<extension>
 */
export async function getFilePathFromDocumentId(id: string): Promise<string> {
  // TODO ENG-1802: remove this
  const { log } = out(`getFilePathFromDocumentId`);
  log(`ID: ${id}`);

  if (isInUploadFolder(id)) {
    log(`Old format, already a full s3 prefix: ${id}`);
    return id;
  }

  const documentIdInOldFormat = parseFilePath(id);
  if (documentIdInOldFormat) {
    const { cxId, patientId, fileId } = documentIdInOldFormat;
    const fullS3Prefix = createUploadFilePath(cxId, patientId, fileId);
    log(`Old format, result of bulding it: ${fullS3Prefix}`);
    return fullS3Prefix;
  }

  const fullS3Prefix = await getDocumentS3KeyFromDocIdOrFail(id);
  log(`New format, result of mapping: ${fullS3Prefix}`);
  return fullS3Prefix;
}
