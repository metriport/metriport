import { Config } from "../../../../../util/config";
import { ElationLinkPatientHandler } from "./elation-link-patient";
import { ElationLinkPatientCloud } from "./elation-link-patient-cloud";
import { ElationLinkPatientLocal } from "./elation-link-patient-local";

export function buildElationLinkPatientHandler(): ElationLinkPatientHandler {
  if (Config.isDev()) {
    const waitTimeAtTheEndInMillis = 0;
    return new ElationLinkPatientLocal(waitTimeAtTheEndInMillis);
  }
  const elationLinkPatientQueueUrl = Config.getElationLinkPatientQueueUrl();
  return new ElationLinkPatientCloud(elationLinkPatientQueueUrl);
}
