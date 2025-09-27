import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { ProcessCoreTransformRequest } from "@metriport/core/command/analytics-platform/core-transform/coordinator/core-transform";
import { CoreTransformDirect } from "@metriport/core/command/analytics-platform/core-transform/coordinator/core-transform-direct";
import { FeatureFlags } from "@metriport/core/command/feature-flags/ffs-on-dynamodb";
import { controlDuration } from "@metriport/core/util/race-control";
import { dbCredsSchema, errorToString, getEnvVarOrFail, MetriportError } from "@metriport/shared";
import { Context, SQSEvent } from "aws-lambda";
import { z } from "zod";
import { capture } from "../shared/capture";
import { prefixedLog } from "../shared/log";
import { parseBody } from "../shared/parse-body";
import { getSingleMessageOrFail } from "../shared/sqs";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvVarOrFail("AWS_LAMBDA_FUNCTION_NAME");
const region = getEnvVarOrFail("AWS_REGION");
// Set by us
const featureFlagsTableName = getEnvVarOrFail("FEATURE_FLAGS_TABLE_NAME");
const analyticsBucketName = getEnvVarOrFail("ANALYTICS_BUCKET_NAME");
const rawToCoreLambdaName = getEnvVarOrFail("RAW_TO_CORE_TRANSFORM_LAMBDA_NAME");
const dbCredsSecretArn = getEnvVarOrFail("DB_CREDS_ARN");

FeatureFlags.init(region, featureFlagsTableName);

export const handler = capture.wrapHandler(async (event: SQSEvent, context: Context) => {
  capture.setExtra({ event, context: lambdaName });

  const message = getSingleMessageOrFail(event.Records, lambdaName);
  if (!message) return;
  try {
    const parsedBody = parseBody(coreTransformSchema, message.body);
    const { cxId } = parsedBody;

    const log = prefixedLog(`cxId ${cxId}`);
    log(`Parsed: ${JSON.stringify(parsedBody)}`);

    const dbCredsRaw = await (getSecret(dbCredsSecretArn) as Promise<string | undefined>);
    if (!dbCredsRaw) {
      throw new MetriportError(`DB password not found`, undefined, {
        secretArn: dbCredsSecretArn,
      });
    }
    const dbCreds = dbCredsSchema.parse(JSON.parse(dbCredsRaw));

    const remainingLambdaExecutionTime = Math.max(0, context.getRemainingTimeInMillis() - 200);

    log(`Invoking processCoreTransform... it has ${remainingLambdaExecutionTime}ms to run`);
    const startedAt = Date.now();
    const coreTransformHandler = new CoreTransformDirect(
      analyticsBucketName,
      region,
      dbCreds,
      rawToCoreLambdaName
    );
    const params: ProcessCoreTransformRequest = {
      cxId,
    };
    const timedOutResp = "Timeout";
    const resp = await Promise.race([
      coreTransformHandler.processCoreTransform(params),
      controlDuration(remainingLambdaExecutionTime, timedOutResp),
    ]);
    if (resp === timedOutResp) {
      throw new MetriportError("Timeout calling processCoreTransform", undefined, {
        cxId,
      });
    }
    log(`Done in ${Date.now() - startedAt}ms`);
  } catch (error) {
    console.error("Re-throwing error ", errorToString(error));
    throw error;
  }
});

const coreTransformSchema = z.object({
  cxId: z.string(),
});
