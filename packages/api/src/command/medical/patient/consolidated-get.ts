import { Bundle, BundleEntry, Resource } from "@medplum/fhirtypes";
import {
  ConsolidatedQuery,
  ConsolidationConversionType,
  GetConsolidatedFilters,
  resourcesSearchableByPatient,
  ResourceTypeForConsolidation,
} from "@metriport/api-sdk";
import {
  ConsolidatedSnapshotRequestAsync,
  ConsolidatedSnapshotRequestSync,
} from "@metriport/core/command/consolidated/get-snapshot";
import { buildConsolidatedSnapshotConnector } from "@metriport/core/command/consolidated/get-snapshot-factory";
import { getConsolidatedSnapshotFromS3 } from "@metriport/core/command/consolidated/snapshot-on-s3";
import { createMRSummaryFileName } from "@metriport/core/domain/medical-record-summary";
import { Patient } from "@metriport/core/domain/patient";
import { analytics, EventTypes } from "@metriport/core/external/analytics/posthog";
import { out } from "@metriport/core/util";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { emptyFunction } from "@metriport/shared";
import { SearchSetBundle } from "@metriport/shared/medical";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { intersection } from "lodash";
import { processAsyncError } from "../../../errors";
import { Config } from "../../../shared/config";
import { capture } from "../../../shared/notifications";
import { Util } from "../../../shared/util";
import { getSignedURL } from "../document/document-download";
import { processConsolidatedDataWebhook } from "./consolidated-webhook";
import {
  buildDocRefBundleWithAttachment,
  emptyMetaProp,
  handleBundleToMedicalRecord,
  uploadJsonBundleToS3,
} from "./convert-fhir-bundle";
import { getPatientOrFail } from "./get-patient";
import { storeQueryInit } from "./query-init";

dayjs.extend(duration);

export type GetConsolidatedParams = {
  patient: Patient;
  bundle?: SearchSetBundle;
  requestId?: string;
  documentIds?: string[];
} & GetConsolidatedFilters;

type GetConsolidatedPatientData = {
  patient: Patient;
  resources?: ResourceTypeForConsolidation[];
  dateFrom?: string;
  dateTo?: string;
  requestId?: string;
  fromDashboard?: boolean;
  // TODO 2215 Remove this when we have contributed data as part of get consolidated (from S3)
  forceDataFromFhir?: boolean;
};

export type GetConsolidatedSendToCxParams = GetConsolidatedParams & {
  requestId: string;
};

export type ConsolidatedQueryParams = {
  cxId: string;
  patientId: string;
  cxConsolidatedRequestMetadata?: unknown;
} & GetConsolidatedFilters;

export type ConsolidatedData = {
  bundle: SearchSetBundle<Resource>;
  filters: Record<string, string | boolean | undefined>;
};

export async function startConsolidatedQuery({
  cxId,
  patientId,
  resources = [],
  dateFrom,
  dateTo,
  conversionType,
  cxConsolidatedRequestMetadata,
  fromDashboard,
}: ConsolidatedQueryParams): Promise<ConsolidatedQuery> {
  const { log } = Util.out(`startConsolidatedQuery - M patient ${patientId}`);
  const patient = await getPatientOrFail({ id: patientId, cxId });

  const currentConsolidatedProgress = getCurrentConsolidatedProgress(
    patient.data.consolidatedQueries,
    {
      resources,
      dateFrom,
      dateTo,
      conversionType,
    }
  );

  if (currentConsolidatedProgress) {
    log(
      `Patient ${patientId} consolidatedQuery is already 'processing' with params: ${JSON.stringify(
        currentConsolidatedProgress
      )}, skipping...`
    );
    return currentConsolidatedProgress;
  }

  const startedAt = new Date();
  const requestId = uuidv7();
  const progress: ConsolidatedQuery = {
    requestId,
    status: "processing",
    startedAt,
    resources,
    dateFrom,
    dateTo,
    conversionType,
  };

  analytics({
    distinctId: patient.cxId,
    event: EventTypes.consolidatedQuery,
    properties: {
      patientId: patient.id,
      requestId,
    },
  });

  const updatedPatient = await storeQueryInit({
    id: patient.id,
    cxId: patient.cxId,
    cmd: {
      consolidatedQueries: appendProgressToProcessingQueries(
        patient.data.consolidatedQueries,
        progress
      ),
      cxConsolidatedRequestMetadata,
    },
  });

  getConsolidatedPatientDataAsync({
    patient: updatedPatient,
    resources,
    dateFrom,
    dateTo,
    requestId,
    conversionType,
    fromDashboard,
  }).catch(emptyFunction);

  return progress;
}

