import {
  ConsolidatedCounterRequest,
  ConsolidatedCounterResponse,
} from "@metriport/core/command/consolidated/consolidated-counter";
import { ConsolidatedCounterImpl } from "@metriport/core/command/consolidated/consolidated-counter-impl";
import { FeatureFlags } from "@metriport/core/command/feature-flags/ffs-on-dynamodb";
import { out } from "@metriport/core/util/log";
import { errorToString } from "@metriport/shared";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const region = getEnvOrFail("AWS_REGION");
// Set by us
const featureFlagsTableName = getEnvOrFail("FEATURE_FLAGS_TABLE_NAME");

// Call this before reading FFs
FeatureFlags.init(region, featureFlagsTableName);

/**
 * Lambdas that get invoked directly by the API have the error handling code in the API, so we don't
 * wrap them in the Sentry's wrapHandler().
 */
export async function handler(
  params: ConsolidatedCounterRequest
): Promise<ConsolidatedCounterResponse> {
  const { patient, requestId, resources, dateFrom, dateTo } = params;
  const normalizedParams = {
    patientId: patient.id,
    cxId: patient.cxId,
    requestId,
    dateFrom,
    dateTo,
    resources,
  };
  capture.setExtra(normalizedParams);
  const { log } = out(`cx ${patient.cxId}, patient ${patient.id}, req ${requestId}`);
  try {
    log(`Running with dateFrom: ${dateFrom}, dateTo: ${dateTo}, resources: ${resources}`);
    const conn = new ConsolidatedCounterImpl();
    const result = await conn.execute(params);
    return result;
  } catch (error) {
    const msg = "Failed to count consolidated resources";
    log(`${msg} - params: ${JSON.stringify(normalizedParams)} - error: ${errorToString(error)}`);
    throw error;
  }
}
