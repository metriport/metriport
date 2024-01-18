import { OperationOutcomeError } from "@medplum/core";
import { BundleEntry, Resource } from "@medplum/fhirtypes";
import { ResourceTypeForConsolidation } from "@metriport/api-sdk";
import { FhirClient } from "@metriport/core/external/fhir/api/api";
import { logDuration } from "@metriport/shared/common/duration";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { chunk, flatten } from "lodash";
import { Patient } from "@metriport/core/domain/patient";
import { makeFhirApi } from "../../../external/fhir/api/api-factory";
import { getDetailFromOutcomeError } from "@metriport/core/external/fhir/shared/index";
import { capture } from "@metriport/core/util/capture";
import { Util } from "../../../shared/util";
import { getConsolidatedPatientData } from "./consolidated-get";

dayjs.extend(duration);

const MAX_ITEMS_PER_BATCH = 100;
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

  const resourcesToDelete = await getResourcesToDelete(patient, docIds, resources, log);
  if (!resourcesToDelete || resourcesToDelete.length <= 0) return;

  await deleteResources(resourcesToDelete, patient, fhir, dryRun, log);
}

async function getResourcesToDelete(
  patient: Pick<Patient, "id" | "cxId">,
  documentIds: string[],
  resources: ResourceTypeForConsolidation[] | undefined,
  log: typeof console.log
): Promise<BundleEntry<Resource>[]> {
  const bundle = await getConsolidatedPatientData({
    patient,
    documentIds,
    resources,
  });
  const resourcesFromFHIRServer = bundle.entry;
  if (!resourcesFromFHIRServer || resourcesFromFHIRServer.length <= 0) {
    log(`No resources to delete`);
    return [];
  }

  const resourcesToDelete = resourcesFromFHIRServer.filter(r => {
    const resource = r.resource;
    if (!resource) return false;
    // TODO make this dynamic, get a list of resources to exclude
    return resource.resourceType !== "DocumentReference";
  });
  return resourcesToDelete;
}

async function deleteResources(
  resourcesToDelete: BundleEntry<Resource>[],
  patient: Pick<Patient, "id" | "cxId">,
  fhir: FhirClient,
  dryRun: boolean,
  log: typeof console.log
): Promise<void> {
  const entriesForFHIRBundle = resourcesToDelete.flatMap(r => {
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
    log(`[DRY-RUN] Would delete ${entriesForFHIRBundle.length} resources from FHIR server`);
    return;
  }

  const chunks = chunk(entriesForFHIRBundle, MAX_ITEMS_PER_BATCH);
  for (const [i, chunk] of chunks.entries()) {
    log(`Deleting chunk ${i + 1}/${chunks.length}...`);
    await deleteChunk(chunk, patient.id, fhir, log);
  }
}

async function deleteChunk(
  entries: BundleEntry<Resource>[],
  patientId: string,
  fhir: FhirClient,
  log: typeof console.log
): Promise<void> {
  try {
    log(`Deleting ${entries.length} resources from FHIR server...`);
    const resp = await logDuration(
      () =>
        fhir.executeBatch({
          resourceType: "Bundle",
          type: "transaction",
          entry: entries,
        }),
      { log, withMinutes: true }
    );
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
          patientId: patientId,
          issues: issuesFlattened,
        },
      });
    }
  } catch (error) {
    const detailMsg =
      error instanceof OperationOutcomeError ? getDetailFromOutcomeError(error) : String(error);
    const msg = `Failed to delete FHIR resources`;
    log(`${msg} - ${detailMsg} - ${JSON.stringify(error)}`);
    capture.error(msg, {
      extra: {
        context: `deleteConsolidated.catch`,
        patientId: patientId,
        detailMsg,
        entries,
        error,
      },
    });
    throw error;
  }
}
