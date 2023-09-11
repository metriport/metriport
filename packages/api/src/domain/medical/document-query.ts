import { Patient } from "../../models/medical/patient";

export const documentQueryStatus = ["processing", "completed", "failed"] as const;
export type DocumentQueryStatus = (typeof documentQueryStatus)[number];

export type Progress = {
  status: DocumentQueryStatus;
  total?: number;
  successful?: number;
  errors?: number;
};

export type DocumentQueryProgress = {
  download?: Progress;
  convert?: Progress;
  requestId?: string;
};

export const convertResult = ["success", "failed"] as const;
export type ConvertResult = (typeof convertResult)[number];

export const calculateConversionProgress = ({
  patient,
  convertResult,
  requestId,
}: {
  patient: Pick<Patient, "id" | "cxId">;
  convertResult: ConvertResult;
  requestId?: string | null | undefined;
} & {
  patient: Pick<Patient, "data" | "id">;
  requestId?: string | null | undefined;
}): DocumentQueryProgress => {
  console.log("Made it to append doc query", requestId);
  const docQueryProgress = patient.data.documentQueryProgress ?? {};

  const totalToConvert = docQueryProgress?.convert?.total ?? 0;

  const successfulConvert = docQueryProgress?.convert?.successful ?? 0;
  const successful = convertResult === "success" ? successfulConvert + 1 : successfulConvert;

  const errorsConvert = docQueryProgress?.convert?.errors ?? 0;
  const errors = convertResult === "failed" ? errorsConvert + 1 : errorsConvert;

  const status = getStatusFromProgress({ successful, errors, total: totalToConvert });

  docQueryProgress.convert = {
    ...docQueryProgress?.convert,
    status,
    successful,
    errors,
  };

  docQueryProgress.requestId = requestId ?? undefined;

  return docQueryProgress;
};

export function getStatusFromProgress(
  progress: Pick<Progress, "errors" | "successful" | "total">
): DocumentQueryStatus {
  const { successful, errors, total } = progress;
  const isConversionCompleted = (successful ?? 0) + (errors ?? 0) >= (total ?? 0);
  return isConversionCompleted ? "completed" : "processing";
}
