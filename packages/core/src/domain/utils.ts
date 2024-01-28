export const createS3FileName = (cxId: string, patientId: string, fileName: string): string => {
  return `${cxId}/${patientId}/${cxId}_${patientId}_${fileName}`;
};

export const parseS3FileName = (
  fileKey: string
): { cxId: string; patientId: string; docId: string } | undefined => {
  if (fileKey.includes("/")) {
    const keyParts = fileKey.split("/");
    const docName = keyParts[keyParts.length - 1];
    if (docName) {
      const docNameParts = docName.split("_");
      const cxId = docNameParts[0];
      const patientId = docNameParts[1];
      const docId = docNameParts[2];
      if (cxId && patientId && docId) {
        return { cxId, patientId, docId };
      }
    }
  }
  return;
};
