import { getFileExtension } from "../../util/mime";
import { createFileName, createFolderName, parseFileName } from "../filename";

export const UPLOADS_FOLDER = "uploads";
export const CCD_SUFFIX = "ccd";
export const FHIR_BUNDLE_SUFFIX = "FHIR_BUNDLE";

export function createUploadFilePath(cxId: string, patientId: string, docName: string): string {
  const folderName = createFolderName(cxId, patientId);
  const fileName = createFileName(cxId, patientId, docName);
  return `${folderName}/${UPLOADS_FOLDER}/${fileName}`;
}

export function createUploadMetadataFilePath(
  cxId: string,
  patientId: string,
  docName: string
): string {
  const uploadFilePath = createUploadFilePath(cxId, patientId, docName);
  return `${uploadFilePath}_metadata.xml`;
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

export function rebuildUploadsFilePath(id: string): string {
  if (id.includes(`/${UPLOADS_FOLDER}/`)) return id;

  const fileNameParts = parseFileName(id);
  if (!fileNameParts) return id;

  return createUploadFilePath(fileNameParts.cxId, fileNameParts.patientId, fileNameParts.fileId);
}
