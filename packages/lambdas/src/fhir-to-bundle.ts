import {
  ConsolidatedSnapshotRequestAsync,
  ConsolidatedSnapshotRequestSync,
  ConsolidatedSnapshotResponse,
} from "@metriport/core/command/consolidated/get-snapshot";
import { ConsolidatedSnapshotConnectorLocal } from "@metriport/core/command/consolidated/get-snapshot-local";
import { FeatureFlags } from "@metriport/core/command/feature-flags/ffs-on-dynamodb";
import { out } from "@metriport/core/util/log";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const region = getEnvOrFail("AWS_REGION");
// Set by us
const apiUrl = getEnvOrFail("API_URL");
const bucketName = getEnvOrFail("BUCKET_NAME");
const featureFlagsTableName = getEnvOrFail("FEATURE_FLAGS_TABLE_NAME");

// Call this before reading FFs
FeatureFlags.init(region, featureFlagsTableName);

/**
 * Lambdas that get invoked directly by the API have the error handling code in the API, so we don't
 * wrap them in the Sentry's wrapHandler().
 */
export async function handler(
  params: ConsolidatedSnapshotRequestSync | ConsolidatedSnapshotRequestAsync
): Promise<ConsolidatedSnapshotResponse | void> {
  const { patient, requestId, resources, dateFrom, dateTo } = params;
  const conversionType = params.isAsync ? params.conversionType : undefined;
  const { log } = out(`cx ${patient.cxId}, patient ${patient.id}, req ${requestId}`);
  try {
    log(
      `Running with dateFrom: ${dateFrom}, dateTo: ${dateTo}, conversionType: ${conversionType}` +
        `, resources: ${resources}}`
    );
    const conn = new ConsolidatedSnapshotConnectorLocal(bucketName, apiUrl);
    const result = await conn.execute(params);
    return result;
  } catch (error) {
    const msg = "Failed to get FHIR resources";
    const filters = {
      conversionType,
      resources,
      dateFrom,
      dateTo,
    };
    log(`${msg}: ${JSON.stringify(filters)}`);
    if (params.isAsync) {
      capture.error(msg, { extra: { filters, error } });
    }
    throw error;
  }
}
