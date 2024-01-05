import { DocumentQueryProgress, isProcessing } from "@metriport/core/domain/medical/document-query";
import { Patient } from "@metriport/core/domain/medical/patient";

export function areDocumentsProcessing(patient: Patient): boolean;
export function areDocumentsProcessing(progress: DocumentQueryProgress | undefined): boolean;
export function areDocumentsProcessing(
  param: Patient | DocumentQueryProgress | undefined
): boolean {
  if (!param) return false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const progress = (param as any).data
    ? (param as Patient).data.documentQueryProgress
    : (param as DocumentQueryProgress);

  return isProcessing(progress?.download) || isProcessing(progress?.convert);
}
