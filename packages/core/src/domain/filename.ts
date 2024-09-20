export function createFileName(cxId: string, patientId: string, fileId: string): string {
  return `${cxId}_${patientId}_${fileId}`;
}
export function createFolderName(cxId: string, patientId: string): string {
  return `${cxId}/${patientId}`;
}
export function createFilePath(cxId: string, patientId: string, fileId: string): string {
  return `${createFolderName(cxId, patientId)}/${createFileName(cxId, patientId, fileId)}`;
}

export function createHivePartitionFilePath({
  cxId,
  patientId,
  keys,
  date,
  dateGranularity = "day",
}: {
  cxId: string;
  patientId: string;
  keys?: { [key: string]: string };
  date?: Date;
  dateGranularity?: "day" | "hour" | "minute" | "second";
}): string {
  const datePath: string[] = [];
  if (date) {
    datePath.push(`date=${date.toISOString().slice(0, 10)}`);
    if (["hour", "minute", "second"].includes(dateGranularity)) {
      datePath.push(`hour=${date.getUTCHours()}`);
    }
    if (["minute", "second"].includes(dateGranularity)) {
      datePath.push(`minute=${date.getUTCMinutes()}`);
    }
    if (["second"].includes(dateGranularity)) {
      datePath.push(`second=${date.getUTCSeconds()}`);
    }
  }
  let keysPath: string[] = [];
  if (keys) {
    keysPath = Object.entries(keys).map(([key, value]) => `${key.toLowerCase()}=${value}`);
  }
  return [...datePath, `cx_id=${cxId}`, `patient_id=${patientId}`, ...keysPath].join("/");
}

export type ParsedFileName = { cxId: string; patientId: string; fileId: string };

export function parseFileName(fileName: string): ParsedFileName | undefined {
  const parts = fileName.split("_");
  const cxId = parts[0];
  const patientId = parts[1];
  const fileId = parts[2];
  if (cxId && patientId && fileId) {
    return { cxId, patientId, fileId };
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
