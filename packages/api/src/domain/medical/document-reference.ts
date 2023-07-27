import { Patient } from "../../models/medical/patient";
import { Util } from "../../shared/util";

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
};

export const convertResult = ["success", "failed"] as const;
export type ConvertResult = (typeof convertResult)[number];

export const calculateConversionProgress = ({
  patient,
  convertResult,
}: {
  patient: Pick<Patient, "id" | "cxId">;
  convertResult: ConvertResult;
} & {
  patient: Pick<Patient, "data" | "id">;
}): DocumentQueryProgress => {
  // TODO 785 shouldn't be logging on a domain class, remove as soon as we can remove those logs re: 785
  const { log } = Util.out(`calculateConversionProgress - patient ${patient.id}`);
  const docQueryProgress = patient.data.documentQueryProgress ?? {};

  // TODO 785 remove this once we're confident with the flow
  log(
    `IN convert result: ${convertResult}; docQueryProgress : ${JSON.stringify(docQueryProgress)}`
  );

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

  // TODO 785 remove this once we're confident with the flow
  log(`OUT docQueryProgress: ${JSON.stringify(docQueryProgress)}`);
  return docQueryProgress;
};

export function getStatusFromProgress(
  progress: Pick<Progress, "errors" | "successful" | "total">
): DocumentQueryStatus {
  const { successful, errors, total } = progress;
  const isConversionCompleted = (successful ?? 0) + (errors ?? 0) >= (total ?? 0);
  return isConversionCompleted ? "completed" : "processing";
}
