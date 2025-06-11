import { Config } from "../../../../../../../util/config";
import { RunJobHandler } from "./run-job";
import { RunJobCloud } from "./run-job-cloud";
import { RunJobDirect } from "./run-job-direct";

export function buildRunJobHandler(): RunJobHandler {
  if (Config.isDev()) {
    return new RunJobDirect();
  }
  const runPatientJobQueueUrl = Config.getRunPatientJobQueueUrl();
  return new RunJobCloud(runPatientJobQueueUrl);
}
