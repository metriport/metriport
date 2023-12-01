export const BulkGetDocUrlStatus = ["processing", "completed", "failed"] as const;
export type BulkGetDocUrlStatus = (typeof BulkGetDocUrlStatus)[number];

export type Progress = {
  status: BulkGetDocUrlStatus;
  total?: number;
  successful?: number;
  errors?: number;
};

export type BulkGetDocumentsUrlProgress = {
  urlGeneration?: Progress;
  requestId?: string;
};

export function isProcessingStatus(status?: BulkGetDocUrlStatus | undefined): boolean {
  if (!status) return false;
  return status === "processing";
}

/**
 * The function checks if a bulk get document URL is currently being processed.
 * @param {Progress | undefined} [progress] - The progress of a document URL processing task.
 * @returns a boolean value.
 */
export function isBulkGetDocUrlProcessing(progress?: Progress | undefined): boolean {
  if (!progress) return false;
  return isProcessingStatus(progress?.status);
}
