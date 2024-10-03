import { Config } from "../../util/config";
import { PatientImportHandler } from "./patient-import";
import { PatientImportHandlerLocal } from "./patient-import-local";
import { PatientImportHandlerLambda } from "./patient-import-lambda";

export function makePatientImportHandler(): PatientImportHandler {
  if (!Config.isCloudEnv()) return new PatientImportHandlerLocal();
  return new PatientImportHandlerLambda();
}
