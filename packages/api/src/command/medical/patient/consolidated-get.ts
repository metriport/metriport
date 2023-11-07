import { OperationOutcomeError } from "@medplum/core";
import {
  Binary,
  Bundle,
  BundleEntry,
  DiagnosticReport,
  ExtractResource,
  OperationOutcomeIssue,
  Resource,
  ResourceType,
} from "@medplum/fhirtypes";
import { ResourceTypeForConsolidation } from "@metriport/api-sdk";
import { ConsolidationConversionType } from "@metriport/core/domain/conversion/fhir-to-medical-record";
import { chunk } from "lodash";
import { Patient } from "../../../domain/medical/patient";
import { QueryProgress } from "../../../domain/medical/query-status";
import { makeFhirApi } from "../../../external/fhir/api/api-factory";
import {
  fullDateQueryForResource,
  getPatientFilter,
} from "../../../external/fhir/patient/resource-filter";
import { capture } from "../../../shared/notifications";
import { emptyFunction, Util } from "../../../shared/util";
import { updateConsolidatedQueryProgress } from "./append-consolidated-query-progress";
import { processConsolidatedDataWebhook } from "./consolidated-webhook";
import { handleBundleToMedicalRecord } from "./convert-fhir-bundle";
import { getPatientOrFail } from "./get-patient";

export async function startConsolidatedQuery({
  cxId,
  patientId,
  resources,
  dateFrom,
  dateTo,
  conversionType,
}: {
  cxId: string;
  patientId: string;
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
  getConsolidatedAndSendToCx({ patient, resources, dateFrom, dateTo, conversionType }).catch(
    emptyFunction
  );
  return progress;
}

async function getConsolidatedAndSendToCx({
  patient,
  resources,
  dateFrom,
  dateTo,
  conversionType,
}: {
  patient: Pick<Patient, "id" | "cxId" | "data">;
  resources?: ResourceTypeForConsolidation[];
  dateFrom?: string;
  dateTo?: string;
  conversionType?: ConsolidationConversionType;
}): Promise<void> {
  const { log } = Util.out(
    `getConsolidatedAndSendToCx - cxId ${patient.cxId}, patientId ${patient.id}`
  );
  const filters = { resources: resources ? resources.join(", ") : undefined, dateFrom, dateTo };
  try {
    let bundle = await getConsolidatedPatientData({ patient, resources, dateFrom, dateTo });
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
  resources,
  dateFrom,
  dateTo,
}: {
  patient: Pick<Patient, "id" | "cxId">;
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

  // populate data into DiagnosticReport
  try {
    const binaryResourceIds: string[] = [];
    const successDiagReportIndeces: number[] = [];
    let index = 0;
    for (const resource of success) {
      if (resource.resourceType === "DiagnosticReport") {
        if (resource.presentedForm && resource.presentedForm[0].url?.startsWith("Binary")) {
          const url = resource.presentedForm[0].url;
          const binaryResourceId = url.split("/")[1];
          if (binaryResourceId) {
            successDiagReportIndeces.push(index);
            binaryResourceIds.push(binaryResourceId);
          }
        }
      }
      index++;
    }
    const MAX_CHUNK_SIZE = 150;
    const binaryChunks = chunk(binaryResourceIds, MAX_CHUNK_SIZE);

    const binarySettled = await Promise.allSettled([
      ...binaryChunks.map(async chunk => {
        return searchResources(
          "Binary",
          () => fhir.searchResourcePages("Binary", `_id=${chunk.join(",")}`),
          errorsToReport
        );
      }),
    ]);
    const binarySuccess: Resource[] = binarySettled.flatMap(s =>
      s.status === "fulfilled" ? s.value : []
    );
    const binaryIdToResource: { [key: string]: Binary } = {};
    for (const binaryResource of binarySuccess) {
      binaryIdToResource[binaryResource.id ?? ""] = binaryResource as Binary;
    }

    for (const diagReportIndex of successDiagReportIndeces) {
      const diagReport = success[diagReportIndex] as DiagnosticReport;
      if (diagReport.presentedForm) {
        const url = diagReport.presentedForm[0].url;
        if (url) {
          const binaryResourceId = url.split("/")[1];
          if (binaryResourceId) {
            const binaryResource = binaryIdToResource[binaryResourceId];
            diagReport.presentedForm[0].data = binaryResource.data;
            success[diagReportIndex] = diagReport;
          }
        }
      }
    }
  } catch (error) {
    log(`Failed to populate DiagnosticReport data with error: ${JSON.stringify(error)}`);
    capture.message(`Failed to get FHIR resources`, {
      extra: {
        context: `getConsolidatedPatientData`,
        patientId,
        error,
      },
      level: "error",
    });
  }

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

  const entry: BundleEntry[] = success.map(r => ({ resource: r }));
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
