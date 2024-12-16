import { ConsolidatedFileType } from "../../command/consolidated/consolidated-shared";
import { createFilePath } from "../filename";

export const extension = ".json";

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
    `consolidated_${date}_${requestId}${getSuffixForType(type)}${extension}`
  );
}

export function buildDocumentNameForPartialConversions(fileName: string, index: number): string {
  const paddedIndex = index.toString().padStart(3, "0");
  return `${fileName}_part_${paddedIndex}.xml`;
}

function getSuffixForType(type?: ConsolidatedFileType): string {
  switch (type) {
    case "original":
      return "";
    case "dedup":
      return "_deduped";
    case "invalid":
      return "_invalid";
  }
  return "";
}
