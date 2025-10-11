import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { ingestCoreIntoSnowflake } from "@metriport/core/command/analytics-platform/connectors/snowflake/ingest-core-into-snowflake";
import { SnowflakeIngestorRequest } from "@metriport/core/command/analytics-platform/connectors/snowflake/snowflake-ingestor";
import { FeatureFlags } from "@metriport/core/command/feature-flags/ffs-on-dynamodb";
import {
  snowflakeSettingsForAllCxsSchema,
  snowflakeCredsSchema,
} from "@metriport/core/external/snowflake/creds";
import { controlDuration } from "@metriport/core/util/race-control";
import { errorToString, getEnvVarOrFail, MetriportError } from "@metriport/shared";
import { Context, SNSEvent } from "aws-lambda";
import { z } from "zod";
import { capture } from "../../shared/capture";
import { prefixedLog } from "../../shared/log";
import { parseBody } from "../../shared/parse-body";

// Keep this as early on the file as possible
capture.init();

/**
 * Lambda to ingest data from S3 into Snowflake.
 *
 * It's triggered by the core-to-dwh lambda, for customers that have the connector enabled.
 */

// Automatically set by AWS
const lambdaName = getEnvVarOrFail("AWS_LAMBDA_FUNCTION_NAME");
const region = getEnvVarOrFail("AWS_REGION");
// Set by us
const featureFlagsTableName = getEnvVarOrFail("FEATURE_FLAGS_TABLE_NAME");
const analyticsBucketName = getEnvVarOrFail("ANALYTICS_BUCKET_NAME");
const snowflakeCredsForAllRegionsSecretArn = getEnvVarOrFail("SNOWFLAKE_CREDS_FOR_ALL_REGIONS_ARN");
const snowflakeSettingsForAllCxsSecretArn = getEnvVarOrFail("SNOWFLAKE_SETTINGS_FOR_ALL_CXS_ARN");

FeatureFlags.init(region, featureFlagsTableName);

// TODO change this to be a SQS event
export const handler = capture.wrapHandler(async (event: SNSEvent, context: Context) => {
  capture.setExtra({ event, context: lambdaName });

  const message = event.Records[0]?.Sns?.Message;
  if (!message) {
    throw new MetriportError("No SNS message found in event", undefined, {
      event: JSON.stringify(event),
    });
  }

  try {
    console.log(`Processing message: ${JSON.stringify(message)}`);
    const parsedBody: SnowflakeIngestorRequest = parseBody(
      snowflakeConnectorRequestSchema,
      message
    );
    const { cxId } = parsedBody;

    const log = prefixedLog(`cxId ${cxId}`);
    log(`Parsed: ${JSON.stringify(parsedBody)}`);

    const snowflakeCredsForAllRegionsRaw = await (getSecret(
      snowflakeCredsForAllRegionsSecretArn
    ) as Promise<string | undefined>);
    if (!snowflakeCredsForAllRegionsRaw) {
      throw new MetriportError(`Snowflake creds not found`, undefined, {
        secretArn: snowflakeCredsForAllRegionsSecretArn,
      });
    }
    const snowflakeCredsForAllRegions = snowflakeCredsSchema.parse(
      JSON.parse(snowflakeCredsForAllRegionsRaw)
    );

    const snowflakeSettingsForAllCxsRaw = await (getSecret(
      snowflakeSettingsForAllCxsSecretArn
    ) as Promise<string | undefined>);
    if (!snowflakeSettingsForAllCxsRaw) {
      throw new MetriportError(`Snowflake customer config not found`, undefined, {
        secretArn: snowflakeSettingsForAllCxsSecretArn,
      });
    }
    const snowflakeSettingsForAllCxs = snowflakeSettingsForAllCxsSchema.parse(
      JSON.parse(snowflakeSettingsForAllCxsRaw)
    );

    const remainingLambdaExecutionTime = Math.max(0, context.getRemainingTimeInMillis() - 200);

    log(`Invoking ingestCoreIntoSnowflake... it has ${remainingLambdaExecutionTime}ms to run`);
    const startedAt = Date.now();

    const timedOutResp = "Timeout";
    const resp = await Promise.race([
      ingestCoreIntoSnowflake({
        cxId,
        bucketName: analyticsBucketName,
        region,
        snowflakeCredsForAllRegions,
        snowflakeSettingsForAllCxs,
      }),
      controlDuration(remainingLambdaExecutionTime, timedOutResp),
    ]);
    if (resp === timedOutResp) {
      throw new MetriportError("Timeout calling ingestCoreIntoSnowflake", undefined, { cxId });
    }

    log(`Done in ${Date.now() - startedAt}ms`);
  } catch (error) {
    console.error("Re-throwing error ", errorToString(error));
    throw error;
  }
});

const snowflakeConnectorRequestSchema = z.object({
  cxId: z.string(),
});
