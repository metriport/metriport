import { OperationOutcomeError } from "@medplum/core";
import { BundleEntry, OperationOutcomeIssue, Resource } from "@medplum/fhirtypes";
import { ResourceTypeForConsolidation } from "@metriport/api-sdk";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { Patient } from "../../../domain/medical/patient";
import { makeFhirApi } from "../../../external/fhir/api/api-factory";
import { isResourceDerivedFromDocRef } from "../../../external/fhir/shared";
import { capture } from "../../../shared/notifications";
import { Util } from "../../../shared/util";
import { getConsolidated } from "./consolidated-get";

const numberOfParallelExecutions = 10;

export type DeleteConsolidatedFilters = {
  resources?: ResourceTypeForConsolidation[];
  docIds: string[];
};

export type DeleteConsolidatedParams = {
  patient: Pick<Patient, "id" | "cxId" | "data">;
  dryRun?: boolean;
} & DeleteConsolidatedFilters;

export async function deleteConsolidated(params: DeleteConsolidatedParams): Promise<void> {
  const { patient, resources, docIds, dryRun = false } = params;
  const { log } = Util.out(`deleteConsolidated - cxId ${patient.cxId}, patientId ${patient.id}`);
  const fhir = makeFhirApi(patient.cxId);

  const getResourcesToDelete = async () => {
    try {
      const bundle = await getConsolidated({
        patient,
        resources,
      });
      const resourcesFromFHIRServer = bundle.bundle.entry;
      if (!resourcesFromFHIRServer || resourcesFromFHIRServer.length <= 0) {
        log(`No resources to delete`);
        return;
      }

      const isDerivedFromDocRefs = (r: Resource) =>
        docIds.some(id => isResourceDerivedFromDocRef(r, id));

      const resourcesToDelete = resourcesFromFHIRServer.filter(r => {
        const resource = r.resource;
        if (!resource) return false;
        return resource.resourceType !== "DocumentReference" && isDerivedFromDocRefs(resource);
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

  const errorsToReport: Record<string, string> = {};

  const deleteResource = async (entry: BundleEntry<Resource>) => {
    const resource = entry.resource;
    if (!resource) return;
    const resourceType = resource.resourceType;
    if (!resourceType) {
      log(`No resourceType found for entry ${JSON.stringify(entry)}`);
      return;
    }
    const resourceId = resource.id;
    if (!resourceId) {
      log(`No resourceId found for entry ${JSON.stringify(entry)}`);
      return;
    }
    try {
      if (dryRun) {
        log(`[DRY-RUN] Would delete ${resourceType}/${resourceId} from FHRIR server`);
      } else {
        await fhir.deleteResource(resourceType, resourceId);
      }
    } catch (err) {
      if (err instanceof OperationOutcomeError) errorsToReport[resourceType] = getMessage(err);
      else errorsToReport[resourceType] = String(err);
      throw err;
    }
  };

  await executeAsynchronously(resourcesToDelete, async r => deleteResource(r), {
    numberOfParallelExecutions,
  });

  const failuresAmount = Object.keys(errorsToReport).length;
  if (failuresAmount > 0) {
    const msg = `Failed to delete FHIR resources`;
    log(`${msg} (${failuresAmount} failures): ${JSON.stringify(errorsToReport)}`);
    capture.error(msg, {
      extra: {
        context: `getConsolidatedPatientData`,
        patientId: patient.id,
        errorAmount: failuresAmount,
        errorsToReport,
      },
    });
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
