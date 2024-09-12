import { createFilePath } from "../filename";

const extension = ".json";
const consolidatedDataFilenameSuffix = `CONSOLIDATED_DATA${extension}`;

export function createConsolidatedDataFilePath(cxId: string, patientId: string): string {
  return createFilePath(cxId, patientId, consolidatedDataFilenameSuffix);
}
