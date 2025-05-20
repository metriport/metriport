import { Config } from "../../../../util/config";
import { HealthieLinkPatientHandler } from "./healthie-link-patient";
import { HealthieLinkPatientCloud } from "./healthie-link-patient-cloud";
import { HealthieLinkPatientLocal } from "./healthie-link-patient-local";

export function buildHealthieLinkPatientHandler(): HealthieLinkPatientHandler {
  if (Config.isDev()) {
    const waitTimeAtTheEndInMillis = 0;
    return new HealthieLinkPatientLocal(waitTimeAtTheEndInMillis);
  }
  const healthieLinkPatientQueueUrl = Config.getHealthieLinkPatientQueueUrl();
  return new HealthieLinkPatientCloud(healthieLinkPatientQueueUrl);
}
