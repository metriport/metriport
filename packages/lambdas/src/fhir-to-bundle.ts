import { Resource } from "@medplum/fhirtypes";
import { ConsolidatedFhirToBundlePayloadLambda } from "@metriport/core/command/consolidated";
import { getConsolidatedFhirBundle } from "@metriport/core/external/fhir/consolidated";
import { out } from "@metriport/core/util/log";
import { SearchSetBundle } from "@metriport/shared/medical";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";
import { apiClient } from "./shared/oss-api";

// Keep this as early on the file as possible
capture.init();

const apiURL = getEnvOrFail("API_URL");
const ossApi = apiClient(apiURL);

export async function handler({
  patient,
  requestId,
  conversionType,
  documentIds,
  resources,
  dateFrom,
  dateTo,
  isAsync,
}: ConsolidatedFhirToBundlePayloadLambda): Promise<SearchSetBundle<Resource> | void> {
  const { log } = out(`cx ${patient.cxId}, patient ${patient.id}, req ${requestId}`);
  try {
    log(
      `Running with dateFrom: ${dateFrom}, dateTo: ${dateTo}, ` +
        `documentIds: ${documentIds}, resources: ${resources}}`
    );
    const bundle = await getConsolidatedFhirBundle({
      patient,
      documentIds,
      resources,
      dateFrom,
      dateTo,
    });
    if (isAsync) {
      await ossApi.postConsolidated({
        patientId: patient.id,
        bundle,
        requestId,
        conversionType,
        resources,
        dateFrom,
        dateTo,
      });
      return;
    }
    return bundle;
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
