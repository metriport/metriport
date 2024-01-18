import { OperationOutcomeError } from "@medplum/core";
import {
  Bundle,
  BundleEntry,
  ExtractResource,
  OperationOutcomeIssue,
  Resource,
  ResourceType,
} from "@medplum/fhirtypes";
import { ResourceTypeForConsolidation } from "@metriport/api-sdk";
import { ConsolidationConversionType } from "@metriport/core/domain/conversion/fhir-to-medical-record";
import { emptyFunction } from "@metriport/shared";
import { Patient } from "@metriport/core/domain/patient";
import { QueryProgress } from "@metriport/core/domain/query-status";
import { makeFhirApi } from "../../../external/fhir/api/api-factory";
import {
  fullDateQueryForResource,
  getPatientFilter,
} from "../../../external/fhir/patient/resource-filter";
import { isResourceDerivedFromDocRef } from "@metriport/core/external/fhir/shared/index";
import { capture } from "@metriport/core/util/capture";
import { Util } from "../../../shared/util";
import { processConsolidatedDataWebhook } from "./consolidated-webhook";
import { handleBundleToMedicalRecord } from "./convert-fhir-bundle";
import { getPatientOrFail } from "./get-patient";
import { storeQueryInit } from "./query-init";

export type GetConsolidatedFilters = {
  resources?: ResourceTypeForConsolidation[];
  dateFrom?: string;
  dateTo?: string;
  conversionType?: ConsolidationConversionType;
};

export type GetConsolidatedParams = {
  patient: Pick<Patient, "id" | "cxId" | "data">;
  documentIds?: string[];
} & GetConsolidatedFilters;

export type ConsolidatedQueryParams = {
  cxId: string;
  patientId: string;
  cxConsolidatedRequestMetadata?: unknown;
} & GetConsolidatedFilters;

export async function startConsolidatedQuery({
  cxId,
  patientId,
  resources,
  dateFrom,
  dateTo,
  conversionType,
  cxConsolidatedRequestMetadata,
}: ConsolidatedQueryParams): Promise<QueryProgress> {
  const { log } = Util.out(`startConsolidatedQuery - M patient ${patientId}`);
  const patient = await getPatientOrFail({ id: patientId, cxId });
  if (patient.data.consolidatedQuery?.status === "processing") {
    log(`Patient ${patientId} consolidatedQuery is already 'processing', skipping...`);
    return patient.data.consolidatedQuery;
  }

  const progress: QueryProgress = { status: "processing" };

  const updatedPatient = await storeQueryInit({
    id: patient.id,
    cxId: patient.cxId,
    consolidatedQuery: progress,
    cxConsolidatedRequestMetadata,
  });

  getConsolidatedAndSendToCx({
    patient: updatedPatient,
    resources,
    dateFrom,
    dateTo,
    conversionType,
  }).catch(emptyFunction);

  return progress;
}

