import { TriggerJobsRequest } from "@metriport/core/command/job/patient/job/start-jobs/steps/trigger/trigger-jobs";
import { buildTriggerJobsHandler } from "@metriport/core/command/job/patient/job/start-jobs/steps/trigger/trigger-jobs-factory";
import { buildDayjs } from "@metriport/shared/common/date";
import { capture } from "../../shared/capture";
import { getEnvOrFail } from "../../shared/env";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");

type TriggerJobsRequestInLambda = Omit<TriggerJobsRequest, "scheduledBefore"> & {
  scheduledBefore?: string;
};

export const handler = capture.wrapHandler(async (params: TriggerJobsRequestInLambda) => {
  capture.setExtra({ params, context: lambdaName });
  const triggerJobsHandler = buildTriggerJobsHandler();
  await triggerJobsHandler.triggerJobs(convertToTriggerJobsRequest(params));
});

function convertToTriggerJobsRequest(params: TriggerJobsRequestInLambda): TriggerJobsRequest {
  return {
    ...params,
    scheduledBefore: params.scheduledBefore
      ? buildDayjs(params.scheduledBefore).toDate()
      : undefined,
  };
}
