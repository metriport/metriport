import { createFilePath } from "../filename";

const extension = ".json";

export function createConsolidatedDataFilePath(
  cxId: string,
  patientId: string,
  deduped = true
): string {
  const additionalSuffix = deduped ? "" : "_with-duplicates";
  return createFilePath(cxId, patientId, `CONSOLIDATED_DATA${additionalSuffix}${extension}`);
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
    `consolidated_${date}_${requestId}${isDeduped ? "_deduped" : ""}${extension}`
  );
}
