import path from "path";
import { getFileExtension } from "../../util/mime";
import { ConversionType, validConversionTypes } from "../conversion/cda-to-html-pdf";
import { createFilePath } from "../filename";
import { MetriportError } from "@metriport/shared";

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

export function createDocumentFilePathPrefix(cxId: string, patientId: string): string {
  return createFilePath(cxId, patientId, "");
}

export function parseDocumentFileName(fileName: string): {
  cxId: string;
  patientId: string;
  docId: string;
  extension?: string | undefined;
} {
  const [cxId, patientId, documentFileName] = fileName.split("/");
  if (!documentFileName) {
    throw new MetriportError(`Invalid cda to fhir conversion file name`, undefined, { fileName });
  }
  const [_cxId, _patientId, documentIdWithExtension] = documentFileName?.split("_") ?? [];
  if (
    !_cxId ||
    cxId !== _cxId ||
    !_patientId ||
    patientId !== _patientId ||
    !documentIdWithExtension
  ) {
    throw new MetriportError(`Invalid cda to fhir conversion file name`, undefined, { fileName });
  }
  const docId = path.basename(documentIdWithExtension);
  const extension = path.extname(documentIdWithExtension);
  return { cxId, patientId, docId, extension };
}
