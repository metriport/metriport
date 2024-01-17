export const documentQueryStatus = ["processing", "completed", "failed"] as const;
export type DocumentQueryStatus = (typeof documentQueryStatus)[number];

export type Progress = {
  status: DocumentQueryStatus;
  total?: number;
  successful?: number;
  errors?: number;
};

export type ProgressIntKeys = keyof Omit<Progress, "status">;

export const progressTypes = ["convert", "download"] as const;
export type ProgressType = (typeof progressTypes)[number];

export type DocumentQueryProgress = Partial<
  Record<ProgressType, Progress> & {
    requestId: string;
  }
>;

export const convertResult = ["success", "failed"] as const;
export type ConvertResult = (typeof convertResult)[number];

export function getStatusFromProgress(
  progress: Pick<Progress, "errors" | "successful" | "total">
): DocumentQueryStatus {
  const { successful, errors, total } = progress;
  const isConversionCompleted = (successful ?? 0) + (errors ?? 0) >= (total ?? 0);
  return isConversionCompleted ? "completed" : "processing";
}

export function isProcessingStatus(status?: DocumentQueryStatus | undefined) {
  if (!status) return false;
  return status === "processing";
}
export function isFinalStatus(status?: DocumentQueryStatus | undefined) {
  return !isProcessingStatus(status);
}

export function isProcessing(progress?: Progress | undefined) {
  return isProcessingStatus(progress?.status);
}
