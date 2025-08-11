import { getFileExtension } from "../../util/mime";
import { ConversionType, validConversionTypes } from "../conversion/cda-to-html-pdf";
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

function createDocumentRenderFilePath(filePath: string, renderType: ConversionType): string {
  const extension = renderType === "html" ? ".html" : ".pdf";
  return filePath.concat(extension);
}

export function createDocumentRenderFilePaths(filePath: string): string[] {
  return validConversionTypes.map(renderType => createDocumentRenderFilePath(filePath, renderType));
}
