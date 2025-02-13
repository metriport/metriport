import { Config } from "../../../../util/config";
import { PatientImportParseHandler } from "./patient-import-parse";
import { PatientImportParseCloud } from "./patient-import-parse-cloud";
import { PatientImportParseLocal } from "./patient-import-parse-local";

export function buildPatientImportParseHandler(): PatientImportParseHandler {
  if (Config.isDev()) {
    const patientImportBucket = Config.getPatientImportBucket();
    return new PatientImportParseLocal(patientImportBucket);
  }
  const patientImportLambdaName = Config.getPatientImportLambdaName();
  return new PatientImportParseCloud(patientImportLambdaName);
}
