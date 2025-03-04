import { Config } from "../../../../util/config";
import { PatientImportCreate } from "./patient-import-create";
import { PatientImportCreateCloud } from "./patient-import-create-cloud";
import { PatientImportCreateLocal } from "./patient-import-create-local";

export function buildPatientImportCreateHandler(): PatientImportCreate {
  if (Config.isDev()) {
    const patientImportBucket = Config.getPatientImportBucket();
    const waitTimeAtTheEndInMillis = 0;
    return new PatientImportCreateLocal(patientImportBucket, waitTimeAtTheEndInMillis);
  }
  const patientCreateQueueUrl = Config.getPatientImportCreateQueueUrl();
  return new PatientImportCreateCloud(patientCreateQueueUrl);
}
