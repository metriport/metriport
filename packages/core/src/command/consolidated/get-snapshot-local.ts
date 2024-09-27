import { executeWithNetworkRetries, InternalSendConsolidated } from "@metriport/shared";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { SearchSetBundle } from "@metriport/shared/medical";
import axios from "axios";
import { isConsolidatedFromS3Enabled } from "../../external/aws/app-config";
import { checkBundleForPatient } from "../../external/fhir/bundle/qa";
import { getConsolidatedFhirBundle as getConsolidatedFromFhirServer } from "../../external/fhir/consolidated/consolidated";
import { deduplicate } from "../../external/fhir/consolidated/deduplicate";
import { toFHIR as patientToFhir } from "../../external/fhir/patient/conversion";
import { buildBundleEntry } from "../../external/fhir/shared/bundle";
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

    const fhirPatient = patientToFhir(params.patient);
    const patientEntry = buildBundleEntry(fhirPatient);
    originalBundle.entry = [patientEntry, ...(originalBundle.entry ?? [])];
    originalBundle.total = originalBundle.entry.length;

    const dedupedBundle = deduplicate({ cxId, patientId, bundle: originalBundle });

    checkBundleForPatient(dedupedBundle, cxId, patientId);

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
): Promise<SearchSetBundle> {
  const { cxId } = params.patient;
  const isGetFromS3 = await isConsolidatedFromS3Enabled();
  const { log } = out(`getBundle - fromS3: ${isGetFromS3}`);
  if (isGetFromS3) {
    const startedAt = new Date();
    const consolidatedBundle = await getConsolidatedFromS3({ ...params, cxId });
    if (consolidatedBundle) {
      log(`(from S3) Took ${elapsedTimeFromNow(startedAt)}ms`);
      return consolidatedBundle;
    }
    log(`(from S3) Not found/created`);
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
