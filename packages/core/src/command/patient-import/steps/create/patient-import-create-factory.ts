import { Config } from "../../../../util/config";
import { PatientImportCreateHandler } from "./patient-import-create";
import { PatientImportCreateCloud } from "./patient-import-create-cloud";
import { PatientImportCreateHandlerLocal } from "./patient-import-create-local";

export function buildPatientImportCreateHandler(): PatientImportCreateHandler {
  if (Config.isDev()) {
    const patientImportBucket = Config.getPatientImportBucket();
    const waitTimeAtTheEndInMillis = 0;
    return new PatientImportCreateHandlerLocal(patientImportBucket, waitTimeAtTheEndInMillis);
  }
  const patientCreateQueueUrl = Config.getPatientImportCreateQueueUrl();
  return new PatientImportCreateCloud(patientCreateQueueUrl);
}
