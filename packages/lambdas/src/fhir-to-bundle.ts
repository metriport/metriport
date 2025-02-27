import {
  ConsolidatedSnapshotRequestAsync,
  ConsolidatedSnapshotRequestSync,
  ConsolidatedSnapshotResponse,
} from "@metriport/core/command/consolidated/get-snapshot";
import { ConsolidatedSnapshotConnectorLocal } from "@metriport/core/command/consolidated/get-snapshot-local";
import { getSecretValue } from "@metriport/core/external/aws/secret-manager";
import { out } from "@metriport/core/util/log";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";

// Keep this as early on the file as possible
capture.init();

// Set by us
const apiUrl = getEnvOrFail("API_URL");
const bucketName = getEnvOrFail("BUCKET_NAME");
const region = getEnvOrFail("AWS_REGION");
const postHogSecretName = getEnvOrFail("POST_HOG_API_KEY_SECRET");

export async function handler(
  params: ConsolidatedSnapshotRequestSync | ConsolidatedSnapshotRequestAsync
): Promise<ConsolidatedSnapshotResponse | void> {
  const postHogApiKey = await getSecretValue(postHogSecretName, region);
  const { patient, requestId, resources, dateFrom, dateTo } = params;
  const conversionType = params.isAsync ? params.conversionType : undefined;
  const { log } = out(`cx ${patient.cxId}, patient ${patient.id}, req ${requestId}`);

  try {
    log(
      `Running with dateFrom: ${dateFrom}, dateTo: ${dateTo}, conversionType: ${conversionType}` +
        `, resources: ${resources}}`
    );
    const conn = new ConsolidatedSnapshotConnectorLocal(bucketName, apiUrl);
    const result = await conn.execute({ ...params, postHogApiKey });
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
    throw error;
  }
}
