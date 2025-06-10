export function getSftpDirectory(name: string) {
  return `/${name}`;
}

export function getSftpFileName(directoryName: string, fileName: string) {
  return `/${directoryName}/${fileName}`;
}

export function getS3Key(directoryName: string, fileName: string) {
  return `${directoryName}/${fileName}`;
}

export function getS3ConversionBundleKey(cxId: string, patientId: string, transmissionId: string) {
  return `cxId=${cxId}/ptId=${patientId}/QUEST/${transmissionId}.json`;
}
