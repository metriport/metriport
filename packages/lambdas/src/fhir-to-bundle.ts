import {
  ConsolidatedFhirToBundleRequest,
  ConsolidatedFhirToBundleResponse,
  uploadConsolidatedBundleToS3,
} from "@metriport/core/command/consolidated";
import {
  ConsolidatedFhirToBundlePayload,
  getConsolidatedFhirBundle,
} from "@metriport/core/external/fhir/consolidated";
import { out } from "@metriport/core/util/log";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";
import { apiClient } from "./shared/oss-api";

// Keep this as early on the file as possible
capture.init();

// Set by us
const apiURL = getEnvOrFail("API_URL");
const bucketName = getEnvOrFail("BUCKET_NAME");
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
}: ConsolidatedFhirToBundleRequest): Promise<ConsolidatedFhirToBundleResponse> {
  const { log } = out(`cx ${patient.cxId}, patient ${patient.id}, req ${requestId}`);
  try {
    log(
      `Running with dateFrom: ${dateFrom}, dateTo: ${dateTo}, ` +
        `documentIds: ${documentIds}, resources: ${resources}}`
    );
    const getConsolidatedParams: ConsolidatedFhirToBundlePayload = {
      patient,
      documentIds,
      resources,
      dateFrom,
      dateTo,
    };
    const bundle = await getConsolidatedFhirBundle(getConsolidatedParams);

    const { bucket, key } = await uploadConsolidatedBundleToS3({
      patient,
      requestId,
      documentIds,
      resources,
      dateFrom,
      dateTo,
      bundle,
      s3BucketName: bucketName,
    });
    const bundleInfo: ConsolidatedFhirToBundleResponse = {
      bundleLocation: bucket,
      bundleFilename: key,
    };
    if (isAsync) {
      await ossApi.postConsolidated({
        ...bundleInfo,
        patientId: patient.id,
        requestId,
        conversionType,
        resources,
        dateFrom,
        dateTo,
      });
    }
    return bundleInfo;
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
