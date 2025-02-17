import { Config } from "../../../../util/config";
import { PatientImportQueryHandler } from "./patient-import-query";
import { PatientImportQueryHandlerCloud } from "./patient-import-query-cloud";
import { PatientImportQueryHandlerLocal } from "./patient-import-query-local";

export function buildPatientImportQueryHandler(): PatientImportQueryHandler {
  if (Config.isDev()) {
    const patientImportBucket = Config.getPatientImportBucket();
    const waitTimeInMillis = 0;
    return new PatientImportQueryHandlerLocal(patientImportBucket, waitTimeInMillis);
  }
  const patientQueryQueueUrl = Config.getPatientImportQueryQueueUrl();
  return new PatientImportQueryHandlerCloud(patientQueryQueueUrl);
}
