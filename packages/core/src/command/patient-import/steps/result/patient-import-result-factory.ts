import { Config } from "../../../../util/config";
import { PatientImportResult } from "./patient-import-result";
import { PatientImportResultHandlerCloud } from "./patient-import-result-cloud";
import { PatientImportResultLocal } from "./patient-import-result-local";

export function buildPatientImportResult(): PatientImportResult {
  if (Config.isDev()) {
    const patientImportBucket = Config.getPatientImportBucket();
    return new PatientImportResultLocal(patientImportBucket);
  }
  const patientResultLambdaName = Config.getPatientImportResultLambdaName();
  return new PatientImportResultHandlerCloud(patientResultLambdaName);
}
