import { ConsolidatedFileType } from "../../command/consolidated/consolidated-shared";
import { createFilePath } from "../filename";

export const extension = ".json";
export const CONSOLIDATED_SNAPSHOT_KEY = "consolidated";
export const CONSOLIDATED_DATA_KEY = "CONSOLIDATED_DATA";
export const CONTRIBUTION_BUNDLE_FULL = "CONTRIB_MERGED_READY";
export const CONTRIBUTION_BUNDLE_RAW = `CONTRIB_MERGED_RAW`;
export const CONTRIBUTION_BUNDLE_UPLOAD = "UPLOAD_BUNDLE";

export function createConsolidatedDataFilePath(
  cxId: string,
  patientId: string,
  deduped = true
): string {
  const additionalSuffix = deduped ? "" : "_with-duplicates";

  const filePathWithSuffix = createConsolidatedDataFileNameWithSuffix(cxId, patientId);
  return `${filePathWithSuffix}${additionalSuffix}${extension}`;
}

export function createConsolidatedDataFileNameWithSuffix(cxId: string, patientId: string): string {
  return createFilePath(cxId, patientId, CONSOLIDATED_DATA_KEY);
}

export function createConsolidatedSnapshotFileName(
  cxId: string,
  patientId: string,
  requestId?: string,
  type?: ConsolidatedFileType
): string {
  const date = new Date().toISOString();
  const filePathWithSuffix = createConsolidatedSnapshotFileNameWithSuffix(cxId, patientId);

  return `${filePathWithSuffix}_${date}_${requestId}${getSuffixForType(type)}${extension}`;
}

export function createConsolidatedSnapshotFileNameWithSuffix(
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
