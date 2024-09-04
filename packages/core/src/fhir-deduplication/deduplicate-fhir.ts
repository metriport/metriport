import { Bundle, BundleEntry, EncounterDiagnosis, Resource } from "@medplum/fhirtypes";
import { cloneDeep } from "lodash";
import { ExtractedFhirTypes, extractFhirTypesFromBundle } from "../external/fhir/shared/bundle";
import { deduplicateAllergyIntolerances } from "./resources/allergy-intolerance";
import { deduplicateConditions } from "./resources/condition";
import { deduplicateCoverages } from "./resources/coverage";
import { deduplicateDiagReports } from "./resources/diagnostic-report";
import { deduplicateEncounters } from "./resources/encounter";
import { deduplicateFamilyMemberHistories } from "./resources/family-member-history";
import { deduplicateImmunizations } from "./resources/immunization";
import { deduplicateLocations } from "./resources/location";
import { deduplicateMedications } from "./resources/medication";
import { deduplicateMedAdmins } from "./resources/medication-administration";
import { deduplicateMedRequests } from "./resources/medication-request";
import { deduplicateMedStatements } from "./resources/medication-statement";
import { deduplicateObservations } from "./resources/observation";
import { deduplicateObservationsSocial } from "./resources/observation-social";
import { deduplicateOrganizations } from "./resources/organization";
import { deduplicatePractitioners } from "./resources/practitioner";
import { deduplicateProcedures } from "./resources/procedure";
import { deduplicateRelatedPersons } from "./resources/related-person";
import { DeduplicationResult, createRef } from "./shared";

