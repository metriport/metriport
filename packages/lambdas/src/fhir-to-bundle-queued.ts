import {
  ConsolidatedSnapshotRequestAsync,
  ConsolidatedSnapshotRequestSync,
} from "@metriport/core/command/consolidated/get-snapshot";
import { ConsolidatedSnapshotConnectorLocal } from "@metriport/core/command/consolidated/get-snapshot-local";
import { FeatureFlags } from "@metriport/core/command/feature-flags/ffs-on-dynamodb";
import { out } from "@metriport/core/util/log";
import { SQSEvent } from "aws-lambda";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";
import { getSingleMessageOrFail } from "./shared/sqs";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const region = getEnvOrFail("AWS_REGION");
const lambdaName = process.env.AWS_LAMBDA_FUNCTION_NAME ?? "FhirToBundleQueued";
// Set by us
const apiUrl = getEnvOrFail("API_URL");
const bucketName = getEnvOrFail("BUCKET_NAME");
const featureFlagsTableName = getEnvOrFail("FEATURE_FLAGS_TABLE_NAME");

// Call this before reading FFs
FeatureFlags.init(region, featureFlagsTableName);

/**
 * SQS handler for processing consolidated snapshot requests from the queue.
 * Used by oncall for bulk operations without overwhelming the system.
 * Throttling is controlled via maxConcurrency on the SQS event source.
 */
export const handler = capture.wrapHandler(async (event: SQSEvent): Promise<void> => {
  const message = getSingleMessageOrFail(event.Records, lambdaName);
  if (!message) return;

  const params = parseBody(message.body);
  const { patient, requestId, resources, dateFrom, dateTo } = params;
  const conversionType = params.isAsync ? params.conversionType : undefined;
  const { log } = out(`cx ${patient.cxId}, patient ${patient.id}, req ${requestId}`);

  try {
    log(
      `Running with dateFrom: ${dateFrom}, dateTo: ${dateTo}, conversionType: ${conversionType}` +
        `, resources: ${resources}}`
    );
    const conn = new ConsolidatedSnapshotConnectorLocal(bucketName, apiUrl);
    await conn.execute(params);
  } catch (error) {
    const msg = "Failed to get FHIR resources";
    const filters = {
      conversionType,
      resources,
      dateFrom,
      dateTo,
    };
    log(`${msg}: ${JSON.stringify(filters)}`);
    capture.error(msg, { extra: { filters, error } });
    throw error;
  }
});

function parseBody(
  body: string
): ConsolidatedSnapshotRequestSync | ConsolidatedSnapshotRequestAsync {
  if (!body) throw new Error(`Missing message body`);
  const bodyAsJson = JSON.parse(body);
  return bodyAsJson as ConsolidatedSnapshotRequestSync | ConsolidatedSnapshotRequestAsync;
}
