import { getFileExtension } from "../../util/mime";
import { createFilePath } from "../filename";

export function createDocumentFileName(docId: string, mimeType?: string | undefined): string {
  const extension = getFileExtension(mimeType);
  const docName = extension ? `${docId}${extension}` : docId;
  return docName;
}

export function createDocumentFilePath(
  cxId: string,
  patientId: string,
  docId: string,
  mimeType?: string | undefined
): string {
  return createFilePath(cxId, patientId, createDocumentFileName(docId, mimeType));
}
