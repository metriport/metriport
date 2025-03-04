import { Config } from "../../../../util/config";
import { PatientImportQuery } from "./patient-import-query";
import { PatientImportQueryHandlerCloud } from "./patient-import-query-cloud";
import { PatientImportQueryLocal } from "./patient-import-query-local";

export function buildPatientImportQueryHandler(): PatientImportQuery {
  if (Config.isDev()) {
    const patientImportBucket = Config.getPatientImportBucket();
    const waitTimeInMillis = 0;
    return new PatientImportQueryLocal(patientImportBucket, waitTimeInMillis);
  }
  const patientQueryQueueUrl = Config.getPatientImportQueryQueueUrl();
  return new PatientImportQueryHandlerCloud(patientQueryQueueUrl);
}