async function getConsolidatedAndSendToCx(params: GetConsolidatedParams): Promise<void> {
  const { patient, resources, dateFrom, dateTo, conversionType } = params;
  try {
    const { bundle, filters } = await getConsolidated(params);
    // trigger WH call
    processConsolidatedDataWebhook({
      patient,
      status: "completed",
      bundle,
      filters,
    }).catch(emptyFunction);
  } catch (error) {
    processConsolidatedDataWebhook({
      patient,
      status: "failed",
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
  documentIds,
  resources,
  dateFrom,
  dateTo,
  conversionType,
}: GetConsolidatedParams): Promise<{
  bundle: Bundle<Resource>;
  filters: Record<string, string | undefined>;
}> {
  const { log } = Util.out(`getConsolidated - cxId ${patient.cxId}, patientId ${patient.id}`);
  const filters = { resources: resources ? resources.join(", ") : undefined, dateFrom, dateTo };
  try {
    let bundle = await getConsolidatedPatientData({
      patient,
      documentIds,
      resources,
      dateFrom,
      dateTo,
    });
    const hasResources = bundle.entry && bundle.entry.length > 0;
    const shouldCreateMedicalRecord = conversionType && hasResources;

    if (shouldCreateMedicalRecord) {
      // If we need to convert to medical record, we also have to update the resulting
      // FHIR bundle to represent that.
      bundle = await handleBundleToMedicalRecord({
        bundle,
        patient,
        resources,
        dateFrom,
        dateTo,
        conversionType,
      });
    }
    return { bundle, filters };
  } catch (error) {
    log(`Failed to get FHIR resources: ${JSON.stringify(filters)}`);
    capture.error(error, {
      extra: {
        context: `getConsolidated`,
        patientId: patient.id,
        filters,
        error,
      },
    });
    throw error;
  }
}

/**
 * Get consolidated patient data from FHIR server.
 *
 * @param documentIds (Optional) List of document reference IDs to filter by. If provided, only
 *            resources derived from these document references will be returned.
 * @returns FHIR bundle of resources matching the filters.
 */
export async function getConsolidatedPatientData({
  patient,
  documentIds = [],
  resources,
  dateFrom,
  dateTo,
}: {
  patient: Pick<Patient, "id" | "cxId">;
  documentIds?: string[];
  resources?: ResourceTypeForConsolidation[];
  dateFrom?: string;
  dateTo?: string;
}): Promise<Bundle<Resource>> {
  const { log } = Util.out(
    `getConsolidatedPatientData - cxId ${patient.cxId}, patientId ${patient.id}`
  );
  const { id: patientId, cxId } = patient;
  const {
    resourcesByPatient,
    resourcesBySubject,
    generalResourcesNoFilter,
    dateFilter: fullDateQuery,
  } = getPatientFilter({
    resources,
    dateFrom,
    dateTo,
  });
  log(`Getting consolidated data with resources by patient: ${resourcesByPatient.join(", ")}...`);
  log(`...and by subject: ${resourcesBySubject.join(", ")}`);
  documentIds.length > 0 && log(`...and document IDs: ${documentIds.join(", ")}`);
  log(`...and general resources with no specific filter: ${generalResourcesNoFilter.join(", ")}`);

  const fhir = makeFhirApi(cxId);
  const errorsToReport: Record<string, string> = {};

  const settled = await Promise.allSettled([
    ...resourcesByPatient.map(async resource => {
      const dateFilter = fullDateQueryForResource(fullDateQuery, resource);
      return searchResources(
        resource,
        () => fhir.searchResourcePages(resource, `patient=${patientId}${dateFilter}`),
        errorsToReport
      );
    }),
    ...resourcesBySubject.map(async resource => {
      const dateFilter = fullDateQueryForResource(fullDateQuery, resource);
      return searchResources(
        resource,
        () => fhir.searchResourcePages(resource, `subject=${patientId}${dateFilter}`),
        errorsToReport
      );
    }),
    // ...generalResourcesNoFilter.map(async resource => {
    //   return searchResources(resource, () => fhir.searchResourcePages(resource), errorsToReport);
    // }),
  ]);

  const success: Resource[] = settled.flatMap(s => (s.status === "fulfilled" ? s.value : []));

  const failuresAmount = Object.keys(errorsToReport).length;
  if (failuresAmount > 0) {
    log(
      `Failed to get FHIR resources (${failuresAmount} failures, ${
        success.length
      } succeeded): ${JSON.stringify(errorsToReport)}`
    );
    capture.message(`Failed to get FHIR resources`, {
      extra: {
        context: `getConsolidatedPatientData`,
        patientId,
        errorsToReport,
        succeeded: success.length,
        failed: failuresAmount,
      },
      level: "error",
    });
  }

  const filtered = filterByDocumentIds(success, documentIds, log);

  const entry: BundleEntry[] = filtered.map(r => ({ resource: r }));
  return buildResponse(entry);
}

function filterByDocumentIds(
  resources: Resource[],
  documentIds: string[],
  log = console.log
): Resource[] {
  const defaultMsg = `Got ${resources.length} resources from FHIR server`;
  if (documentIds.length <= 0) {
    log(`${defaultMsg}, not filtering by documentIds`);
    return resources;
  }
  const isDerivedFromDocRefs = (r: Resource) =>
    documentIds.some(id => isResourceDerivedFromDocRef(r, id));
  const filtered = documentIds.length > 0 ? resources.filter(isDerivedFromDocRefs) : resources;
  log(`${defaultMsg}, filtered by documentIds to ${filtered.length} resources`);
  return filtered;
}

const searchResources = async <K extends ResourceType>(
  resource: K,
  searchFunction: () => AsyncGenerator<ExtractResource<K>[]>,
  errorsToReport: Record<string, string>
) => {
  try {
    const pages: Resource[] = [];
    for await (const page of searchFunction()) {
      pages.push(...page);
    }
    return pages;
  } catch (err) {
    if (err instanceof OperationOutcomeError && err.outcome.id === "not-found") throw err;
    if (err instanceof OperationOutcomeError) errorsToReport[resource] = getMessage(err);
    else errorsToReport[resource] = String(err);
    throw err;
  }
};

function buildResponse(entries: BundleEntry[]): Bundle<Resource> {
  return { resourceType: "Bundle", total: entries.length, type: "searchset", entry: entries };
}

function getMessage(err: OperationOutcomeError): string {
  return err.outcome.issue ? err.outcome.issue.map(issueToString).join(",") : "";
}

function issueToString(issue: OperationOutcomeIssue): string {
  return (
    issue.details?.text ??
    (issue.diagnostics ? issue.diagnostics.slice(0, 100) + "..." : null) ??
    JSON.stringify(issue)
  );
}
