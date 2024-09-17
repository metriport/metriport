import { Bundle, Resource } from "@medplum/fhirtypes";
import { executeWithNetworkRetries, InternalSendConsolidated } from "@metriport/shared";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import axios from "axios";
import { analytics, EventTypes } from "../../external/analytics/posthog";
import { isConsolidatedFromS3Enabled } from "../../external/aws/app-config";
import { getConsolidatedFhirBundle as getConsolidatedFromFhirServer } from "../../external/fhir/consolidated/consolidated";
import { deduplicateFhir } from "../../fhir-deduplication/deduplicate-fhir";
import { out } from "../../util";
import { getConsolidatedFromS3 } from "./consolidated-filter";
import {
  ConsolidatedSnapshotConnector,
  ConsolidatedSnapshotRequestAsync,
  ConsolidatedSnapshotRequestSync,
  ConsolidatedSnapshotResponse,
} from "./get-snapshot";
import { uploadConsolidatedSnapshotToS3 } from "./snapshot-on-s3";

const MAX_API_NOTIFICATION_ATTEMPTS = 5;

export class ConsolidatedSnapshotConnectorLocal implements ConsolidatedSnapshotConnector {
  constructor(private readonly bucketName: string, private readonly apiURL: string) {}

  async execute(
    params: ConsolidatedSnapshotRequestSync | ConsolidatedSnapshotRequestAsync
  ): Promise<ConsolidatedSnapshotResponse> {
    const { cxId, id: patientId } = params.patient;

    const originalBundle = await getBundle(params);
    const dedupedBundle = deduplicate({ cxId, patientId, bundle: originalBundle });

    const [, dedupedS3Info] = await Promise.all([
      uploadConsolidatedSnapshotToS3({
        ...params,
        s3BucketName: this.bucketName,
        bundle: originalBundle,
      }),
      uploadConsolidatedSnapshotToS3({
        ...params,
        s3BucketName: this.bucketName,
        bundle: dedupedBundle,
        isDeduped: true,
      }),
    ]);

    const { bucket, key } = dedupedS3Info;
    const info = {
      bundleLocation: bucket,
      bundleFilename: key,
    };
    if (params.isAsync) {
      const { patient, ...decomposedParams } = params;
      await postSnapshotToApi({
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

async function getBundle(
  params: ConsolidatedSnapshotRequestSync | ConsolidatedSnapshotRequestAsync
): Promise<Bundle<Resource>> {
  const { cxId, id: patientId } = params.patient;
  const isGetFromS3 = await isConsolidatedFromS3Enabled();
  const { log } = out(`getBundle - fromS3: ${isGetFromS3}`);
  if (isGetFromS3) {
    const startedAt = new Date();
    const consolidatedBundle = await getConsolidatedFromS3({ cxId, patientId, ...params });
    if (consolidatedBundle) {
      log(`(from S3) Took ${elapsedTimeFromNow(startedAt)}ms`);
      return consolidatedBundle;
    }
  }
  const startedAt = new Date();
  const originalBundle = await getConsolidatedFromFhirServer(params);
  log(`(from FHIR) Took ${elapsedTimeFromNow(startedAt)}ms`);
  return originalBundle;
}

async function postSnapshotToApi({
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
  bundle: Bundle<Resource>;
}): Bundle<Resource> {
  const startedAt = new Date();
  const dedupedBundle = deduplicateFhir(bundle);

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
