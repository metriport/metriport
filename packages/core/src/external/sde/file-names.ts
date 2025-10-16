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
}: {
  cxId: string;
  patientId: string;
  documentId: string;
}): string {
  return `${cxId}/${patientId}/${cxId}_${patientId}_${documentId}.xml.json`;
}

export function parseCdaToFhirConversionFileName({ fileName }: { fileName: string }): {
  cxId: string;
  patientId: string;
  documentId: string;
} {
  const [cxId, patientId, documentFileName] = fileName.split("/");
  const [_cxId, _patientId, documentId] = documentFileName?.split("_") ?? [];
  if (!_cxId || cxId !== _cxId || !_patientId || patientId !== _patientId || !documentId) {
    throw new MetriportError(`Invalid cda to fhir conversion file name: ${fileName}`);
  }
  return { cxId, patientId, documentId };
}

export function getDataExtractionFileName({
  cxId,
  patientId,
  hash,
}: {
  cxId: string;
  patientId: string;
  hash: string;
}): string {
  return `cxId=${cxId}/patientId=${patientId}/hash=${hash}.json`;
}

export function getDataExtractionFilePrefix({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): string {
  return `cxId=${cxId}/patientId=${patientId}/hash=`;
}
