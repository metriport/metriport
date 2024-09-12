import { createFilePath } from "../filename";

const extension = ".json";
const consolidatedDataFilenameSuffix = `CONSOLIDATED_DATA${extension}`;

export function createConsolidatedDataFilePath(cxId: string, patientId: string): string {
  return createFilePath(cxId, patientId, consolidatedDataFilenameSuffix);
}

export function createConsolidatedDataBackupFilePath(consolidatedDataFilePath: string): string {
  const filename = consolidatedDataFilePath.replace(extension, "");
  const date = new Date().toISOString();
  return `${filename}_${date}${extension}`;
}
