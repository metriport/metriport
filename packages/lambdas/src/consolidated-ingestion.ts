import { IngestConsolidatedParams } from "@metriport/core/command/consolidated/search/fhir-resource/ingest-consolidated";
import { IngestConsolidatedDirect } from "@metriport/core/command/consolidated/search/fhir-resource/ingest-consolidated-direct";
import { FeatureFlags } from "@metriport/core/command/feature-flags/ffs-on-dynamodb";
import { getSecretValueOrFail } from "@metriport/core/external/aws/secret-manager";
import { out } from "@metriport/core/util/log";
import { getEnvVarOrFail } from "@metriport/shared/common/env-var";
import { SQSEvent } from "aws-lambda";
import { capture } from "./shared/capture";
import { parseCxId, parsePatientId } from "./shared/parse-body";
import { getSingleMessageOrFail } from "./shared/sqs";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const region = getEnvVarOrFail("AWS_REGION");
const lambdaName = getEnvVarOrFail("AWS_LAMBDA_FUNCTION_NAME");
// Set by us
const featureFlagsTableName = getEnvVarOrFail("FEATURE_FLAGS_TABLE_NAME");
const openSearchPasswordSecretArn = getEnvVarOrFail("SEARCH_PASSWORD_SECRET_ARN");

FeatureFlags.init(region, featureFlagsTableName);

export const handler = capture.wrapHandler(async (event: SQSEvent): Promise<void> => {
  const message = getSingleMessageOrFail(event.Records, lambdaName);
  if (!message) return;

  const params = parseBody(message.body);
  const { cxId, patientId } = params;
  const { log } = out(`cx ${cxId}, pt ${patientId}`);

  const opensearchPassword = await getSecretValueOrFail(openSearchPasswordSecretArn, region);
  process.env.SEARCH_PASSWORD = opensearchPassword;
  log(`Got opensearch password, running ingestion...`);

  const ingester = new IngestConsolidatedDirect();
  await ingester.ingestConsolidatedIntoSearchEngine(params);

  log(`Done.`);
});

function parseBody(body: string): IngestConsolidatedParams {
  if (!body) throw new Error(`Missing message body`);

  const bodyString = typeof body === "string" ? (body as string) : undefined;
  if (!bodyString) throw new Error(`Invalid body`);

  const bodyAsJson = JSON.parse(bodyString);

  const cxId = parseCxId(bodyAsJson);
  const patientId = parsePatientId(bodyAsJson);

  return { cxId, patientId };
}
