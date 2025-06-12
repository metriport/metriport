import { GetJobsRequest } from "@metriport/core/command/job/patient/job/start-jobs/steps/get/get-jobs";
import { GetJobsDirect } from "@metriport/core/command/job/patient/job/start-jobs/steps/get/get-jobs-direct";
import { getSecretValueOrFail } from "@metriport/core/external/aws/secret-manager";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { buildDayjs } from "@metriport/shared/common/date";
import { capture } from "../../shared/capture";
import { getEnvOrFail } from "../../shared/env";

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

export const handler = capture.wrapHandler(async (params: GetJobsRequestInLambda) => {
  capture.setExtra({ params, context: lambdaName });
  const dbCreds = await getSecretValueOrFail(dbCredsArn, region);
  const getJobsHandler = new GetJobsDirect(dbCreds);
  await getJobsHandler.getJobs(convertToGetJobsRequest(params));
});

function convertToGetJobsRequest(params: GetJobsRequestInLambda): GetJobsRequest {
  return {
    ...params,
    runDate: params.runDate ? buildDayjs(params.runDate).toDate() : undefined,
  };
}
