import { Config } from "../../../util/config";
import { EhrSyncPatientHandler } from "./ehr-sync-patient";
import { EhrSyncPatientCloud } from "./ehr-sync-patient-cloud";
import { EhrSyncPatientLocal } from "./ehr-sync-patient-local";

export function buildEhrSyncPatientHandler(): EhrSyncPatientHandler {
  if (Config.isDev()) {
    const waitTimeAtTheEndInMillis = 0;
    return new EhrSyncPatientLocal(waitTimeAtTheEndInMillis);
  }
  const ehrSyncPatientQueueUrl = Config.getEhrSyncPatientQueueUrl();
  return new EhrSyncPatientCloud(ehrSyncPatientQueueUrl);
}
