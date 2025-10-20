import {
  DocumentQueryProgress,
  getStatusFromProgress,
} from "@metriport/core/domain/document-query";
import { Patient } from "@metriport/core/domain/patient";

export const convertResult = ["success", "failed"] as const;
export type ConvertResult = (typeof convertResult)[number];

export function calculateConversionProgress({
  patient,
  convertResult,
  count,
}: {
  patient: Pick<Patient, "id" | "cxId">;
  convertResult: ConvertResult;
  count?: number;
} & {
  patient: Pick<Patient, "data" | "id">;
}): DocumentQueryProgress {
  const docQueryProgress = patient.data.documentQueryProgress ?? {};

  const talliedDocQueryProgress = tallyDocQueryProgress(docQueryProgress, convertResult, count);

  return talliedDocQueryProgress;
}

/**
 * Tally the conversion progress for the given convert result and count.
 *
 * @param docQueryProgress - the current document query progress
 * @param convertResult - the result of the conversion, either "success" or "failed"
 * @param countParam - the amount of documents for the given result to add to the tally (optional,
 *                     defaults to 1)
 * @returns the updated document query progress
 */
export function tallyDocQueryProgress(
  docQueryProgress: DocumentQueryProgress,
  convertResult: ConvertResult,
  countParam?: number
): DocumentQueryProgress {
  const count = countParam == undefined ? 1 : countParam;
  const totalToConvert = docQueryProgress?.convert?.total ?? 0;

  const successfulConvert = docQueryProgress?.convert?.successful ?? 0;
  const successful = convertResult === "success" ? successfulConvert + count : successfulConvert;

  const errorsConvert = docQueryProgress?.convert?.errors ?? 0;
  const errors = convertResult === "failed" ? errorsConvert + count : errorsConvert;

  const status = getStatusFromProgress({ successful, errors, total: totalToConvert });

  docQueryProgress.convert = {
    ...docQueryProgress?.convert,
    status,
    successful,
    errors,
  };

  return docQueryProgress;
}
