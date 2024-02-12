import { createFileName, createFolderName } from "../filename";

const UPLOADS_FOLDER = "uploads";

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
