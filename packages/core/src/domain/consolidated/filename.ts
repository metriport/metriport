import { ConsolidatedFileType } from "../../command/consolidated/consolidated-shared";
import { createFilePath } from "../filename";

export const extension = ".json";
export const CONSOLIDATED_SNAPSHOT_KEY = "consolidated";

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
  type?: ConsolidatedFileType
): string {
  const date = new Date().toISOString();
  return createFilePath(
    cxId,
    patientId,
    `${CONSOLIDATED_SNAPSHOT_KEY}_${date}_${requestId}${getSuffixForType(type)}${extension}`
  );
}

export function createConsolidatedSnapshotFileNameWithNoExtension(
  cxId: string,
  patientId: string
): string {
  return createFilePath(cxId, patientId, CONSOLIDATED_SNAPSHOT_KEY);
}

function getSuffixForType(type?: ConsolidatedFileType): string {
  switch (type) {
    case "original":
      return "";
    case "dedup":
      return "_deduped";
    case "normalized":
      return "_normalized";
    case "invalid":
      return "_invalid";
  }
  return "";
}