export function deduplicateFhir(fhirBundle: Bundle<Resource>): Bundle<Resource> {
  let resourceArrays = extractFhirTypesFromBundle(fhirBundle);
  const deduplicatedEntries: BundleEntry<Resource>[] = [];

  // TODO: Add unit tests for the ID replacements

  const processedArrays: (keyof ExtractedFhirTypes)[] = [];
  const danglingLinks: string[] = [];

  // Practitioner deduplication
  const practitionersResult = deduplicatePractitioners(resourceArrays.practitioners);
  resourceArrays = updateResourceArrays(resourceArrays, practitionersResult, "practitioners");
  processedArrays.push("practitioners");
  danglingLinks.push(...practitionersResult.danglingReferences);

  // Conditions deduplication
  const conditionsResult = deduplicateConditions(resourceArrays.conditions);
  resourceArrays = updateResourceArrays(resourceArrays, conditionsResult, "conditions");
  processedArrays.push("conditions");
  danglingLinks.push(...conditionsResult.danglingReferences);

  // Allergies deduplication
  const allergiesResult = deduplicateAllergyIntolerances(resourceArrays.allergies);
  resourceArrays = updateResourceArrays(resourceArrays, allergiesResult, "allergies");
  processedArrays.push("allergies");
  danglingLinks.push(...allergiesResult.danglingReferences);

  // Medication deduplication
  const medicationsResult = deduplicateMedications(resourceArrays.medications);
  resourceArrays = updateResourceArrays(resourceArrays, medicationsResult, "medications");
  processedArrays.push("medications");
  danglingLinks.push(...medicationsResult.danglingReferences);

  // MedicationAdministration deduplication
  const medAdminsResult = deduplicateMedAdmins(resourceArrays.medicationAdministrations);
  resourceArrays = updateResourceArrays(
    resourceArrays,
    medAdminsResult,
    "medicationAdministrations"
  );
  processedArrays.push("medicationAdministrations");
  danglingLinks.push(...medAdminsResult.danglingReferences);

  // MedicationRequest deduplication
  const medRequestResult = deduplicateMedRequests(resourceArrays.medicationRequests);
  resourceArrays = updateResourceArrays(resourceArrays, medRequestResult, "medicationRequests");
  processedArrays.push("medicationRequests");
  danglingLinks.push(...medRequestResult.danglingReferences);

  // MedicationStatement deduplication
  const medStatementResult = deduplicateMedStatements(resourceArrays.medicationStatements);
  resourceArrays = updateResourceArrays(resourceArrays, medStatementResult, "medicationStatements");
  processedArrays.push("medicationStatements");
  danglingLinks.push(...medStatementResult.danglingReferences);

  // Encounter deduplication
  const encountersResult = deduplicateEncounters(resourceArrays.encounters);
  resourceArrays = updateResourceArrays(resourceArrays, encountersResult, "encounters");
  processedArrays.push("encounters");
  danglingLinks.push(...encountersResult.danglingReferences);

  // DiagnosticReport deduplication
  const diagReportsResult = deduplicateDiagReports(resourceArrays.diagnosticReports);
  resourceArrays = updateResourceArrays(resourceArrays, diagReportsResult, "diagnosticReports");
  processedArrays.push("diagnosticReports");
  danglingLinks.push(...diagReportsResult.danglingReferences);

  // Immunization deduplication
  const immunizationsResult = deduplicateImmunizations(resourceArrays.immunizations);
  resourceArrays = updateResourceArrays(resourceArrays, immunizationsResult, "immunizations");
  processedArrays.push("immunizations");
  danglingLinks.push(...immunizationsResult.danglingReferences);

  // Procedure deduplication
  const proceduresResult = deduplicateProcedures(resourceArrays.procedures);
  resourceArrays = updateResourceArrays(resourceArrays, proceduresResult, "procedures");
  processedArrays.push("procedures");
  danglingLinks.push(...proceduresResult.danglingReferences);

  // Observation (social history) deduplication
  const obsSocialResult = deduplicateObservationsSocial(resourceArrays.observationSocialHistory);
  resourceArrays = updateResourceArrays(
    resourceArrays,
    obsSocialResult,
    "observationSocialHistory"
  );
  processedArrays.push("observationSocialHistory");
  danglingLinks.push(...obsSocialResult.danglingReferences);

  // Observation (labs) deduplication
  const obsLabsResult = deduplicateObservations(resourceArrays.observationLaboratory);
  resourceArrays = updateResourceArrays(resourceArrays, obsLabsResult, "observationLaboratory");
  processedArrays.push("observationLaboratory");
  danglingLinks.push(...obsLabsResult.danglingReferences);

  // Observation (vitals) deduplication
  const obsVitalsResult = deduplicateObservations(resourceArrays.observationVitals);
  resourceArrays = updateResourceArrays(resourceArrays, obsVitalsResult, "observationVitals");
  processedArrays.push("observationVitals");
  danglingLinks.push(...obsVitalsResult.danglingReferences);

  // Observation (other) deduplication
  const obsOthersResult = deduplicateObservations(resourceArrays.observationOther);
  resourceArrays = updateResourceArrays(resourceArrays, obsOthersResult, "observationOther");
  processedArrays.push("observationOther");
  danglingLinks.push(...obsOthersResult.danglingReferences);

  // Location deduplication
  const locationsResult = deduplicateLocations(resourceArrays.locations);
  resourceArrays = updateResourceArrays(resourceArrays, locationsResult, "locations");
  processedArrays.push("locations");
  danglingLinks.push(...locationsResult.danglingReferences);

  // Organization deduplication
  const organizationsResult = deduplicateOrganizations(resourceArrays.organizations);
  resourceArrays = updateResourceArrays(resourceArrays, organizationsResult, "organizations");
  processedArrays.push("organizations");
  danglingLinks.push(...organizationsResult.danglingReferences);

  // RelatedPerson deduplication
  const relatedPersonsResult = deduplicateRelatedPersons(resourceArrays.relatedPersons);
  resourceArrays = updateResourceArrays(resourceArrays, relatedPersonsResult, "relatedPersons");
  processedArrays.push("relatedPersons");
  danglingLinks.push(...relatedPersonsResult.danglingReferences);

  // FamilyMemberHistory deduplication
  const famMemHistoriesResult = deduplicateFamilyMemberHistories(
    resourceArrays.familyMemberHistories
  );
  resourceArrays = updateResourceArrays(
    resourceArrays,
    famMemHistoriesResult,
    "familyMemberHistories"
  );
  processedArrays.push("familyMemberHistories");
  danglingLinks.push(...famMemHistoriesResult.danglingReferences);

  // Coverage deduplication
  const coveragesResult = deduplicateCoverages(resourceArrays.coverages);
  resourceArrays = updateResourceArrays(resourceArrays, coveragesResult, "coverages");
  processedArrays.push("coverages");
  danglingLinks.push(...coveragesResult.danglingReferences);

  // Rebuild the entries with deduplicated resources and add whatever is left unprocessed
  for (const [key, resources] of Object.entries(resourceArrays)) {
    // we will add compositions later
    if (processedArrays.includes(key as keyof ExtractedFhirTypes) || key === "compositions") {
      continue;
    } else {
      // Push all other resources unchanged
      const entriesArray = resources && Array.isArray(resources) ? resources : [resources];
      const entriesFlat = entriesArray.flatMap(v => v || []);
      deduplicatedEntries.push(...entriesFlat);
    }
  }

  const deduplicatedNoDangling = removeResourcesWithDanglingLinks(
    deduplicatedEntries,
    danglingLinks
  );

  const compositionsNoDangling = removeResourcesWithDanglingLinks(
    resourceArrays.compositions,
    danglingLinks
  );

  const deduplicatedBundle: Bundle = cloneDeep(fhirBundle);
  deduplicatedBundle.entry = [...deduplicatedNoDangling, ...compositionsNoDangling].map(
    r => ({ fullUrl: `urn:uuid:${r.id}`, resource: r } as BundleEntry<Resource>)
  );

  deduplicatedBundle.total = deduplicatedNoDangling.length;

  return deduplicatedBundle;
}

