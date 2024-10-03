import { Config } from "../../util/config";
import { PatientImportHandler } from "./patient-import";
import { PatientImportHandlerLocal } from "./patient-import-local";
import { PatientImportHandlerCloud } from "./patient-import-cloud";

export function makePatientImportHandler(): PatientImportHandler {
  if (!Config.isCloudEnv()) return new PatientImportHandlerLocal();
  return new PatientImportHandlerCloud();
}
