import { Config } from "../../../../util/config";
import { PatientImportCreate } from "./patient-import-create";
import { PatientImportCreateCloud } from "./patient-import-create-cloud";
import { PatientImportCreateLocal } from "./patient-import-create-local";

export function buildPatientImportCreateHandler(): PatientImportCreate {
  if (Config.isDev()) {
    return new PatientImportCreateLocal();
  }
  return new PatientImportCreateCloud();
}