function appendProgressToProcessingQueries(
  currentConsolidatedQueries: ConsolidatedQuery[] | undefined,
  progress: ConsolidatedQuery
): ConsolidatedQuery[] {
  if (currentConsolidatedQueries) {
    const queriesInProgress = currentConsolidatedQueries.filter(
      query => query.status === "processing"
    );

    return [...queriesInProgress, progress];
  }

  return [progress];
}

export function getCurrentConsolidatedProgress(
  consolidatedQueriesProgress: ConsolidatedQuery[] | undefined,
  queryParams: GetConsolidatedFilters,
  progressStatus = "processing"
): ConsolidatedQuery | undefined {
  if (!consolidatedQueriesProgress) return undefined;

  const { resources, dateFrom, dateTo, conversionType } = queryParams;

  for (const progress of consolidatedQueriesProgress) {
    const isSameResources = getIsSameResources(resources, progress.resources);
    const isSameDateFrom = progress.dateFrom === dateFrom;
    const isSameDateTo = progress.dateTo === dateTo;
    const isSameConversionType = progress.conversionType === conversionType;
    const isProcessing = progress.status === progressStatus;

    if (isSameResources && isSameDateFrom && isSameDateTo && isSameConversionType && isProcessing) {
      return progress;
    }
  }
}

export function getIsSameResources(
  queryResources: ResourceTypeForConsolidation[] | undefined,
  currentResources: ResourceTypeForConsolidation[] | undefined
): boolean {
  const haveSameLength = queryResources?.length === currentResources?.length;
  const intersectedResources = intersection(queryResources, currentResources);
  const usingAllQueryResources = queryResources?.length === intersectedResources.length;

  const areQueryResourcesSearchableByPatient =
    intersection(queryResources, resourcesSearchableByPatient).length ===
    resourcesSearchableByPatient.length;
  const areQueryResourcesEmpty = !queryResources || queryResources.length === 0;

  const isCurrentProgressSearchableByPatient =
    intersection(currentResources, resourcesSearchableByPatient).length ===
    resourcesSearchableByPatient.length;
  const isCurrentProgressEmpty = !currentResources || currentResources.length === 0;

  return (
    (haveSameLength && usingAllQueryResources) ||
    (isCurrentProgressEmpty && areQueryResourcesSearchableByPatient) ||
    (areQueryResourcesEmpty && isCurrentProgressSearchableByPatient)
  );
}

export async function getConsolidatedAndSendToCx(
  params: GetConsolidatedSendToCxParams
): Promise<void> {
  const { patient, requestId, resources, dateFrom, dateTo, conversionType, fromDashboard } = params;
  try {
    const { bundle, filters } = await getConsolidated(params);
    // trigger WH call
    processConsolidatedDataWebhook({
      patient,
      requestId,
      status: "completed",
      bundle,
      filters,
      isDisabled: fromDashboard,
    }).catch(emptyFunction);
  } catch (error) {
    processConsolidatedDataWebhook({
      patient,
      requestId,
      status: "failed",
      isDisabled: fromDashboard,
      filters: {
        resources: resources ? resources.join(", ") : undefined,
        dateFrom,
        dateTo,
        conversionType,
      },
    }).catch(emptyFunction);
  }
}

export async function getConsolidated({
  patient,
  resources,
  dateFrom,
  dateTo,
  requestId,
  conversionType,
  bundle,
}: GetConsolidatedParams): Promise<ConsolidatedData> {
  const { log } = out(`API getConsolidated - cxId ${patient.cxId}, patientId ${patient.id}`);
  const filters = {
    resources: resources ? resources.join(", ") : undefined,
    dateFrom,
    dateTo,
    conversionType,
  };
  try {
    if (!bundle) {
      bundle = await getConsolidatedPatientData({
        patient,
        requestId,
        resources,
        dateFrom,
        dateTo,
      });
    }
    bundle.entry = filterOutPrelimDocRefs(bundle.entry);
    bundle.total = bundle.entry?.length ?? 0;
    const hasResources = bundle.entry && bundle.entry.length > 0;
    const shouldCreateMedicalRecord = conversionType && conversionType != "json" && hasResources;

    if (shouldCreateMedicalRecord) {
      // If we need to convert to medical record, we also have to update the resulting
      // FHIR bundle to represent that.
      bundle = await handleBundleToMedicalRecord({
        bundle,
        patient,
        requestId,
        resources,
        dateFrom,
        dateTo,
        conversionType,
      });
    }

    if (conversionType === "json" && hasResources) {
      return await uploadConsolidatedJsonAndReturnUrl({
        patient,
        bundle,
        filters: filtersToString(filters),
      });
    }
    return { bundle, filters };
  } catch (error) {
    const msg = "Failed to get consolidated data";
    log(`${msg}: ${JSON.stringify(filters)}`);
    capture.error(msg, {
      extra: {
        error,
        context: `getConsolidated`,
        patientId: patient.id,
        filters,
      },
    });
    throw error;
  }
}

