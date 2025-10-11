import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { coreTransformJobPrefix } from "@metriport/core/command/analytics-platform/core-transfom/command/core-transform";
import { exportCoreToS3 } from "@metriport/core/command/analytics-platform/core-transform/core-to-s3";
import { FeatureFlags } from "@metriport/core/command/feature-flags/ffs-on-dynamodb";
import { dbCredsSchema, errorToString, getEnvVarOrFail, MetriportError } from "@metriport/shared";
import { Context, SNSEvent } from "aws-lambda";
import { z } from "zod";
import { capture } from "../shared/capture";
import { prefixedLog } from "../shared/log";
import { parseBody } from "../shared/parse-body";

// Keep this as early on the file as possible
capture.init();

/**
 * Lambda to export the core data to S3.
 *
 * It's triggered by the core transform job completion topic, through a SNS event.
 */

// Automatically set by AWS
const lambdaName = getEnvVarOrFail("AWS_LAMBDA_FUNCTION_NAME");
const region = getEnvVarOrFail("AWS_REGION");
// Set by us
const featureFlagsTableName = getEnvVarOrFail("FEATURE_FLAGS_TABLE_NAME");
const analyticsBucketName = getEnvVarOrFail("ANALYTICS_BUCKET_NAME");
const dbCredsSecretArn = getEnvVarOrFail("DB_CREDS_ARN");

FeatureFlags.init(region, featureFlagsTableName);

export const handler = capture.wrapHandler(async (event: SNSEvent, context: Context) => {
  capture.setExtra({ event, context: lambdaName });

  // SNS events contain a single messages
  const message = event.Records[0]?.Sns?.Message;
  if (!message) {
    throw new MetriportError("No SNS message found in event", undefined, {
      event: JSON.stringify(event),
    });
  }

  try {
    console.log(`Processing message: ${JSON.stringify(message)}`);
    const parsedBody = parseBody(coreToS3Schema, message);
    const { cxId, jobStatus, jobName } = parsedBody;

    const log = prefixedLog(`cxId ${cxId}`);
    log(`Parsed: ${JSON.stringify(parsedBody)}`);

    if (jobStatus !== "SUCCEEDED") {
      log(`Job status is not SUCCEEDED, skipping`);
      return;
    }
    if (!jobName.startsWith(coreTransformJobPrefix)) {
      log(`Job name is not a core transform job, skipping`);
      return;
    }

    const dbCredsRaw = await (getSecret(dbCredsSecretArn) as Promise<string | undefined>);
    if (!dbCredsRaw) {
      throw new MetriportError(`DB creds not found`, undefined, { secretArn: dbCredsSecretArn });
    }
    const dbCreds = dbCredsSchema.parse(JSON.parse(dbCredsRaw));

    const remainingLambdaExecutionTime = Math.max(0, context.getRemainingTimeInMillis() - 200);

    log(`Invoking exportCoreToS3... it has ${remainingLambdaExecutionTime}ms to run`);
    const startedAt = Date.now();

    await exportCoreToS3({
      cxId,
      analyticsBucketName,
      region,
      dbCreds,
    });

    // TODO ENG-954 Call Snowflake Lambda (or put on SNS if time allows)

    log(`Done in ${Date.now() - startedAt}ms`);
  } catch (error) {
    console.error("Re-throwing error ", errorToString(error));
    throw error;
  }
});

// See setupCoreTransformJobCompletion on analytics-platform-stack.ts
const coreToS3Schema = z.object({
  cxId: z.string(),
  jobId: z.string(),
  jobName: z.string(),
  /**
   * SUCCEEDED, FAILED
   * @see https://docs.aws.amazon.com/batch/latest/userguide/job_states.html
   */
  jobStatus: z.enum([
    "SUCCEEDED",
    "FAILED",
    "SUBMITTED",
    "PENDING",
    "RUNNABLE",
    "STARTING",
    "RUNNING",
  ]),
  // jobDefinition: z.string().optional(),
  // jobQueue: z.string().optional(),
  // startedAt: z.number().optional(), // timestamp
  // stoppedAt: z.number().optional(), // timestamp
  // timestamp: z.string().optional(), // ISO string
});
