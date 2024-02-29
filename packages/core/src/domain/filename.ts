export function createFileName(cxId: string, patientId: string, fileId: string): string {
  return `${cxId}_${patientId}_${fileId}`;
}
export function createFolderName(cxId: string, patientId: string): string {
  return `${cxId}/${patientId}`;
}
export function createFilePath(cxId: string, patientId: string, fileId: string): string {
  return `${createFolderName(cxId, patientId)}/${createFileName(cxId, patientId, fileId)}`;
}

export type ParsedFileName = {
  cxId: string;
  patientId: string;
  fileId: string;
  hieAcronym?: string | undefined;
};

export function parseFileName(fileName: string): ParsedFileName | undefined {
  const parts = fileName.split("_");
  const cxId = parts[0];
  const patientId = parts[1];
  const fileId = parts[2];
  const hieAcronym = parts[3]; // optional
  if (cxId && patientId && fileId) {
    return { cxId, patientId, fileId, hieAcronym };
  }
  return undefined;
}

export function parseFilePath(filePath: string): ParsedFileName | undefined {
  if (filePath.includes("/")) {
    const pathParts = filePath.split("/");
    const fileName = pathParts[pathParts.length - 1];
    if (fileName) return parseFileName(fileName);
  }
  return undefined;
}
