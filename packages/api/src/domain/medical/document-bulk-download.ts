export const DocumentDownloadStatus = ["processing", "completed", "failed"] as const;
export type DocumentDownloadStatus = (typeof DocumentDownloadStatus)[number];

export type Progress = {
  status: DocumentDownloadStatus;
  total?: number;
  successful?: number;
  errors?: number;
};

export type DocumentBulkDownloadProgress = {
  download?: Progress;
  requestId?: string;
};

export function isProcessingStatus(status?: DocumentDownloadStatus | undefined): boolean {
  if (!status) return false;
  return status === "processing";
}

/**
 * The function checks if a document bulk download is currently being processed.
 * @param {Progress | undefined} [progress] - the progress of a bulk download operation.
 * @returns a boolean value.
 */
export function isDocBulkDownloadProcessing(progress?: Progress | undefined): boolean {
  if (!progress) return false;
  return isProcessingStatus(progress?.status);
}
