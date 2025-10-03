import { Bundle, BundleEntry, Resource } from "@medplum/fhirtypes";
import {
  ConsolidatedQuery,
  GetConsolidatedFilters,
  resourcesSearchableByPatient,
  ResourceTypeForConsolidation,
} from "@metriport/api-sdk";
import {
  getConsolidatedPatientData,
  getConsolidatedPatientDataAsync,
} from "@metriport/core/command/consolidated/consolidated-get";
import { createMRSummaryFileName } from "@metriport/core/domain/medical-record-summary";
import { compressGzip } from "@metriport/core/util/compression";
import { getConsolidatedQueryByRequestId, Patient } from "@metriport/core/domain/patient";
import { analytics, EventTypes } from "@metriport/core/external/analytics/posthog";
import { out } from "@metriport/core/util";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { emptyFunction, errorToString } from "@metriport/shared";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { SearchSetBundle } from "@metriport/shared/medical";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { intersection } from "lodash";
import { Config } from "../../../shared/config";
import { capture } from "../../../shared/notifications";
import { Util } from "../../../shared/util";
import { getSignedURL } from "../document/document-download";
import { storeConsolidatedQueryInitialState } from "./consolidated-init";
import { processConsolidatedDataWebhook } from "./consolidated-webhook";
import {
  buildDocRefBundleWithAttachments,
  emptyMetaProp,
  handleBundleToMedicalRecord,
  uploadJsonBundleToS3,
  uploadGzipBundleToS3,
} from "./convert-fhir-bundle";
import { getPatientOrFail } from "./get-patient";

dayjs.extend(duration);

export type GetConsolidatedParams = {
  patient: Patient;
  bundle?: SearchSetBundle;
  requestId?: string;
  documentIds?: string[];
  useMostRecentAiSummary?: boolean;
} & GetConsolidatedFilters;

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
  const consolidatedQuery: ConsolidatedQuery = {
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

  const updatedPatient = await storeConsolidatedQueryInitialState({
    id: patient.id,
    cxId: patient.cxId,
    consolidatedQuery,
    cxConsolidatedRequestMetadata,
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

  return consolidatedQuery;
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
  useMostRecentAiSummary,
  bundle,
}: GetConsolidatedParams): Promise<ConsolidatedData> {
  console.log(useMostRecentAiSummary);
  const { cxId, id: patientId } = patient;
  const { log } = out(`API getConsolidated - cxId ${cxId}, patientId ${patientId}`);
  const filters = {
    resources: resources ? resources.join(", ") : undefined,
    dateFrom,
    dateTo,
    conversionType,
  };
  let localBundle = bundle;

  try {
    if (!localBundle) {
      localBundle = await getConsolidatedPatientData({
        patient,
        requestId,
        resources,
        dateFrom,
        dateTo,
      });
    }
    localBundle.entry = filterOutPrelimDocRefs(localBundle.entry);
    localBundle.total = localBundle.entry?.length ?? 0;
    const hasResources = localBundle.entry && localBundle.entry.length > 0;
    const shouldCreateMedicalRecord = conversionType != "json" && hasResources;

    sendAnalytics(patient, requestId, "bundle", localBundle.entry?.length);

    if (shouldCreateMedicalRecord) {
      // If we need to convert to medical record, we also have to update the resulting
      // FHIR bundle to represent that.
      localBundle = await handleBundleToMedicalRecord({
        bundle: localBundle,
        patient,
        requestId,
        resources,
        dateFrom,
        dateTo,
        conversionType,
      });
      sendAnalytics(patient, requestId, conversionType, localBundle.entry?.length);
    }

    if (conversionType === "json" && hasResources) {
      return await uploadConsolidatedJsonAndGzipAndReturnUrls({
        patient,
        bundle: localBundle,
        filters: filtersToString(filters),
      });
    }
    return { bundle: localBundle, filters };
  } catch (error) {
    const msg = "Failed to get consolidated data";
    const errorStr = errorToString(error);
    log(`${msg} - filters: ${JSON.stringify(filters)}; error: ${errorStr}`);
    capture.error(msg, {
      extra: {
        context: `getConsolidated`,
        patientId: patient.id,
        filters,
        errorStr,
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

async function uploadConsolidatedJsonAndGzipAndReturnUrls({
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
  const fileName = createMRSummaryFileName(patient.cxId, patient.id, "json");
  const gzipFileName = fileName + ".gz";
  const medicalDocumentsBucket = Config.getMedicalDocumentsBucketName();
  const compressedBundle = await compressBundle(bundle);
  const metadata = {
    patientId: patient.id,
    cxId: patient.cxId,
    resources: filters.resources?.toString() ?? emptyMetaProp,
    dateFrom: filters.dateFrom ?? emptyMetaProp,
    dateTo: filters.dateTo ?? emptyMetaProp,
    conversionType: filters.conversionType ?? emptyMetaProp,
  };

  await Promise.all([
    uploadJsonBundleToS3({ bundle, fileName, metadata }),
    uploadGzipBundleToS3({ compressedData: compressedBundle, fileName: gzipFileName, metadata }),
  ]);

  const [signedUrl, gzipSignedUrl] = await Promise.all([
    getSignedURL({ bucketName: medicalDocumentsBucket, fileName }),
    getSignedURL({ bucketName: medicalDocumentsBucket, fileName: gzipFileName }),
  ]);

  const attachments = [
    { url: signedUrl, mimeType: "json" as const },
    { url: gzipSignedUrl, mimeType: "gzip" as const },
  ];

  const newBundle = buildDocRefBundleWithAttachments(patient.id, attachments);
  return { bundle: newBundle, filters };
}

function sendAnalytics(
  patient: Patient,
  requestId: string | undefined,
  conversionTypeForAnalytics: string,
  resourceCount: number | undefined
) {
  const currentConsolidatedProgress = getConsolidatedQueryByRequestId(patient, requestId);
  analytics({
    distinctId: patient.cxId,
    event: EventTypes.consolidatedQuery,
    properties: {
      patientId: patient.id,
      duration: elapsedTimeFromNow(currentConsolidatedProgress?.startedAt),
      conversionType: conversionTypeForAnalytics,
      resourceCount,
    },
  });
}

/**
 * Compresses a FHIR Bundle for S3 storage
 */
export async function compressBundle(bundle: Bundle): Promise<Buffer> {
  const jsonString = JSON.stringify(bundle);
  const jsonBuffer = Buffer.from(jsonString, "utf8");
  return compressGzip(jsonBuffer);
}
