import { ConsolidatedDataConnectorLocal } from "@metriport/core/command/consolidated/get-consolidated-local";
import {
  ConsolidatedSnapshotRequestAsync,
  ConsolidatedSnapshotRequestSync,
  ConsolidatedSnapshotResponse,
} from "@metriport/core/command/consolidated/get-snapshot";
import { out } from "@metriport/core/util/log";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";

// Keep this as early on the file as possible
capture.init();

// Set by us
const apiURL = getEnvOrFail("API_URL");
const bucketName = getEnvOrFail("BUCKET_NAME");

export async function handler(
  params: ConsolidatedSnapshotRequestSync | ConsolidatedSnapshotRequestAsync
): Promise<ConsolidatedSnapshotResponse | void> {
  const { patient, requestId, documentIds, resources, dateFrom, dateTo } = params;
  const conversionType = params.isAsync ? params.conversionType : undefined;
  const { log } = out(`cx ${patient.cxId}, patient ${patient.id}, req ${requestId}`);
  try {
    log(
      `Running with dateFrom: ${dateFrom}, dateTo: ${dateTo}, conversionType: ${conversionType}` +
        `, documentIds: ${documentIds}, resources: ${resources}}`
    );
    const conn = new ConsolidatedDataConnectorLocal(bucketName, apiURL);
    const result = await conn.execute(params);
    return result;
  } catch (error) {
    const msg = "Failed to get FHIR resources";
    const filters = {
      documentIds,
      conversionType,
      resources,
      dateFrom,
      dateTo,
    };
    log(`${msg}: ${JSON.stringify(filters)}`);
    throw error;
  }
}
