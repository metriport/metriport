export const BulkGetDocUrlStatus = ["processing", "completed", "failed"] as const;
export type BulkGetDocUrlStatus = (typeof BulkGetDocUrlStatus)[number];

export type BulkGetDocumentsUrlProgress = {
  status: BulkGetDocUrlStatus;
  requestId?: string;
};

export function isBulkGetDocUrlProcessing(status?: BulkGetDocUrlStatus | undefined): boolean {
  return status === "processing";
}
