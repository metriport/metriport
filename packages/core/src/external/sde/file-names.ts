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
