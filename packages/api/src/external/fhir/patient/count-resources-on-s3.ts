import { Bundle, Resource } from "@medplum/fhirtypes";
import { ResourceTypeForConsolidation } from "@metriport/api-sdk";
import {
  createConsolidatedSnapshotFromFullBundle,
  getOrCreateConsolidatedSnapshotFromS3,
} from "@metriport/core/command/consolidated/consolidated-filter";
import { getFullExistingConsolidatedBundleFromS3 } from "@metriport/core/command/consolidated/consolidated-get";
import { Patient } from "@metriport/core/domain/patient";
import { out } from "@metriport/core/util";
import { Dictionary, countBy } from "lodash";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { ResourceCount } from "./count-resources-shared";

export type CountResourcesParams = {
  patient: Pick<Patient, "cxId" | "id">;
  resources?: ResourceTypeForConsolidation[];
  dateFrom?: string;
  dateTo?: string;
};

export async function countResourcesOnNewOrExistingConsolidatedSnapshot({
  patient: partialPatient,
  resources = [],
  dateFrom,
  dateTo,
}: CountResourcesParams): Promise<ResourceCount> {
  const patient = await getPatientOrFail({ id: partialPatient.id, cxId: partialPatient.cxId });
  const snapshotBundle = await getOrCreateConsolidatedSnapshotFromS3({
    cxId: patient.cxId,
    patient,
    resources,
    dateFrom,
    dateTo,
  });

  return countResourcesInBundle(snapshotBundle);
}

export async function countResourcesOnSnapshotFromExistingFullBundle({
  patient: partialPatient,
  resources = [],
  dateFrom,
  dateTo,
}: CountResourcesParams): Promise<ResourceCount> {
  const cxId = partialPatient.cxId;
  const patientId = partialPatient.id;
  const params = { resources, dateFrom, dateTo };

  const { log } = out(
    `countResourcesOnSnapshotFromExistingConsolidated - cx ${cxId}, pat ${patientId}`
  );
  const patient = await getPatientOrFail({ id: patientId, cxId });

  const fullConsolidatedBundle = await getFullExistingConsolidatedBundleFromS3({
    cxId: patient.cxId,
    patientId,
  });

  if (!fullConsolidatedBundle) {
    log(`Did not find pre-generated consolidated. Returning empty counts`);
    return buildEmptyCounts();
  }
  log(`Found consolidated with ${fullConsolidatedBundle.entry?.length} entries`);

  const snapshotBundle = createConsolidatedSnapshotFromFullBundle(fullConsolidatedBundle, params);
  log(`Filtered to ${snapshotBundle?.entry?.length} entries with: ${JSON.stringify(params)}`);

  return countResourcesInBundle(snapshotBundle);
}

export function countResourcesInBundle(bundle: Bundle<Resource>): ResourceCount {
  const resultingResources = (bundle?.entry ?? []).flatMap(e =>
    e && e.resource ? e.resource : []
  );

  const counted = countBy(resultingResources, r => r.resourceType);

  return buildResourceCount(resultingResources.length, counted);
}

function buildEmptyCounts(): ResourceCount {
  return buildResourceCount(0, {});
}

function buildResourceCount(bundleSize: number, counts: Dictionary<number>): ResourceCount {
  return {
    total: bundleSize,
    resources: counts,
  };
}
