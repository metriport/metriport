import { GetJobsRequest } from "@metriport/core/command/job/patient/job/start-jobs/steps/get/get-jobs";
import { GetJobsDirect } from "@metriport/core/command/job/patient/job/start-jobs/steps/get/get-jobs-direct";
import { getSecretValueOrFail } from "@metriport/core/external/aws/secret-manager";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import * as Sentry from "@sentry/serverless";
import { capture } from "../../shared/capture";
import { getEnvOrFail } from "../../shared/env";
import { prefixedLog } from "../../shared/log";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");
const region = getEnvOrFail("AWS_REGION");
// Set by us
const dbCredsArn = getEnvVarOrFail("DB_CREDS");

type GetJobsRequestInLambda = Omit<GetJobsRequest, "runDate"> & {
  runDate?: string;
};

// TODO move to capture.wrapHandler()
export const handler = Sentry.AWSLambda.wrapHandler(async (params: GetJobsRequestInLambda) => {
  capture.setExtra({ params, context: lambdaName });

  const startedAt = new Date().getTime();

  const { runDate, cxId, patientId, jobType } = params;
  const log = prefixedLog(
    `runDate ${runDate} cxId ${cxId} patientId ${patientId} jobType ${jobType}`
  );

  const dbCreds = await getSecretValueOrFail(dbCredsArn, region);
  const getJobsHandler = new GetJobsDirect(dbCreds);
  await getJobsHandler.getJobs(convertToGetJobsRequest(params));

  const finishedAt = new Date().getTime();
  log(`Done local duration: ${finishedAt - startedAt}ms`);
});

function convertToGetJobsRequest(params: GetJobsRequestInLambda): GetJobsRequest {
  return {
    ...params,
    runDate: params.runDate ? new Date(params.runDate) : undefined,
  };
}
