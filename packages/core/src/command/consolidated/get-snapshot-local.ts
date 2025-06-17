import { Bundle, Resource } from "@medplum/fhirtypes";
import {
  errorToString,
  executeWithNetworkRetries,
  InternalSendConsolidated,
  MetriportError,
} from "@metriport/shared";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { SearchSetBundle } from "@metriport/shared/medical";
import axios from "axios";
import { getConsolidatedQueryByRequestId, Patient } from "../../domain/patient";
import { analyticsAsync, EventTypes } from "../../external/analytics/posthog";
import { buildBundleEntry } from "../../external/fhir/bundle/bundle";
import { checkBundle } from "../../external/fhir/bundle/qa";
import { removeContainedResources, removeResources } from "../../external/fhir/bundle/remove";
import { getConsolidatedFhirBundle as getConsolidatedFromFhirServer } from "../../external/fhir/consolidated/consolidated";
import { dangerouslyDeduplicate } from "../../external/fhir/consolidated/deduplicate";
import { normalize } from "../../external/fhir/consolidated/normalize";
import { toFHIR as patientToFhir } from "../../external/fhir/patient/conversion";
import { isPatient } from "../../external/fhir/shared";
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
    const { patient, requestId, sendAnalytics } = params;
    const { cxId, id: patientId } = patient;
    const { log } = out(`ConsolidatedSnapshotConnectorLocal cx ${cxId} pat ${patientId}`);

    const originalBundle = await getBundle(params);

    const bundleWithUpToDatePatient = replacePatient({
      bundle: originalBundle,
      patient,
    });

    // TODO ENG-316 move it to createConsolidatedFromConversions
    const processedBundle = removeContainedPatients(bundleWithUpToDatePatient, patientId);

    try {
      await uploadConsolidatedSnapshotToS3({
        ...params,
        s3BucketName: this.bucketName,
        bundle: processedBundle,
        type: "original",
      });
    } catch (error) {
      log(`Failed to store original bundle on S3 - ${errorToString(error)}`);
    }

    // TODO ENG-316 remove this, already done on createConsolidatedFromConversions
    await dangerouslyDeduplicate({
      cxId,
      patientId,
      bundle: processedBundle,
    });

    try {
      uploadConsolidatedSnapshotToS3({
        ...params,
        s3BucketName: this.bucketName,
        bundle: processedBundle,
        type: "dedup",
      });
    } catch (error) {
      log(`Failed to store dedup bundle on S3 - ${errorToString(error)}`);
    }

    // TODO ENG-316 move it to createConsolidatedFromConversions
    const normalizedBundle = await normalize({
      cxId,
      patientId,
      bundle: processedBundle,
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

    const { bucket, key } = await uploadConsolidatedSnapshotToS3({
      ...params,
      s3BucketName: this.bucketName,
      bundle: resultBundle,
      type: "normalized",
    });

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

    if (sendAnalytics) {
      const currentConsolidatedProgress = getConsolidatedQueryByRequestId(patient, requestId);
      await analyticsAsync({
        distinctId: cxId,
        event: EventTypes.consolidatedQuery,
        properties: {
          patientId: patientId,
          conversionType: "bundle",
          duration: elapsedTimeFromNow(currentConsolidatedProgress?.startedAt),
          resourceCount: resultBundle.entry?.length,
        },
      });
    }

    return info;
  }
}

async function getBundle(
  params: ConsolidatedSnapshotRequestSync | ConsolidatedSnapshotRequestAsync
): Promise<SearchSetBundle> {
  const { forceDataFromFhir } = !params.isAsync ? params : { forceDataFromFhir: false };
  const { cxId } = params.patient;
  const isGetFromS3 = !forceDataFromFhir;
  const { log } = out(`getBundle - fromS3: ${isGetFromS3}`);
  log(`forceDataFromFhir: ${forceDataFromFhir}`);
  if (isGetFromS3) {
    const startedAt = new Date();
    const consolidatedBundle = await getConsolidatedFromS3({ ...params, cxId });
    if (consolidatedBundle) {
      log(`(from S3) Took ${elapsedTimeFromNow(startedAt)}ms`);
      return consolidatedBundle;
    }
    log(`(from S3) Not found/created`);
  }
  // Used for contributed data (shareback)
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

export function removeContainedPatients(bundle: Bundle, patientIdToKeep: string): Bundle {
  return removeContainedResources({
    bundle,
    shouldRemove: (r: Resource) => isPatient(r) && r.id !== patientIdToKeep,
  });
}

function replacePatient({ bundle, patient }: { bundle: Bundle; patient: Patient }): Bundle {
  const bundleWithoutPatient = removeResources({ bundle, shouldRemove: isPatient });
  const fhirPatient = patientToFhir(patient);
  const patientEntry = buildBundleEntry(fhirPatient);
  const entries = [patientEntry, ...(bundleWithoutPatient.entry ?? [])];
  const newBundle = {
    ...bundle,
    total: entries.length,
    entry: entries,
  };

  return newBundle;
}