function updateResourceArrays<T extends Resource>(
  resourceArrays: ExtractedFhirTypes,
  results: DeduplicationResult<T>,
  targetKey: keyof ExtractedFhirTypes
) {
  resourceArrays = replaceResourceReferences(resourceArrays, results.refReplacementMap);

  if (targetKey in resourceArrays) {
    resourceArrays[targetKey] = results.combinedResources as ExtractedFhirTypes[typeof targetKey];
  }

  return resourceArrays;
}

/**
 * Finds and updates references to the deduplicated resources
 */
function replaceResourceReferences(
  resourceArrays: ExtractedFhirTypes,
  idMap: Map<string, string[]>
): ExtractedFhirTypes {
  let updatedArrays = JSON.stringify(resourceArrays);
  for (const [masterRef, consumedRefs] of idMap.entries()) {
    for (const consumedRef of consumedRefs) {
      const regex = new RegExp(consumedRef, "g");
      updatedArrays = updatedArrays.replace(regex, masterRef);
    }
  }

  return JSON.parse(updatedArrays);
}

type ResourceFilter = (entry: Resource, link: string) => Resource | undefined;

const allergiesFiltersMap = new Map<string, ResourceFilter>([
  ["Practitioner", removeDanglingReferences],
]);

const compositionFiltersMap = new Map<
  string,
  typeof removeResource | typeof removeDanglingReferences
>([["all", removeDanglingReferences]]);

const medicationRelatedFiltersMap = new Map<string, ResourceFilter>([
  ["Medication", removeResource],
]);

const encounterFiltersMap = new Map<string, ResourceFilter>([
  ["Condition", removeDanglingReferences],
  ["Location", removeDanglingReferences],
  ["Practitioner", removeDanglingReferences],
]);

const conditionsFiltersMap = new Map<string, ResourceFilter>([
  ["Practitioner", removeDanglingReferences],
]);

const coveragesFiltersMap = new Map<string, ResourceFilter>([
  ["Organization", removeDanglingReferences],
]);

const diagReportFiltersMap = new Map<string, ResourceFilter>([
  ["Observation", removeDanglingReferences],
  ["Encounter", removeDanglingReferences],
  ["Practitioner", removeDanglingReferences],
  ["Organization", removeDanglingReferences],
]);

const observationFiltersMap = new Map<string, ResourceFilter>([
  ["Practitioner", removeDanglingReferences],
  ["Organization", removeDanglingReferences],
]);

const procedureFiltersMap = new Map<string, ResourceFilter>([
  ["Practitioner", removeDanglingReferences],
  ["Organization", removeDanglingReferences],
]);

