import { createFilePath } from "../filename";

const extension = ".json";
const consolidatedDataFilenameSuffix = `CONSOLIDATED_DATA${extension}`;

export function createConsolidatedDataFilePath(cxId: string, patientId: string): string {
  return createFilePath(cxId, patientId, consolidatedDataFilenameSuffix);
}

export function createConsolidatedSnapshotFileName(
  cxId: string,
  patientId: string,
  requestId?: string,
  isDeduped?: boolean
): string {
  const date = new Date().toISOString();
  return createFilePath(
    cxId,
    patientId,
    `consolidated_${date}_${requestId}${isDeduped ? "_deduped" : ""}.json`
  );
}
