import { Config } from "../../../../util/config";
import { PatientImportParse } from "./patient-import-parse";
import { PatientImportParseCloud } from "./patient-import-parse-cloud";
import { PatientImportParseLocal } from "./patient-import-parse-local";

export function buildPatientImportParseHandler(): PatientImportParse {
  if (Config.isDev()) {
    const patientImportBucket = Config.getPatientImportBucket();
    return new PatientImportParseLocal(patientImportBucket);
  }
  const patientImportLambdaName = Config.getPatientImportParseLambdaName();
  return new PatientImportParseCloud(patientImportLambdaName);
}
