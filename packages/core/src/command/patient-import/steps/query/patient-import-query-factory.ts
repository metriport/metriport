import { Config } from "../../../../util/config";
import { PatientImportQuery } from "./patient-import-query";
import { PatientImportQueryCloud } from "./patient-import-query-cloud";
import { PatientImportQueryLocal } from "./patient-import-query-local";

export function buildPatientImportQueryHandler(): PatientImportQuery {
  if (Config.isDev()) {
    return new PatientImportQueryLocal();
  }
  return new PatientImportQueryCloud();
}
