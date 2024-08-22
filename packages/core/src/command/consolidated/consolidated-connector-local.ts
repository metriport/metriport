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
import { deduplicateFhir } from "../../fhir-deduplication/deduplicate-fhir";
import { SearchSetBundle } from "@metriport/shared/medical";
import { Resource } from "@medplum/fhirtypes";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { EventTypes, analytics } from "../../external/analytics/posthog";
import { getFeatureFlagValueStringArray } from "../../external/aws/app-config";
import { getEnvVarOrFail } from "../../util/env-var";
import { Config } from "../../util/config";
import { capture } from "../../util/notifications";

const MAX_API_NOTIFICATION_ATTEMPTS = 5;

const region = getEnvVarOrFail("AWS_REGION");
const appConfigAppID = getEnvVarOrFail("APPCONFIG_APPLICATION_ID");
const appConfigConfigID = getEnvVarOrFail("APPCONFIG_CONFIGURATION_ID");

export class ConsolidatedDataConnectorLocal implements ConsolidatedDataConnector {
  constructor(private readonly bucketName: string, private readonly apiURL: string) {}

  async execute(
    params: ConsolidatedDataRequestSync | ConsolidatedDataRequestAsync
  ): Promise<ConsolidatedDataResponse> {
    let bundle = await getConsolidatedFhirBundle(params);
    //here
    const startedAt = new Date();
    const initialBundleLength = bundle.entry?.length;

    if (await isFhirDeduplicationEnabledForCx(params.patient.cxId)) {
      bundle = deduplicateSearchSetBundle(bundle);
    }
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

async function isFhirDeduplicationEnabledForCx(cxId: string): Promise<boolean> {
  const cxIdsWithFhirDedupEnabled = await getCxsWithFhirDedupFeatureFlag();
  return cxIdsWithFhirDedupEnabled.some(i => i === cxId);
}

async function getCxsWithFhirDedupFeatureFlag(): Promise<string[]> {
  try {
    const featureFlag = await getFeatureFlagValueStringArray(
      region,
      appConfigAppID,
      appConfigConfigID,
      Config.getEnvType(),
      "cxsWithFhirDedupFeatureFlag"
    );

    if (featureFlag?.enabled && featureFlag?.values) return featureFlag.values;
  } catch (error) {
    const msg = `Failed to get Feature Flag Value`;
    const extra = { featureFlagName: "cxsWithAiBriefFeatureFlag" };
    capture.error(msg, { extra: { ...extra, error } });
  }

  return [];
}
