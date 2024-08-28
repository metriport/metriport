import { executeWithNetworkRetries, InternalSendConsolidated } from "@metriport/shared";
import axios from "axios";
import { getConsolidatedFhirBundle } from "../../external/fhir/consolidated/consolidated";
import {
  ConsolidatedDataConnector,
  ConsolidatedDataRequestAsync,
  ConsolidatedDataRequestSync,
  ConsolidatedDataResponse,
} from "./consolidated-connector";
import { uploadConsolidatedBundleToS3 } from "./consolidated-on-s3";
import { isFhirDeduplicationEnabledForCx } from "../../external/aws/app-config";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { SearchSetBundle } from "@metriport/shared/medical";
import { deduplicateFhir } from "../../fhir-deduplication/deduplicate-fhir";
import { Resource } from "@medplum/fhirtypes";
import { EventTypes, analytics } from "../../external/analytics/posthog";

const MAX_API_NOTIFICATION_ATTEMPTS = 5;

export class ConsolidatedDataConnectorLocal implements ConsolidatedDataConnector {
  constructor(private readonly bucketName: string, private readonly apiURL: string) {}

  async execute(
    params: ConsolidatedDataRequestSync | ConsolidatedDataRequestAsync
  ): Promise<ConsolidatedDataResponse> {
    let bundle = await getConsolidatedFhirBundle(params);
    const dedupEnabled = await isFhirDeduplicationEnabledForCx(params.patient.cxId);
    if (dedupEnabled) {
      const initialBundleLength = bundle.entry?.length;
      bundle = deduplicateSearchSetBundle(bundle);
      const startedAt = new Date();

      const finalBundleLength = bundle.entry?.length;

      const deduplicationAnalyticsProps = {
        distinctId: params.patient.cxId,
        event: EventTypes.fhirDeduplication,
        properties: {
          patientId: params.patient.id,
          initialBundleLength,
          finalBundleLength,
          duration: elapsedTimeFromNow(startedAt),
        },
      };
      analytics(deduplicationAnalyticsProps);
    }
    const { bucket, key } = await uploadConsolidatedBundleToS3({
      ...params,
      bundle,
      s3BucketName: this.bucketName,
    });
    const info = {
      bundleLocation: bucket,
      bundleFilename: key,
    };
    if (params.isAsync) {
      const { patient, ...decomposedParams } = params;
      await postConsolidated({
        ...decomposedParams,
        apiURL: this.apiURL,
        cxId: patient.cxId,
        patientId: patient.id,
        bundleLocation: info.bundleLocation,
        bundleFilename: info.bundleFilename,
      });
    }
    return info;
  }
}

async function postConsolidated({
  apiURL,
  cxId,
  patientId,
  ...payload
}: InternalSendConsolidated & { cxId: string; patientId: string; apiURL: string }) {
  const postConsolidated = `${apiURL}/internal/patient/${patientId}/consolidated`;
  const queryParams = new URLSearchParams({ cxId });
  await executeWithNetworkRetries(
    () => axios.post(postConsolidated + "?" + queryParams.toString(), payload),
    {
      retryOnTimeout: false,
      maxAttempts: MAX_API_NOTIFICATION_ATTEMPTS,
    }
  );
}

function deduplicateSearchSetBundle(
  fhirBundle: SearchSetBundle<Resource>
): SearchSetBundle<Resource> {
  const deduplicatedBundle = deduplicateFhir(fhirBundle);
  return {
    ...deduplicatedBundle,
    type: "searchset",
  };
}
