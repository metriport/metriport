import { Config } from "../../util/config";
import { PatientImportHandler } from "./patient-import";
import { PatientImportHandlerLocal } from "./patient-import-local";
import { PatientImportHandlerCloud } from "./patient-import-cloud";

export function makePatientImportHandler(): PatientImportHandler {
  if (!Config.isCloudEnv()) {
    const patientImportBucket = Config.getPatientImportBucket();
    if (!patientImportBucket) throw new Error("patientImportBucket not setup");
    return new PatientImportHandlerLocal(patientImportBucket);
  }
  return new PatientImportHandlerCloud();
}
