const UPLOADS_FOLDER = "uploads";
export function buildDestinationKeyMetadata(
  cxId: string,
  patientId: string,
  docId: string
): string {
  return `${cxId}/${patientId}/${UPLOADS_FOLDER}/${cxId}_${patientId}_${docId}_metadata.xml`;
}
