import { IngestConsolidatedParams } from "@metriport/core/command/consolidated/search/fhir-resource/ingest-consolidated";
import { IngestConsolidatedDirect } from "@metriport/core/command/consolidated/search/fhir-resource/ingest-consolidated-direct";
import { FeatureFlags } from "@metriport/core/command/feature-flags/ffs-on-dynamodb";
import { getSecretValueOrFail } from "@metriport/core/external/aws/secret-manager";
import { out } from "@metriport/core/util/log";
import { getEnvVarOrFail } from "@metriport/shared/common/env-var";
import { capture } from "./shared/capture";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const region = getEnvVarOrFail("AWS_REGION");
// Set by us
const featureFlagsTableName = getEnvVarOrFail("FEATURE_FLAGS_TABLE_NAME");
const openSearchPasswordSecretArn = getEnvVarOrFail("SEARCH_PASSWORD_SECRET_ARN");

FeatureFlags.init(region, featureFlagsTableName);

export const handler = capture.wrapHandler(
  async (params: IngestConsolidatedParams): Promise<void> => {
    const { cxId, patientId } = params;
    const { log } = out(`cx ${cxId}, pt ${patientId}`);
    log(`Running...`);

    const opensearchPassword = await getSecretValueOrFail(openSearchPasswordSecretArn, region);
    process.env.SEARCH_PASSWORD = opensearchPassword;

    const ingester = new IngestConsolidatedDirect();
    await ingester.ingestIntoSearchEngine(params);

    log(`Done.`);
  }
);
