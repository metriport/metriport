export enum BulkGetDocUrlStatus {
  completed = "completed",
  failed = "failed",
  processing = "processing",
}

export type BulkGetDocumentsUrlProgress = {
  status: BulkGetDocUrlStatus;
  requestId?: string;
};

export function isBulkGetDocUrlProcessing(status?: BulkGetDocUrlStatus | undefined): boolean {
  return status === "processing";
}