function filtersToString(
  filters: Record<string, string | boolean | undefined>
): Record<string, string> {
  return Object.entries(filters).reduce((acc, [key, value]) => {
    acc[key] = value === undefined ? "" : String(value);
    return acc;
  }, {} as Record<string, string>);
}

export function filterOutPrelimDocRefs(
  entries: BundleEntry<Resource>[] | undefined
): BundleEntry<Resource>[] | undefined {
  if (!entries) return entries;

  return entries.filter(entry => {
    if (entry.resource?.resourceType === "DocumentReference") {
      const isValidStatus = entry.resource?.docStatus !== "preliminary";

      return isValidStatus;
    }

    return true;
  });
}

async function uploadConsolidatedJsonAndReturnUrl({
  patient,
  bundle,
  filters,
}: {
  patient: Pick<Patient, "id" | "cxId">;
  bundle: Bundle<Resource>;
  filters: Record<string, string | undefined>;
}): Promise<{
  bundle: SearchSetBundle<Resource>;
  filters: Record<string, string | undefined>;
}> {
  {
    const fileName = createMRSummaryFileName(patient.cxId, patient.id, "json");
    await uploadJsonBundleToS3({
      bundle,
      fileName,
      metadata: {
        patientId: patient.id,
        cxId: patient.cxId,
        resources: filters.resources?.toString() ?? emptyMetaProp,
        dateFrom: filters.dateFrom ?? emptyMetaProp,
        dateTo: filters.dateTo ?? emptyMetaProp,
        conversionType: filters.conversionType ?? emptyMetaProp,
      },
    });

    // TODO This should use the same function as the one used in handleBundleToMedicalRecord(),
    // `S3Utils.getSignedUrl()` - prob with the same expiration time for simplicity?
    const signedUrl = await getSignedURL({
      bucketName: Config.getMedicalDocumentsBucketName(),
      fileName,
    });
    const newBundle = buildDocRefBundleWithAttachment(patient.id, signedUrl, "json");
    return { bundle: newBundle, filters };
  }
}

/**
 * Get consolidated patient data from FHIR server.
 * Uses ConsolidatedDataConnector, which uses an environment-specific strategy/implementation
 * to load data from the FHIR server:
 * - dev/local: loads data from the FHIR server directly;
 * - cloud envs, calls a lambda to execute the loadingn of data from the FHIR server.
 *
 * @param documentIds (Optional) List of document reference IDs to filter by. If provided, only
 *            resources derived from these document references will be returned.
 * @param resources (Optional) List of resources to filter by. If provided, only
 *            those resources will be included.
 * @returns FHIR bundle of resources matching the filters.
 */
export async function getConsolidatedPatientData({
  patient,
  requestId,
  resources,
  dateFrom,
  dateTo,
  fromDashboard = false,
  forceDataFromFhir = false,
}: GetConsolidatedPatientData): Promise<SearchSetBundle> {
  const payload: ConsolidatedSnapshotRequestSync = {
    patient,
    resources,
    requestId,
    dateFrom,
    dateTo,
    isAsync: false,
    fromDashboard,
    forceDataFromFhir,
  };
  const connector = buildConsolidatedSnapshotConnector();
  const { bundleLocation, bundleFilename } = await connector.execute(payload);
  const bundle = await getConsolidatedSnapshotFromS3({ bundleLocation, bundleFilename });
  return bundle;
}

export async function getConsolidatedPatientDataAsync({
  patient,
  resources,
  dateFrom,
  dateTo,
  requestId,
  conversionType,
  fromDashboard,
}: GetConsolidatedPatientData & {
  requestId: string;
  conversionType?: ConsolidationConversionType;
}): Promise<void> {
  const payload: ConsolidatedSnapshotRequestAsync = {
    patient,
    requestId,
    conversionType,
    resources,
    dateFrom,
    dateTo,
    isAsync: true,
    fromDashboard,
  };
  const connector = buildConsolidatedSnapshotConnector();
  connector
    .execute(payload)
    .catch(processAsyncError("Failed to get consolidated patient data async", true));
}
