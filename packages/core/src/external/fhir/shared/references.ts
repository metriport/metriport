import {
  EncounterDiagnosis,
  EncounterLocation,
  EncounterParticipant,
  Patient,
  Reference,
  Resource,
  ResourceType,
} from "@medplum/fhirtypes";
import { chunk, groupBy } from "lodash";
import { XOR } from "ts-essentials";
import { buildEntryReference } from ".";
import { executeAsynchronously } from "../../../util/concurrency";
import { makeFhirApi } from "../api/api-factory";

const queriesInParallel = 5;
export const MAX_IDS_PER_REQUEST = 150;

export async function getReferencesFromFHIR(
  references: Reference[],
  fhir: ReturnType<typeof makeFhirApi>,
  log?: typeof console.log
): Promise<Resource[]> {
  if (!references || references.length <= 0) return [];
  const refByType = groupBy(references, r => r.type);
  // chunk each type by X elements and group them back into an array
  const chunks = Object.values(refByType).flatMap(r => chunk(r, MAX_IDS_PER_REQUEST));
  // transform the chunks into array of resource type and ids for each chunk
  const consolidated: { type: ResourceType; ids: string[] }[] = chunks.flatMap(chunk => {
    const type = chunk[0]?.type as ResourceType | undefined;
    const ids = chunk.flatMap(c => c.id ?? []);
    if (!type || ids.length <= 0) return [];
    return { type, ids };
  });

  const resources: Resource[] = [];
  await executeAsynchronously(
    consolidated,
    async c => {
      if (c.ids.length <= 0) return;
      log && log(`Querying for ${c.type} with ids ${c.ids.join(", ")}...`);
      const filtersAsStr = getFilters({ ids: c.ids });
      for await (const page of fhir.searchResourcePages(c.type, filtersAsStr)) {
        resources.push(...page);
      }
    },
    { numberOfParallelExecutions: queriesInParallel, keepExecutingOnError: true }
  );

  return resources;
}

function getFilters({ ids }: { ids: string[] }) {
  const filters = new URLSearchParams();
  if (ids.length <= 0) throw new Error(`Missing ids`);
  filters.append(`_id`, ids.join(","));
  const filtersAsStr = filters.toString();
  return filtersAsStr;
}

export function toReference<T extends Resource>(resource: T): Reference<T> | undefined {
  const id = resource.id;
  const type = resource.resourceType;
  if (!id || !type) return undefined;
  return { id, type, reference: `${type}/${id}` };
}

/**
 * @see https://www.hl7.org/fhir/r4/references.html
 */
export function getIdFromReference(ref: Reference): string | undefined {
  if (ref.id) return ref.id;
  if (ref.reference) {
    const refIdFromTyped = ref.reference.split("/")[1];
    const refIdFromUrn = ref.reference.split("urn:uuid:")[1];
    const refIdFromUrl = ref.type
      ? ref.reference.split(`/${ref.type}/`)[1]?.split("/")[0]
      : undefined;
    const refIdFromRelative = ref.reference.startsWith("#")
      ? ref.reference.split("#")[1]
      : undefined;
    // The order matters
    const refId = refIdFromUrl ?? refIdFromTyped ?? refIdFromUrn ?? refIdFromRelative;
    if (refId) return refId;
  }
  return ref.identifier?.value;
}

/**
 * @see https://www.hl7.org/fhir/r4/references.html
 */
export function isReferenceOfType(ref: Reference, resourceType: ResourceType): ref is Reference {
  if (ref.type) return ref.type === resourceType;
  if (ref.reference) {
    // Relative reference - https://www.hl7.org/fhir/r4/references.html#literal
    if (ref.reference.startsWith(`${resourceType}/`)) return true;
    // Canonical URLs - https://www.hl7.org/fhir/r4/references.html#canonical
    if (ref.reference.includes(`/${resourceType}/`)) return true;
  }
  return false;
}

export function buildPatientReference(id: string): Reference<Patient> {
  return { reference: `Patient/${id}` };
}

type EncounterParticipantInput = XOR<{ practitionerId: string }, { resource: Resource }>;
export function buildEncounterParticipant(input: EncounterParticipantInput): EncounterParticipant {
  if ("practitionerId" in input) {
    return { individual: { reference: `Practitioner/${input.practitionerId}` } };
  }

  return { individual: { reference: buildEntryReference(input.resource) } };
}

type EncounterLocationInput = XOR<{ locationId: string }, { resource: Resource }>;
export function buildLocationReference(input: EncounterLocationInput): EncounterLocation {
  if ("locationId" in input) {
    return { location: { reference: `Location/${input.locationId}` } };
  }

  return { location: { reference: buildEntryReference(input.resource) } };
}

type EncounterDiagnosisInput = XOR<{ conditionId: string }, { resource: Resource }>;
export function buildConditionReference(input: EncounterDiagnosisInput): EncounterDiagnosis {
  if ("conditionId" in input) {
    return { condition: { reference: `Condition/${input.conditionId}` } };
  }

  return { condition: { reference: buildEntryReference(input.resource) } };
}
