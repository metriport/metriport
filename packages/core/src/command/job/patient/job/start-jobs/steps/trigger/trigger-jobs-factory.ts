import { Config } from "../../../../../../../util/config";
import { TriggerJobsHandler } from "./trigger-jobs";
import { TriggerJobsCloud } from "./trigger-jobs-cloud";
import { TriggerJobsDirect } from "./trigger-jobs-direct";

export function buildTriggerJobsHandler(): TriggerJobsHandler {
  if (Config.isDev()) {
    return new TriggerJobsDirect();
  }
  const triggerPatientJobsLambdaName = Config.triggerPatientJobsLambdaName();
  return new TriggerJobsCloud(triggerPatientJobsLambdaName);
}
