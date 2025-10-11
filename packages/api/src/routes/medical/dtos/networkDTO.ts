import { DocumentQueryStatus, DocumentQueryProgress } from "@metriport/core/domain/document-query";
import { SourceQueryProgress } from "@metriport/core/domain/network-query";

export type NetworkSourceStatusDTO = {
  type: "hie" | "pharmacy" | "laboratory";
  source?: string;
  status: DocumentQueryStatus;
};

export function documentQueryProgressToDTO(
  progress?: DocumentQueryProgress
): SourceQueryProgress | undefined {
  if (!progress) return undefined;

  const status = progress.convert?.status ?? progress.download?.status;
  if (!status) return undefined;

  // Combined document metrics
  const downloaded = progress.download?.successful ?? 0;
  const total = progress.download?.total ?? 0;
  const downloadInProgress = total - downloaded;
  const converted = progress.convert?.successful ?? 0;
  const failedConversion = progress.convert?.errors ?? 0;
  const failedDownload = progress.download?.errors ?? 0;
  const failed = failedConversion + failedDownload;

  return {
    type: "hie",
    status,
    startedAt: progress.startedAt,
    requestId: progress.requestId,
    documents: {
      downloadInProgress,
      downloaded,
      converted,
      failed,
      total,
    },
  };
}
