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

export function parseDocumentFilePath(filePath: string): {
  cxId: string;
  patientId: string;
  docId: string;
  extension?: string | undefined;
} {
  const [cxId, patientId, documentIdWithExtension] = getCxIdAndPatientIdFromFilePath(filePath);
  const parsed = path.parse(documentIdWithExtension);
  return { cxId, patientId, docId: parsed.name, extension: parsed.ext };
}

function getCxIdAndPatientIdFromFilePath(fullPath: string): [string, string, string] {
  const hasFolders = fullPath.includes("/");
  const filePath = hasFolders ? fullPath.split("/").pop() : fullPath;
  if (!filePath) {
    throw new MetriportError(`Invalid cda to fhir conversion file name`, undefined, { fullPath });
  }

  const [cxId, patientId, documentIdWithExtension] = filePath.split("_");
  if (!cxId || !patientId || !documentIdWithExtension) {
    throw new MetriportError(`Invalid filename format - expected cxId_patientId_docId`, undefined, {
      filePath,
    });
  }
  return [cxId, patientId, documentIdWithExtension];
}
