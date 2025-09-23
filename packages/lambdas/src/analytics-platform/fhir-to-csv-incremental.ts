import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { dbCredsForLambdaSchema } from "@metriport/core/command/analytics-platform/config";
import { FhirToCsvIncrementalDirect } from "@metriport/core/command/analytics-platform/fhir-to-csv/command/fhir-to-csv-incremental/fhir-to-csv-incremental-direct";
import { ProcessFhirToCsvIncrementalDirectRequest } from "@metriport/core/command/analytics-platform/fhir-to-csv/command/incremental/fhir-to-csv-incremental-direct";
import { readConfigs } from "@metriport/core/command/analytics-platform/fhir-to-csv/configs/read-column-defs";
import { doesConsolidatedDataExist } from "@metriport/core/command/consolidated/consolidated-get";
import { FeatureFlags } from "@metriport/core/command/feature-flags/ffs-on-dynamodb";
import { DbCreds, errorToString, getEnvVarOrFail, MetriportError } from "@metriport/shared";
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
const dbCredsRaw = getEnvVarOrFail("DB_CREDS");
const dbCreds = dbCredsForLambdaSchema.parse(JSON.parse(dbCredsRaw));

FeatureFlags.init(region, featureFlagsTableName);

export const handler = capture.wrapHandler(async (event: SQSEvent, context: Context) => {
  capture.setExtra({ event, context: lambdaName });

  const message = getSingleMessageOrFail(event.Records, lambdaName);
  if (!message) return;
  try {
    const parsedBody = parseBody(fhirToCsvSchema, message.body);
    const { cxId, patientId } = parsedBody;

    // read the db user password from the secret
    const dbPassword = await (getSecret(dbCreds.passwordSecretArn) as Promise<string>);

    const log = prefixedLog(`cxId ${cxId}, patientId ${patientId}`);
    log(`Parsed: ${JSON.stringify(parsedBody)}`);

    const doesPatientHaveConsolidatedBundle = await doesConsolidatedDataExist(cxId, patientId);
    if (!doesPatientHaveConsolidatedBundle) {
      const msg = `Patient does not have a consolidated bundle`;
      log(msg);
      throw new MetriportError(msg, undefined, { cxId, patientId });
    }

    log(`Reading table definitions from /opt/configurations`);
    const tableDefs = readConfigs(`/opt/configurations`);

    const timeoutForCsvTransform = Math.max(0, context.getRemainingTimeInMillis() - 200);
    const dbCredsForFunction: DbCreds = {
      host: dbCreds.host,
      port: dbCreds.port,
      dbname: dbCreds.dbname,
      username: dbCreds.username,
      engine: dbCreds.engine,
      password: dbPassword,
    };

    log(`Invoking lambda ${lambdaName}... it has ${timeoutForCsvTransform}ms to run`);
    const startedAt = Date.now();
    const fhirToCsvHandler = new FhirToCsvIncrementalDirect(
      analyticsBucketName,
      region,
      dbCredsForFunction
    );
    const params: ProcessFhirToCsvIncrementalDirectRequest = {
      ...parsedBody,
      tableDefs,
      timeoutInMillis: timeoutForCsvTransform,
    };
    await fhirToCsvHandler.processFhirToCsvIncremental(params);
    log(`Done in ${Date.now() - startedAt}ms`);
  } catch (error) {
    console.error("Re-throwing error ", errorToString(error));
    throw error;
  }
});

const fhirToCsvSchema = z.object({
  cxId: z.string(),
  patientId: z.string(),
});
