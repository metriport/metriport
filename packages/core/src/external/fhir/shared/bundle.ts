import {
  AllergyIntolerance,
  Binary,
  Bundle,
  BundleEntry,
  Communication,
  Composition,
  Condition,
  Consent,
  Coverage,
  Device,
  DiagnosticReport,
  DocumentReference,
  Encounter,
  FamilyMemberHistory,
  Goal,
  Immunization,
  Location,
  Medication,
  MedicationAdministration,
  MedicationDispense,
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
  ServiceRequest,
} from "@medplum/fhirtypes";
import { filterTruthy } from "@metriport/shared/common/filter-map";
import { isBinary } from ".";
import { SearchSetBundle } from "@metriport/shared/medical";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { uniq } from "lodash";
import { wrapIdInUrnId, wrapIdInUrnUuid } from "../../../util/urn";
import { isValidUuid } from "../../../util/uuid-v7";

dayjs.extend(duration);

const referenceRegex = new RegExp(/"reference":\s*"(.+?)"/g);

export type ReferenceWithIdAndType<T extends Resource = Resource> = Reference<T> &
  Required<Pick<Reference<T>, "id" | "type">>;

/**
 * Returns the references found in the given resources, including the missing ones.
 *
 * @param resources
 * @param referencesToInclude The resource types to include in the result. If not set,
 *        references with all resource types will be included.
 * @param referencesToExclude The resource types to exclude from the result. If not set,
 *        no references will be excluded.
 * @returns References found in the given resources, including the missing ones.
 */
export function getReferencesFromResources({
  resources,
  referencesToInclude,
  referencesToExclude,
}: {
  resources: Resource[];
  referencesToInclude?: ResourceType[];
  referencesToExclude?: ResourceType[];
}): { references: Reference[]; missingReferences: ReferenceWithIdAndType[] } {
  if (resources.length <= 0) return { references: [], missingReferences: [] };
  const resourceIds = resources.flatMap(r => r.id ?? []);
  const references = getReferences({
    resources,
    referencesToInclude,
    referencesToExclude,
  });
  const missingReferences: ReferenceWithIdAndType[] = [];
  for (const ref of references) {
    if (!ref.id) continue;
    if (!resourceIds.includes(ref.id)) missingReferences.push(ref);
  }
  return { references, missingReferences };
}

// TODO 2355 Refactor this
/**
 * @deprecated This is not a proper implementation to return References. Those might be represented
 * in different ways than the relative one "Patient/123". We should create a generic implementation
 * based on `getPatientReferencesFromFhirBundle` so we can get all references from a list of
 * resources (and update the patient's one to use it).
 * @see https://github.com/metriport/metriport-internal/issues/2355
 *
 * Return the references found in the given resources.
 *
 * @param resources The resources to search for references
 * @param referencesToInclude The resource types to include in the result. If not set,
 *        references with all resource types will be included.
 * @param referencesToExclude The resource types to exclude from the result. If not set,
 *        no references will be excluded.
 * @returns The references found in the given resources.
 */
export function getReferences({
  resources,
  referencesToInclude,
  referencesToExclude = [],
}: {
  resources: Resource[] | undefined;
  referencesToInclude?: ResourceType[] | undefined;
  referencesToExclude?: ResourceType[] | undefined;
}): ReferenceWithIdAndType[] {
  if (!resources || resources.length <= 0) return [];
  const rawContents = JSON.stringify(resources);
  const matches = rawContents.matchAll(referenceRegex);
  const references: string[] = [];
  for (const match of matches) {
    const ref = match[1];
    if (ref) references.push(ref);
  }
  const uniqueRefs = uniq(references);

  const preResult: ReferenceWithIdAndType[] = uniqueRefs
    .flatMap(buildReferenceFromStringRelative)
    .flatMap(filterTruthy);

  const includedRefs = !referencesToInclude
    ? preResult
    : preResult.filter(r => referencesToInclude.includes(r.type));

  const remainingRefs = !referencesToExclude.length
    ? includedRefs
    : includedRefs.filter(r => !referencesToExclude.includes(r.type));

  return remainingRefs;
}

function buildReferenceFromStringRelative(reference: string): ReferenceWithIdAndType | undefined {
  const parts = reference.split("/");
  const type = parts[0] as ResourceType | undefined;
  const id = parts[1];
  if (!id || !type) return undefined;
  return { id, type, reference };
}

