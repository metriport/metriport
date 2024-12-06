import { getFileExtension } from "../../util/mime";
import { createFileName, createFolderName } from "../filename";

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
  mimeType: string;
}): string {
  const extension = getFileExtension(mimeType);
  return `${filePath}_${attachmentId}${extension}`;
}
