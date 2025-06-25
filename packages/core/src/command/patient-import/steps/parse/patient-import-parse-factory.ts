import { Config } from "../../../../util/config";
import { PatientImportParse } from "./patient-import-parse";
import { PatientImportParseCloud } from "./patient-import-parse-cloud";
import { PatientImportParseLocal } from "./patient-import-parse-local";

export function buildPatientImportParseHandler(): PatientImportParse {
  if (Config.isDev()) {
    return new PatientImportParseLocal();
  }
  return new PatientImportParseCloud();
}