export function buildBundle({
  type = "searchset",
  entries = [],
}: {
  type?: Bundle["type"];
  entries?: BundleEntry[];
} = {}): Bundle {
  return { resourceType: "Bundle", total: entries.length, type, entry: entries };
}

export function buildSearchSetBundle<T extends Resource = Resource>({
  entries = [],
}: {
  entries?: BundleEntry<T>[];
} = {}): SearchSetBundle<T> {
  return buildBundle({ type: "searchset", entries }) as SearchSetBundle<T>;
}

export const buildBundleEntry = <T extends Resource>(resource: T): BundleEntry<T> => {
  const fullUrl = buildFullUrl(resource);
  return {
    ...(fullUrl ? { fullUrl } : {}),
    resource,
  };
};
export const buildFullUrl = <T extends Resource>(resource: T): string | undefined => {
  if (!resource || !resource.id) return undefined;
  if (isValidUuid(resource.id)) return wrapIdInUrnUuid(resource.id);
  return wrapIdInUrnId(resource.id);
};

export type ExtractedFhirTypes = {
  binaries: Binary[];
  diagnosticReports: DiagnosticReport[];
  patient: Patient;
  practitioners: Practitioner[];
  compositions: Composition[];
  medications: Medication[];
  medicationAdministrations: MedicationAdministration[];
  medicationRequests: MedicationRequest[];
  medicationDispenses: MedicationDispense[];
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
  communications: Communication[];
  consents: Consent[];
  devices: Device[];
  goals: Goal[];
  serviceRequests: ServiceRequest[];
  documentReferences: DocumentReference[];
};

export function initExtractedFhirTypes(patient: Patient): ExtractedFhirTypes {
  const emptyBundle: Bundle = {
    resourceType: "Bundle",
    type: "collection",
    entry: [
      {
        resource: patient,
      },
    ],
  };
  return extractFhirTypesFromBundle(emptyBundle);
}

export function extractFhirTypesFromBundle(bundle: Bundle): ExtractedFhirTypes {
  let patient: Patient | undefined;
  const practitioners: Practitioner[] = [];
  const binaries: Binary[] = [];
  const diagnosticReports: DiagnosticReport[] = [];
  const compositions: Composition[] = [];
  const medicationAdministrations: MedicationAdministration[] = [];
  const medicationRequests: MedicationRequest[] = [];
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
  const medicationDispenses: MedicationDispense[] = [];
  const communications: Communication[] = [];
  const consents: Consent[] = [];
  const devices: Device[] = [];
  const goals: Goal[] = [];
  const serviceRequests: ServiceRequest[] = [];
  const documentReferences: DocumentReference[] = [];

  if (bundle.entry) {
    for (const entry of bundle.entry) {
      const resource = entry.resource;
      if (resource?.resourceType === "Patient") {
        patient = resource as Patient;
      } else if (isBinary(resource)) {
        binaries.push(resource as Binary);
      } else if (resource?.resourceType === "DocumentReference") {
        documentReferences.push(resource as DocumentReference);
      } else if (resource?.resourceType === "Composition") {
        compositions.push(resource as Composition);
      } else if (resource?.resourceType === "MedicationAdministration") {
        medicationAdministrations.push(resource as MedicationAdministration);
      } else if (resource?.resourceType === "MedicationDispense") {
        medicationDispenses.push(resource as MedicationDispense);
      } else if (resource?.resourceType === "MedicationRequest") {
        medicationRequests.push(resource as MedicationRequest);
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
      } else if (resource?.resourceType === "Communication") {
        communications.push(resource as Communication);
      } else if (resource?.resourceType === "Consent") {
        consents.push(resource as Consent);
      } else if (resource?.resourceType === "Device") {
        devices.push(resource as Device);
      } else if (resource?.resourceType === "Goal") {
        goals.push(resource as Goal);
      } else if (resource?.resourceType === "ServiceRequest") {
        serviceRequests.push(resource as ServiceRequest);
      }
    }
  }

  if (!patient) {
    throw new Error("Patient not found in bundle");
  }

  return {
    patient,
    practitioners,
    binaries,
    compositions,
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
    medicationDispenses,
    communications,
    consents,
    devices,
    goals,
    serviceRequests,
    documentReferences,
  };
}
