import { MetriportError } from "@metriport/shared";

export function getCdaToFhirConversionPrefix({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): string {
  return `${cxId}/${patientId}/${cxId}_${patientId}_`;
}

export function buildDocumentConversionFileName({
  cxId,
  patientId,
  documentId,
  extension = ".xml.json",
}: {
  cxId: string;
  patientId: string;
  documentId: string;
  extension?: string;
}): string {
  return `${cxId}/${patientId}/${cxId}_${patientId}_${documentId}${extension}`;
}

export function parseCdaToFhirConversionFileName({ fileName }: { fileName: string }): {
  cxId: string;
  patientId: string;
  documentId: string;
  extension?: string | undefined;
} {
  const [cxId, patientId, documentFileName] = fileName.split("/");
  if (!documentFileName) {
    throw new MetriportError(`Invalid cda to fhir conversion file name: ${fileName}`);
  }
  const [_cxId, _patientId, documentIdWithExtension] = documentFileName?.split("_") ?? [];
  if (
    !_cxId ||
    cxId !== _cxId ||
    !_patientId ||
    patientId !== _patientId ||
    !documentIdWithExtension
  ) {
    throw new MetriportError(`Invalid cda to fhir conversion file name: ${fileName}`);
  }
  const firstPeriod = documentIdWithExtension.indexOf(".");
  const documentId =
    firstPeriod >= 0 ? documentIdWithExtension.substring(0, firstPeriod) : documentIdWithExtension;
  const extension = firstPeriod >= 0 ? documentIdWithExtension.substring(firstPeriod) : undefined;
  return { cxId, patientId, documentId, extension };
}

export function getDataExtractionFileName({
  cxId,
  patientId,
  documentId,
}: {
  cxId: string;
  patientId: string;
  documentId: string;
}): string {
  return `cxId=${cxId}/patientId=${patientId}/documentId=${documentId}/bundle.json`;
}

export function getDataExtractionFilePrefix({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): string {
  return `cxId=${cxId}/patientId=${patientId}/documentId=`;
}
