export function getDataExtractionFileName({
  cxId,
  patientId,
  documentId,
}: {
  cxId: string;
  patientId: string;
  documentId: string;
}): string {
  return `${getDataExtractionFilePrefix({ cxId, patientId })}${documentId}/bundle.json`;
}

export function getDataExtractionFilePrefix({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): string {
  return `cxid=${cxId}/patientid=${patientId}/documentid=`;
}
