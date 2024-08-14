import {
  AllergyIntolerance,
  Bundle,
  BundleEntry,
  Condition,
  Coverage,
  DiagnosticReport,
  Encounter,
  FamilyMemberHistory,
  Immunization,
  Location,
  Medication,
  MedicationAdministration,
  MedicationRequest,
  MedicationStatement,
  Observation,
  Organization,
  Patient,
  Practitioner,
  Procedure,
  Reference,
  RelatedPerson,
  Resource,
  ResourceType,
} from "@medplum/fhirtypes";
import { SearchSetBundle } from "@metriport/shared/medical";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { uniq } from "lodash";

dayjs.extend(duration);

const referenceRegex = new RegExp(/"reference":\s*"(.+?)"/g);

/**
 * Returns the references found in the given resources, including the missing ones.
 *
 * @param resources
 * @param referencesToInclude Resource types to include in the result. If empty, references
 *        with all resource types will be included.
 * @returns References found in the given resources, including the missing ones.
 */
export function getReferencesFromResources({
  resources,
  referencesToInclude = [],
  referencesToExclude = [],
}: {
  resources: Resource[];
  referencesToInclude?: ResourceType[];
  referencesToExclude?: ResourceType[];
}): { references: Reference[]; missingReferences: Reference[] } {
  if (resources.length <= 0) return { references: [], missingReferences: [] };
  const resourceIds = resources.flatMap(r => r.id ?? []);
  const references = getReferencesFromRaw(
    JSON.stringify(resources),
    referencesToInclude,
    referencesToExclude
  );
  const missingReferences: Reference[] = [];
  for (const ref of references) {
    if (!ref.id) continue;
    if (!resourceIds.includes(ref.id)) missingReferences.push(ref);
  }
  return { references, missingReferences };
}

function getReferencesFromRaw(
  rawContents: string,
  referencesToInclude: ResourceType[],
  referencesToExclude: ResourceType[]
): Reference[] {
  const matches = rawContents.matchAll(referenceRegex);
  const references = [];
  for (const match of matches) {
    const ref = match[1];
    if (ref) references.push(ref);
  }
  const uniqueRefs = uniq(references);
  const preResult: Reference[] = uniqueRefs.flatMap(r => {
    const parts = r.split("/");
    const type = parts[0] as ResourceType | undefined;
    const id = parts[1];
    if (!id || !type) return [];
    return { type, id, reference: r };
  });
  if (referencesToInclude.length <= 0 && referencesToExclude.length <= 0) return preResult;
  return preResult.filter(
    r =>
      (!referencesToInclude.length || referencesToInclude.includes(r.type as ResourceType)) &&
      !referencesToExclude.includes(r.type as ResourceType)
  );
}

export function buildBundle(entries: BundleEntry[]): SearchSetBundle<Resource> {
  return { resourceType: "Bundle", total: entries.length, type: "searchset", entry: entries };
}

export type ExtractedFhirTypes = {
  diagnosticReports: DiagnosticReport[];
  patient?: Patient | undefined;
  practitioners: Practitioner[];
  medications: Medication[];
  medicationRequests: MedicationRequest[];
  medicationAdministrations: MedicationAdministration[];
  medicationStatements: MedicationStatement[];
  conditions: Condition[];
  allergies: AllergyIntolerance[];
  locations: Location[];
  procedures: Procedure[];
  observationSocialHistory: Observation[];
  observationVitals: Observation[];
  observationLaboratory: Observation[];
  observationOther: Observation[];
  encounters: Encounter[];
  immunizations: Immunization[];
  familyMemberHistories: FamilyMemberHistory[];
  relatedPersons: RelatedPerson[];
  coverages: Coverage[];
  organizations: Organization[];
};

