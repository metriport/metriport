import { Bundle } from "@medplum/fhirtypes";
import {
  errorToString,
  executeWithNetworkRetries,
  InternalSendConsolidated,
  MetriportError,
} from "@metriport/shared";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { SearchSetBundle } from "@metriport/shared/medical";
import axios from "axios";
import { getConsolidatedQueryByRequestId } from "../../domain/patient";
import { analytics, EventTypes } from "../../external/analytics/posthog";
import { checkBundle } from "../../external/fhir/bundle/qa";
import { deduplicate } from "../../external/fhir/consolidated/deduplicate";
import { normalize } from "../../external/fhir/consolidated/normalize";
import { toFHIR as patientToFhir } from "../../external/fhir/patient/conversion";
import { isPatient } from "../../external/fhir/shared";
import { buildBundleEntry } from "../../external/fhir/shared/bundle";
import { capture, out } from "../../util";
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
    const { patient, requestId } = params;
    const { cxId, id: patientId } = patient;
    const { log } = out(`ConsolidatedSnapshotConnectorLocal cx ${cxId} pat ${patientId}`);

    const originalBundle = await getBundle(params);

    const fhirPatient = patientToFhir(patient);
    const patientEntry = buildBundleEntry(fhirPatient);
    originalBundle.entry = [patientEntry, ...(originalBundle.entry ?? [])];
    originalBundle.total = originalBundle.entry.length;

    const originalBundleWithoutContainedPatients = removeContainedPatients(
      originalBundle,
      patientId
    );

    const dedupedBundle = await deduplicate({
      cxId,
      patientId,
      bundle: originalBundleWithoutContainedPatients,
    });

    const normalizedBundle = await normalize({
      cxId,
      patientId,
      bundle: dedupedBundle,
    });

    const resultBundle = normalizedBundle;

    try {
      checkBundle(resultBundle, cxId, patientId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      const msg = "Bundle contains invalid data";
      const additionalInfo = { cxId, patientId, type: error.message };
      log(`${msg} - ${JSON.stringify(additionalInfo)}`);
      capture.error(msg, { extra: { additionalInfo, error } });
      try {
        uploadConsolidatedSnapshotToS3({
          ...params,
          s3BucketName: this.bucketName,
          bundle: resultBundle,
          type: "invalid",
        });
      } catch (error) {
        log(`Failed to store invalid bundle on S3 - ${errorToString(error)}`);
      }
      throw new MetriportError(msg, error, additionalInfo);
    }

    const [, , resultS3Info] = await Promise.all([
      uploadConsolidatedSnapshotToS3({
        ...params,
        s3BucketName: this.bucketName,
        bundle: originalBundleWithoutContainedPatients,
        type: "original",
      }),
      uploadConsolidatedSnapshotToS3({
        ...params,
        s3BucketName: this.bucketName,
        bundle: dedupedBundle,
        type: "dedup",
      }),
      uploadConsolidatedSnapshotToS3({
        ...params,
        s3BucketName: this.bucketName,
        bundle: resultBundle,
        type: "normalized",
      }),
    ]);

    const { bucket, key } = resultS3Info;
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

    const currentConsolidatedProgress = getConsolidatedQueryByRequestId(patient, requestId);
    analytics({
      distinctId: cxId,
      event: EventTypes.consolidatedQuery,
      properties: {
        patientId: patientId,
        conversionType: "bundle",
        duration: elapsedTimeFromNow(currentConsolidatedProgress?.startedAt),
        resourceCount: resultBundle.entry?.length,
      },
    });

    return info;
  }
}

async function getBundle(
  params: ConsolidatedSnapshotRequestSync | ConsolidatedSnapshotRequestAsync
): Promise<SearchSetBundle> {
  const { cxId } = params.patient;
  const { log } = out(`getBundle - fromS3`);
  const startedAt = new Date();
  const consolidatedBundle = await getConsolidatedFromS3({ ...params, cxId });

  log(`(from S3) Took ${elapsedTimeFromNow(startedAt)}ms`);
  return consolidatedBundle;
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

export function removeContainedPatients(bundle: Bundle, patientId: string): Bundle {
  if (!bundle.entry) return bundle;

  const updatedEntry = bundle.entry.map(entry => {
    const resource = entry.resource;
    if (resource && "contained" in resource) {
      return {
        ...entry,
        resource: {
          ...resource,
          contained: resource.contained?.filter(r => !isPatient(r) || r.id === patientId),
        },
      };
    }
    return entry;
  });

  return {
    ...bundle,
    total: updatedEntry.length,
    entry: updatedEntry,
  };
}
