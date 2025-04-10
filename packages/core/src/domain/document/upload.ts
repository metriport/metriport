import { JSON_FILE_EXTENSION, getFileExtension } from "../../util/mime";
import { createFileName, createFolderName } from "../filename";

export const UPLOADS_FOLDER = "uploads";
export const CCD_SUFFIX = "ccd";
export const FHIR_BUNDLE_SUFFIX = "FHIR_BUNDLE";
export const FULL_CONTRIBUTION_BUNDLE = "FULL_CONTRIBUTION_BUNDLE";

export function createUploadFilePath(cxId: string, patientId: string, docName: string): string {
  const folderName = createFolderName(cxId, patientId);
  const fileName = createFileName(cxId, patientId, docName);
  return `${folderName}/${UPLOADS_FOLDER}/${fileName}`;
}

export function createContributionBundleFilePath(
  cxId: string,
  patientId: string,
  requestId: string
): string {
  const folderName = createFolderName(cxId, patientId);
  const fileName = createFileName(cxId, patientId, `${requestId}_${FHIR_BUNDLE_SUFFIX}`);
  return `${folderName}/${UPLOADS_FOLDER}/${fileName}${JSON_FILE_EXTENSION}`;
}

export function createFullContributionBundleFilePath(cxId: string, patientId: string): string {
  const folderName = createFolderName(cxId, patientId);
  return `${folderName}/${UPLOADS_FOLDER}/${FULL_CONTRIBUTION_BUNDLE}${JSON_FILE_EXTENSION}`;
}

export function createUploadDirectoryPath(cxId: string, patientId: string): string {
  const folderName = createFolderName(cxId, patientId);
  return `${folderName}/${UPLOADS_FOLDER}`;
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
