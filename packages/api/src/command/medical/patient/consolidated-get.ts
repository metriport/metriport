import { OperationOutcomeError } from "@medplum/core";
import {
  Bundle,
  BundleEntry,
  Extension,
  ExtractResource,
  OperationOutcomeIssue,
  Resource,
  ResourceType,
} from "@medplum/fhirtypes";
import { ResourceTypeForConsolidation } from "@metriport/api-sdk";
import { ConsolidationConversionType } from "@metriport/core/domain/conversion/fhir-to-medical-record";
import { DataSourceType } from "aws-sdk/clients/appsync";
import { Patient } from "../../../domain/medical/patient";
import { QueryProgress } from "../../../domain/medical/query-status";
import { makeFhirApi } from "../../../external/fhir/api/api-factory";
import {
  fullDateQueryForResource,
  getPatientFilter,
} from "../../../external/fhir/patient/resource-filter";
import { isMetriportExtension } from "../../../external/fhir/shared/extensions/metriport";
import { capture } from "../../../shared/notifications";
import { Util, emptyFunction } from "../../../shared/util";
import { updateConsolidatedQueryProgress } from "./append-consolidated-query-progress";
import { processConsolidatedDataWebhook } from "./consolidated-webhook";
import { handleBundleToMedicalRecord } from "./convert-fhir-bundle";
import { getPatientOrFail } from "./get-patient";

type ResourceWithExtension = { extension?: Extension[]; content?: { extension?: Extension[] }[] };

export async function startConsolidatedQuery({
  cxId,
  patientId,
  dataSource,
  resources,
  dateFrom,
  dateTo,
  conversionType,
}: {
  cxId: string;
  patientId: string;
  dataSource: DataSourceType;
  resources?: ResourceTypeForConsolidation[];
  dateFrom?: string;
  dateTo?: string;
  conversionType?: ConsolidationConversionType;
}): Promise<QueryProgress> {
  const { log } = Util.out(`queryDocumentsAcrossHIEs - M patient ${patientId}`);
  const patient = await getPatientOrFail({ id: patientId, cxId });
  if (patient.data.consolidatedQuery?.status === "processing") {
    log(`Patient ${patientId} consolidatedQuery is already 'processing', skipping...`);
    return patient.data.consolidatedQuery;
  }

  const progress: QueryProgress = { status: "processing" };
  await updateConsolidatedQueryProgress({
    patient,
    progress,
    reset: true,
  });
  getConsolidatedAndSendToCx({
    patient,
    resources,
    dateFrom,
    dateTo,
    conversionType,
    dataSource,
  }).catch(emptyFunction);
  return progress;
}

async function getConsolidatedAndSendToCx({
  patient,
  dataSource,
  resources,
  dateFrom,
  dateTo,
  conversionType,
}: {
  patient: Pick<Patient, "id" | "cxId" | "data">;
  dataSource: DataSourceType;
  resources?: ResourceTypeForConsolidation[];
  dateFrom?: string;
  dateTo?: string;
  conversionType?: ConsolidationConversionType;
}): Promise<void> {
  const { log } = Util.out(
    `getConsolidatedAndSendToCx - cxId ${patient.cxId}, patientId ${patient.id}`
  );
  const filters = {
    resources: resources ? resources.join(", ") : undefined,
    dateFrom,
    dateTo,
    dataSource,
  };
  try {
    let bundle = await getConsolidatedPatientData({
      patient,
      resources,
      dateFrom,
      dateTo,
      dataSource,
    });

    if (conversionType) {
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

    // trigger WH call
    processConsolidatedDataWebhook({
      patient,
      status: "completed",
      bundle,
      filters,
    }).catch(emptyFunction);
  } catch (error) {
    log(`Failed to get FHIR resources: ${JSON.stringify(filters)}`);
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
    capture.error(error, {
      extra: {
        context: `getConsolidatedAndSendToCx`,
        patientId: patient.id,
        filters,
        error,
      },
    });
  }
}

export async function getConsolidatedPatientData({
  patient,
  dataSource,
  resources,
  dateFrom,
  dateTo,
}: {
  patient: Pick<Patient, "id" | "cxId">;
  dataSource: DataSourceType;
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

  const filteredByDataSource = success.filter(r => filterByDataSource(r, dataSource));

  const failuresAmount = Object.keys(errorsToReport).length;
  if (failuresAmount > 0) {
    log(
      `Failed to get FHIR resources (${failuresAmount} failures, ${
        filteredByDataSource.length
      } succeeded): ${JSON.stringify(errorsToReport)}`
    );
    capture.message(`Failed to get FHIR resources`, {
      extra: {
        context: `getConsolidatedPatientData`,
        patientId,
        errorsToReport,
        succeeded: filteredByDataSource.length,
        failed: failuresAmount,
      },
      level: "error",
    });
  }

  const entry: BundleEntry[] = filteredByDataSource.map(r => ({ resource: r }));
  return buildResponse(entry);
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

function filterByDataSource(r: Resource, dataSource: DataSourceType): boolean {
  if (dataSource === "both") return true;
  const hasMetriportExtension = checkForMetriportExtension(r as ResourceWithExtension);

  return dataSource === "other" ? !hasMetriportExtension : hasMetriportExtension;
}

function checkForMetriportExtension(r: ResourceWithExtension): boolean {
  if (r.extension) {
    return r.extension.some(isMetriportExtension) ?? false;
  }
  if (r.content) {
    return (
      r.content.some((contentItem: { extension?: Extension[] }) =>
        contentItem.extension?.some(isMetriportExtension)
      ) ?? false
    );
  }
  return false;
}
