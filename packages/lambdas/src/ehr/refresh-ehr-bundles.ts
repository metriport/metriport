import { EhrRefreshEhrBundlesDirect } from "@metriport/core/external/ehr/job/bundle/create-resource-diff-bundles/steps/refresh/ehr-refresh-ehr-bundles-direct";
import { getEnvAsIntOrFail } from "@metriport/shared";
import { SQSEvent } from "aws-lambda";
import { capture } from "../shared/capture";
import { ehrCreateResourceDiffBundlesSchema } from "../shared/ehr";
import { getEnvOrFail } from "../shared/env";
import { prefixedLog } from "../shared/log";
import { parseBody } from "../shared/parse-body";
import { getSingleMessageOrFail } from "../shared/sqs";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");
// Set by us
const waitTimeInMillis = getEnvAsIntOrFail("WAIT_TIME_IN_MILLIS");
const maxAttempts = getEnvAsIntOrFail("MAX_ATTEMPTS");

export const handler = capture.wrapHandler(async (event: SQSEvent) => {
  capture.setExtra({ event, context: lambdaName });

  const startedAt = new Date().getTime();
  const message = getSingleMessageOrFail(event.Records, lambdaName);
  if (!message) return;

  const parsedBody = parseBody(ehrCreateResourceDiffBundlesSchema, message.body);
  const { metriportPatientId, ehrPatientId, jobId } = parsedBody;

  const log = prefixedLog(
    `metriportPatientId ${metriportPatientId}, ehrPatientId ${ehrPatientId}, jobId ${jobId}`
  );

  const receiveCount = parseInt(message.attributes.ApproximateReceiveCount);
  const reportError = receiveCount >= maxAttempts;
  log(`Receive count: ${receiveCount}, max attempts: ${maxAttempts}, reportError: ${reportError}`);

  const ehrRefreshEhrBundlesHandler = new EhrRefreshEhrBundlesDirect(waitTimeInMillis);
  await ehrRefreshEhrBundlesHandler.refreshEhrBundles({ ...parsedBody, reportError });

  const finishedAt = new Date().getTime();
  log(`Done local duration: ${finishedAt - startedAt}ms`);
});
