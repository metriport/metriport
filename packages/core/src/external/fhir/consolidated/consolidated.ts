import { OperationOutcomeError } from "@medplum/core";
import { ExtractResource, OperationOutcomeIssue, Resource, ResourceType } from "@medplum/fhirtypes";
import { ResourceTypeForConsolidation, SearchSetBundle } from "@metriport/shared/medical";
import { Patient } from "../../../domain/patient";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import { makeFhirApi } from "../api/api-factory";
import { fullDateQueryForResource, getPatientFilter } from "../patient/resource-filter";
import { buildSearchSetBundle, getReferencesFromResources } from "../bundle/bundle";
import { findDocIdExtension } from "../shared/extensions/doc-id-extension";
import { getReferencesFromFHIR } from "../shared/references";

const MAX_HYDRATION_ROUNDS = 3;

export type ConsolidatedFhirToBundlePayload = {
  patient: Pick<Patient, "id" | "cxId">;
  requestId?: string | undefined;
  resources?: ResourceTypeForConsolidation[] | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
};

/**
 * Get consolidated patient data from FHIR server.
 *
 * @param documentIds (Optional) List of document reference IDs to filter by. If provided, only
 *            resources derived from these document references will be returned.
 * @returns FHIR bundle of resources matching the filters.
 */
export async function getConsolidatedFhirBundle({
  patient,
  resources = [],
  dateFrom,
  dateTo,
}: ConsolidatedFhirToBundlePayload): Promise<SearchSetBundle<Resource>> {
  const { log } = out(`getConsolidatedPatientData - cxId ${patient.cxId}, patientId ${patient.id}`);
  const { id: patientId, cxId } = patient;
  const {
    resourcesByPatient,
    resourcesBySubject,
    dateFilter: fullDateQuery,
  } = getPatientFilter({
    resources,
    dateFrom,
    dateTo,
  });
  log(`Getting consolidated data with resources by patient: ${resourcesByPatient.join(", ")}...`);
  log(`...and by subject: ${resourcesBySubject.join(", ")}`);

  const fhirUrl = Config.getFHIRServerUrl();
  const fhir = makeFhirApi(cxId, fhirUrl);
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

  let filtered = success;

  for (let i = 0; i < MAX_HYDRATION_ROUNDS; i++) {
    const { missingReferences } = getReferencesFromResources({
      resourcesToCheckRefs: filtered,
    });
    if (missingReferences.length === 0) {
      break;
    }
    const missingRefsOnFHIR = await getReferencesFromFHIR(missingReferences, fhir, log);
    filtered = [...filtered, ...missingRefsOnFHIR];
  }

  const entries = filtered.map(entry => {
    if ("extension" in entry) {
      const docIdExtension = findDocIdExtension(entry.extension);
      if (docIdExtension) {
        entry.meta = {
          ...entry.meta,
          source: docIdExtension.valueString ?? entry.meta?.source ?? "",
        };
      }
    }
    if (entry.resourceType === "DocumentReference") {
      const attachment = entry.content?.[0]?.attachment;
      if (attachment) {
        entry.meta = {
          ...entry.meta,
          source: attachment.title ?? entry.meta?.source ?? "",
        };
      }
    }
    return { resource: entry };
  });
  return buildSearchSetBundle(entries);
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
