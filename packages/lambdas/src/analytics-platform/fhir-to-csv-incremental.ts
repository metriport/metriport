import { FhirToCsvIncrementalDirect } from "@metriport/core/command/analytics-platform/fhir-to-csv/command/fhir-to-csv-incremental/fhir-to-csv-incremental-direct";
import { doesConsolidatedDataExist } from "@metriport/core/command/consolidated/consolidated-get";
import { FeatureFlags } from "@metriport/core/command/feature-flags/ffs-on-dynamodb";
import { errorToString, getEnvVarOrFail, MetriportError } from "@metriport/shared";
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
const analyticsBucketName = getEnvVarOrFail("ANALYTICS_S3_BUCKET");

FeatureFlags.init(region, featureFlagsTableName);

export const handler = capture.wrapHandler(async (event: SQSEvent, context: Context) => {
  capture.setExtra({ event, context: lambdaName });

  const message = getSingleMessageOrFail(event.Records, lambdaName);
  if (!message) return;
  try {
    const parsedBody = parseBody(fhirToCsvSchema, message.body);
    const { jobId, cxId, patientId } = parsedBody;

    const log = prefixedLog(`jobId ${jobId}, cxId ${cxId}, patientId ${patientId}`);
    log(`Parsed: ${JSON.stringify(parsedBody)}`);

    const doesPatientHaveConsolidatedBundle = await doesConsolidatedDataExist(cxId, patientId);
    if (!doesPatientHaveConsolidatedBundle) {
      const msg = `Patient does not have a consolidated bundle`;
      log(msg);
      throw new MetriportError(msg, undefined, { cxId, patientId, jobId });
    }

    const timeoutForCsvTransform = Math.max(0, context.getRemainingTimeInMillis() - 200);

    log(`Invoking lambda ${lambdaName}... it has ${timeoutForCsvTransform}ms to run`);
    const startedAt = Date.now();
    const fhirToCsvHandler = new FhirToCsvIncrementalDirect(analyticsBucketName, region);
    await fhirToCsvHandler.processFhirToCsvIncremental({
      ...parsedBody,
      timeoutInMillis: timeoutForCsvTransform,
    });
    log(`Done in ${Date.now() - startedAt}ms`);
  } catch (error) {
    console.error("Re-throwing error ", errorToString(error));
    throw error;
  }
});

const fhirToCsvSchema = z.object({
  cxId: z.string(),
  jobId: z.string(),
  patientId: z.string(),
});
