import { DocumentQueryProgress, getStatusFromProgress } from "./document-query";
import { Patient } from "./patient";

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
  const docQueryProgress = patient.data.documentQueryProgress ?? {};

  const talliedDocQueryProgress = tallyDocQueryProgress(docQueryProgress, convertResult);

  return talliedDocQueryProgress;
};

export const tallyDocQueryProgress = (
  docQueryProgress: DocumentQueryProgress,
  convertResult: ConvertResult
): DocumentQueryProgress => {
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

  return docQueryProgress;
};