export function extractFhirTypesFromBundle(bundle: Bundle): ExtractedFhirTypes {
  let patient: Patient | undefined;
  const practitioners: Practitioner[] = [];
  const diagnosticReports: DiagnosticReport[] = [];
  const medicationRequests: MedicationRequest[] = [];
  const medicationAdministrations: MedicationAdministration[] = [];
  const medicationStatements: MedicationStatement[] = [];
  const medications: Medication[] = [];
  const conditions: Condition[] = [];
  const allergies: AllergyIntolerance[] = [];
  const locations: Location[] = [];
  const procedures: Procedure[] = [];
  const observationSocialHistory: Observation[] = [];
  const observationVitals: Observation[] = [];
  const observationLaboratory: Observation[] = [];
  const observationOther: Observation[] = [];
  const encounters: Encounter[] = [];
  const immunizations: Immunization[] = [];
  const familyMemberHistories: FamilyMemberHistory[] = [];
  const relatedPersons: RelatedPerson[] = [];
  const coverages: Coverage[] = [];
  const organizations: Organization[] = [];

  if (bundle.entry) {
    for (const entry of bundle.entry) {
      const resource = entry.resource;
      if (resource?.resourceType === "Patient") {
        patient = resource as Patient;
      } else if (resource?.resourceType === "MedicationRequest") {
        medicationRequests.push(resource as MedicationRequest);
      } else if (resource?.resourceType === "MedicationAdministration") {
        medicationAdministrations.push(resource as MedicationAdministration);
      } else if (resource?.resourceType === "MedicationStatement") {
        medicationStatements.push(resource as MedicationStatement);
      } else if (resource?.resourceType === "Medication") {
        medications.push(resource as Medication);
      } else if (resource?.resourceType === "Condition") {
        conditions.push(resource as Condition);
      } else if (resource?.resourceType === "Location") {
        locations.push(resource as Location);
      } else if (resource?.resourceType === "AllergyIntolerance") {
        allergies.push(resource as AllergyIntolerance);
      } else if (resource?.resourceType === "Procedure") {
        procedures.push(resource as Procedure);
      } else if (resource?.resourceType === "Observation") {
        const observation = resource as Observation;
        const isVitalSigns = observation.category?.find(
          ext => ext.coding?.[0]?.code?.toLowerCase() === "vital-signs"
        );
        const isSocialHistory = observation.category?.find(
          ext => ext.coding?.[0]?.code?.toLowerCase() === "social-history"
        );
        const isLaboratory = observation.category?.find(
          category => category.coding?.[0]?.code?.toLowerCase() === "laboratory"
        );
        const stringifyResource = JSON.stringify(resource);

        if (stringifyResource && isVitalSigns) {
          observationVitals.push(observation);
        } else if (stringifyResource && isLaboratory) {
          observationLaboratory.push(observation);
        } else if (stringifyResource && isSocialHistory) {
          observationSocialHistory.push(observation);
        } else {
          observationOther.push(observation);
        }
      } else if (resource?.resourceType === "Encounter") {
        encounters.push(resource as Encounter);
      } else if (resource?.resourceType === "Immunization") {
        immunizations.push(resource as Immunization);
      } else if (resource?.resourceType === "FamilyMemberHistory") {
        familyMemberHistories.push(resource as FamilyMemberHistory);
      } else if (resource?.resourceType === "RelatedPerson") {
        relatedPersons.push(resource as RelatedPerson);
      } else if (resource?.resourceType === "Coverage") {
        coverages.push(resource as Coverage);
      } else if (resource?.resourceType === "DiagnosticReport") {
        diagnosticReports.push(resource as DiagnosticReport);
      } else if (resource?.resourceType === "Practitioner") {
        practitioners.push(resource as Practitioner);
      } else if (resource?.resourceType === "Organization") {
        organizations.push(resource as Organization);
      }
    }
  }

  return {
    patient,
    practitioners,
    diagnosticReports,
    medications,
    medicationAdministrations,
    medicationStatements,
    medicationRequests,
    conditions,
    allergies,
    locations,
    procedures,
    observationSocialHistory,
    observationVitals,
    observationLaboratory,
    observationOther,
    encounters,
    immunizations,
    familyMemberHistories,
    relatedPersons,
    coverages,
    organizations,
  };
}
