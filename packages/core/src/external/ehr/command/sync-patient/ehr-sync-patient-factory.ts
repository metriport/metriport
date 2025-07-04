import { Config } from "../../../../util/config";
import { EhrSyncPatientHandler } from "./ehr-sync-patient";
import { EhrSyncPatientCloud } from "./ehr-sync-patient-cloud";
import { EhrSyncPatientDirect } from "./ehr-sync-patient-direct";

export function buildEhrSyncPatientHandler(): EhrSyncPatientHandler {
  if (Config.isDev()) {
    return new EhrSyncPatientDirect();
  }
  return new EhrSyncPatientCloud();
}
