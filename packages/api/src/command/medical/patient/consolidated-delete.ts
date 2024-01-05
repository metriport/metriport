import { OperationOutcomeError } from "@medplum/core";
import { OperationOutcomeIssue } from "@medplum/fhirtypes";
import { ResourceTypeForConsolidation } from "@metriport/api-sdk";
import { flatten } from "lodash";
import { Patient } from "@metriport/core/domain/medical/patient";
import { makeFhirApi } from "../../../external/fhir/api/api-factory";
import { capture } from "../../../shared/notifications";
import { Util } from "../../../shared/util";
import { getConsolidatedPatientData } from "./consolidated-get";

const SUCCESS_CODE = `SUCCESSFUL_DELETE`;
export type DeleteConsolidatedFilters = {
  resources?: ResourceTypeForConsolidation[];
  docIds: string[];
};

export type DeleteConsolidatedParams = {
  patient: Pick<Patient, "id" | "cxId" | "data">;
  dryRun?: boolean;
} & DeleteConsolidatedFilters;

/**
 * HEADS UP! This is very destructive, it will delete all resources from the FHIR server that match
 * the filters provided. It will not delete DocumentReference resources.
 */
export async function deleteConsolidated(params: DeleteConsolidatedParams): Promise<void> {
  const { patient, resources, docIds, dryRun = false } = params;
  const { log } = Util.out(`deleteConsolidated - cxId ${patient.cxId}, patientId ${patient.id}`);
  const fhir = makeFhirApi(patient.cxId);

  const getResourcesToDelete = async () => {
    try {
      const bundle = await getConsolidatedPatientData({
        patient,
        documentIds: docIds,
        resources,
      });
      const resourcesFromFHIRServer = bundle.entry;
      if (!resourcesFromFHIRServer || resourcesFromFHIRServer.length <= 0) {
        log(`No resources to delete`);
        return;
      }

      const resourcesToDelete = resourcesFromFHIRServer.filter(r => {
        const resource = r.resource;
        if (!resource) return false;
        // TODO make this dynamic, get a list of resources to exclude
        return resource.resourceType !== "DocumentReference";
      });
      return resourcesToDelete;
    } catch (error) {
      const msg = `Failed to get consolidated FHIR resources`;
      log(`${msg}: ${JSON.stringify(params)}`);
      throw error;
    }
  };

  const resourcesToDelete = await getResourcesToDelete();
  if (!resourcesToDelete || resourcesToDelete.length <= 0) return;

  const entries = resourcesToDelete.flatMap(r => {
    const resource = r.resource;
    if (!resource || !resource.id || !resource.resourceType) return [];
    return {
      request: {
        method: "DELETE" as const,
        url: `${resource.resourceType}/${resource.id}`,
      },
    };
  });

  if (dryRun) {
    log(`[DRY-RUN] Would delete ${entries.length} resources from FHIR server`);
    return;
  }

  try {
    log(`Deleting ${entries.length} resources from FHIR server...`);
    const resp = await fhir.executeBatch({
      resourceType: "Bundle",
      type: "transaction",
      entry: entries,
    });
    const issues = resp.entry?.flatMap(e => {
      return e.response?.outcome?.issue?.flatMap(i => {
        return i.details?.coding?.map(c => {
          if (c.code === SUCCESS_CODE) return [];
          return {
            code: c.code,
            message: i.diagnostics,
          };
        });
      });
    });
    const issuesFlattened = flatten(issues);
    if (issuesFlattened.length > 0) {
      const msg = `Gracefully failed to delete FHIR resources`;
      log(`${msg} - ${JSON.stringify(issuesFlattened)}`);
      capture.error(msg, {
        extra: {
          context: `deleteConsolidated.graceful-fail`,
          patientId: patient.id,
          issues: issuesFlattened,
        },
      });
    }
  } catch (error) {
    const detailMsg = error instanceof OperationOutcomeError ? getMessage(error) : String(error);
    const msg = `Failed to delete FHIR resources`;
    log(`${msg} - ${detailMsg} - ${JSON.stringify(error)}`);
    capture.error(msg, {
      extra: {
        context: `deleteConsolidated.catch`,
        patientId: patient.id,
        detailMsg,
        error,
      },
    });
    throw error;
  }
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