const resourceFiltersMap = new Map<string, Map<string, ResourceFilter>>([
  ["AllergyIntolerance", allergiesFiltersMap],
  ["Condition", conditionsFiltersMap],
  ["Coverage", coveragesFiltersMap],
  ["DiagnosticReport", diagReportFiltersMap],
  ["Encounter", encounterFiltersMap],
  ["MedicationStatement", medicationRelatedFiltersMap],
  ["MedicationRequest", medicationRelatedFiltersMap],
  ["MedicationAdministration", medicationRelatedFiltersMap],
  ["Composition", compositionFiltersMap],
  ["Observation", observationFiltersMap],
  ["Procedure", procedureFiltersMap],
]);

export function removeResourcesWithDanglingLinks(
  entries: BundleEntry<Resource>[],
  links: string[]
) {
  return entries.flatMap(entry => handleDanglingLinks(entry as Resource, links));
}

function handleDanglingLinks(res: Resource, danglingLinks: string[]): Resource | [] {
  if (res) {
    let entry = res;
    const filtersMap = resourceFiltersMap.get(res.resourceType);

    if (filtersMap) {
      for (const danglingLink of danglingLinks) {
        const linkResourceType =
          res.resourceType === "Composition" ? "all" : danglingLink.split("/")[0];
        if (linkResourceType) {
          const callbackFn = filtersMap.get(linkResourceType);
          if (callbackFn) {
            const result = callbackFn(entry, danglingLink);
            if (result) entry = result;
            else {
              // removed resources become dangling links
              danglingLinks.push(createRef(entry));
              return [];
            }
          }
        }
      }
    }
    return entry;
  }
  return [];
}

function removeResource<T extends Resource>(entry: T, link: string): T | undefined {
  if (JSON.stringify(entry).includes(link)) return undefined;
  return entry;
}

function removeDanglingReferences<T extends Resource>(entry: T, link: string): T {
  if (!entry) return entry;
  if ("result" in entry) {
    const results = entry.result;
    if (Array.isArray(results)) {
      entry.result = results.filter(entry => entry.reference !== link);
      if (!entry.result.length) delete entry.result;
    }
  }
  if ("encounter" in entry) {
    const encounterRef = entry.encounter;
    if (encounterRef.reference === link) delete entry.encounter;
  }
  if ("diagnosis" in entry) {
    if (entry.resourceType === "Encounter") {
      const diagnoses = entry.diagnosis as EncounterDiagnosis[];
      entry.diagnosis = diagnoses.filter(diagnosis => diagnosis.condition?.reference !== link);
      if (!entry.diagnosis.length) delete entry.diagnosis;
    }
  }
  if ("author" in entry) {
    if (entry.resourceType === "Composition") {
      entry.author = entry.author?.filter(author => author.reference !== link);
      if (!entry.author.length) delete entry.author;
    }
  }
  if ("custodian" in entry) {
    if (entry.custodian.reference === link) delete entry.custodian;
  }
  if ("section" in entry) {
    entry.section = entry.section.map(section => {
      if (section.entry) section.entry = section.entry.filter(entry => entry.reference !== link);
      return section;
    });
  }
  if ("location" in entry) {
    if (entry.resourceType === "Encounter") {
      entry.location = entry.location.filter(location => location.location?.reference !== link);
      if (!entry.location.length) delete entry.location;
    }
  }
  if ("participant" in entry) {
    if (entry.resourceType === "Encounter") {
      entry.participant = entry.participant?.filter(part => part.individual?.reference !== link);
      if (!entry.participant.length) delete entry.participant;
    }
  }
  if ("performer" in entry) {
    if (entry.resourceType === "DiagnosticReport") {
      entry.performer = entry.performer?.filter(performer => performer.reference !== link);
      if (!entry.performer.length) delete entry.performer;
    } else if (entry.resourceType === "Procedure") {
      entry.performer = entry.performer?.filter(performer => performer.actor !== link);
      if (!entry.performer.length) delete entry.performer;
    }
  }
  if ("recorder" in entry) {
    if (entry.recorder.reference === link) delete entry.recorder;
  }
  if ("serviceProvider" in entry) {
    if (entry.serviceProvider.reference === link) delete entry.serviceProvider;
  }
  if ("payor" in entry) {
    entry.payor = entry.payor?.filter(payor => payor.reference !== link);
    if (!entry.payor.length) delete entry.payor;
  }

  return entry;
}
