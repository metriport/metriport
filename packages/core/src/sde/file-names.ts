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
