import { Resource } from "@medplum/fhirtypes";
import { executeWithNetworkRetries, InternalSendConsolidated } from "@metriport/shared";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { SearchSetBundle } from "@metriport/shared/medical";
import axios from "axios";
import { analytics, EventTypes } from "../../external/analytics/posthog";
import { getConsolidatedFhirBundle } from "../../external/fhir/consolidated/consolidated";
import { deduplicateFhir } from "../../fhir-deduplication/deduplicate-fhir";
import {
  ConsolidatedDataConnector,
  ConsolidatedDataRequestAsync,
  ConsolidatedDataRequestSync,
  ConsolidatedDataResponse,
} from "./consolidated-connector";
import { uploadConsolidatedBundleToS3 } from "./consolidated-on-s3";

const MAX_API_NOTIFICATION_ATTEMPTS = 5;

export class ConsolidatedDataConnectorLocal implements ConsolidatedDataConnector {
  constructor(private readonly bucketName: string, private readonly apiURL: string) {}

  async execute(
    params: ConsolidatedDataRequestSync | ConsolidatedDataRequestAsync
  ): Promise<ConsolidatedDataResponse> {
    const { cxId, id: patientId } = params.patient;

    const [originalBundle] = await Promise.all([getConsolidatedFhirBundle(params)]);

    const dedupEnabled = true;
    const dedupedBundle = deduplicate({ cxId, patientId, bundle: originalBundle });

    const [originalS3Info, dedupedS3Info] = await Promise.all([
      uploadConsolidatedBundleToS3({
        ...params,
        s3BucketName: this.bucketName,
        bundle: originalBundle,
      }),
      uploadConsolidatedBundleToS3({
        ...params,
        s3BucketName: this.bucketName,
        bundle: dedupedBundle,
        isDeduped: true,
      }),
    ]);

    const { bucket, key } = dedupEnabled ? dedupedS3Info : originalS3Info;

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

function deduplicate({
  cxId,
  patientId,
  bundle,
}: {
  cxId: string;
  patientId: string;
  bundle: SearchSetBundle<Resource>;
}): SearchSetBundle<Resource> {
  const startedAt = new Date();
  const dedupedBundle = deduplicateSearchSetBundle(bundle);

  const deduplicationAnalyticsProps = {
    distinctId: cxId,
    event: EventTypes.fhirDeduplication,
    properties: {
      patientId: patientId,
      initialBundleLength: bundle.entry?.length,
      finalBundleLength: dedupedBundle.entry?.length,
      duration: elapsedTimeFromNow(startedAt),
    },
  };
  analytics(deduplicationAnalyticsProps);
  return dedupedBundle;
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
