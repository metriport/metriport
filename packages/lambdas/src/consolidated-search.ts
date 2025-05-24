import {
  SearchConsolidatedParams,
  SearchConsolidatedResult,
} from "@metriport/core/command/consolidated/search/fhir-resource/search-consolidated";
import { SearchConsolidatedDirect } from "@metriport/core/command/consolidated/search/fhir-resource/search-consolidated-direct";
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
  async (params: SearchConsolidatedParams): Promise<SearchConsolidatedResult> => {
    const { cxId, id: patientId } = params.patient;
    const { log } = out(`cx ${cxId}, pt ${patientId}`);
    log(`Running...`);

    const opensearchPassword = await getSecretValueOrFail(openSearchPasswordSecretArn, region);
    process.env.SEARCH_PASSWORD = opensearchPassword;

    const searcher = new SearchConsolidatedDirect();
    const result = await searcher.search(params);

    log(`Done, result: ${JSON.stringify(result)}`);
    return result;
  }
);
