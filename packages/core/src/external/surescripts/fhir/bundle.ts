import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { Bundle, BundleEntry, Organization, Practitioner, Resource } from "@medplum/fhirtypes";
import { SurescriptsContext, SystemIdentifierMap } from "./types";
import { ResponseDetail } from "../schema/response";
import { IncomingData } from "../schema/shared";
import { getMedication } from "./medication";
import { getMedicationDispense } from "./medication-dispense";
import { getMedicationRequest } from "./medication-request";
import { getPrescriber } from "./prescriber";
import { getPharmacy } from "./pharmacy";
import { getPatient, mergePatient } from "./patient";
import { getCondition } from "./condition";
import { getAllBundleEntries } from "./bundle-entry";

export async function convertIncomingDataToFhirBundle(
  patientId: string,
  details: IncomingData<ResponseDetail>[]
): Promise<Bundle> {
  const bundle: Bundle = {
    resourceType: "Bundle",
    total: 0,
    type: "collection",
    entry: [],
  };

  const context = buildInitialContext(patientId);
  for (const detail of details) {
    const entries = getAllBundleEntries(context, detail);
    bundle.entry?.push(...entries);
    bundle.total = (bundle.total ?? 0) + entries.length;
  }

  return bundle;
}

export function convertPatientDetailToEntries(
  detail: ResponseDetail,
  context: SurescriptsContext
): BundleEntry<Resource>[] {
  const patient = mergePatient(context.patient, getPatient(detail));
  const practitioner = deduplicateBySystemIdentifier(context.practitioner, getPrescriber(detail));
  const pharmacy = deduplicateBySystemIdentifier(context.pharmacy, getPharmacy(detail));
  const condition = getCondition(detail);
  const medication = getMedication(detail);
  const medicationDispense = getMedicationDispense(context, detail);
  const medicationRequest = getMedicationRequest(context, detail);

  return [
    patient,
    practitioner,
    pharmacy,
    condition,
    medication,
    medicationDispense,
    medicationRequest,
  ].flatMap(function (resource): BundleEntry<Resource>[] {
    if (!resource) return [];
    if (!resource.id) resource.id = uuidv7();
    return [
      {
        fullUrl: "urn:uuid:" + resource.id,
        resource,
      },
    ];
  });
}

function buildInitialContext(patientId: string): SurescriptsContext {
  return {
    patient: {
      resourceType: "Patient",
      id: patientId,
    },
    practitioner: {},
    pharmacy: {},
    medication: {},
    coverage: {},
  };
}

function deduplicateBySystemIdentifier<R extends Practitioner | Organization>(
  systemMap: SystemIdentifierMap<R>,
  resource?: R
): R | undefined {
  if (!resource || !resource.identifier) return undefined;

  for (const identifier of resource.identifier) {
    if (!identifier.value || !identifier.system) continue;
    let identifierMap = systemMap[identifier.system];
    if (!identifierMap) {
      systemMap[identifier.system] = identifierMap = {};
    }
    const existingResource = identifierMap[identifier.value];
    if (existingResource) {
      return existingResource;
    }
    identifierMap[identifier.value] = resource;
  }
  return undefined;
}
