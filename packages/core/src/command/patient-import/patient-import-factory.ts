import { Config } from "../../util/config";
import { PatientImportHandler } from "./patient-import";
import { PatientImportHandlerDirect } from "./patient-import-direct";
import { PatientImportHandlerLambda } from "./patient-import-lambda";

export function makePatientImportHandler(): PatientImportHandler {
  if (!Config.isCloudEnv()) return new PatientImportHandlerDirect();
  return new PatientImportHandlerLambda();
}
