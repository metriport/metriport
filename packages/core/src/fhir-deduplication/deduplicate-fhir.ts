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
import { createRef } from "./shared";

export function deduplicateFhir(fhirBundle: Bundle<Resource>): Bundle<Resource> {
  let resourceArrays = extractFhirTypesFromBundle(fhirBundle);

  // TODO: Add unit tests for the ID replacements
  const danglingLinks: string[] = [];

  // Practitioner deduplication
  const practitionersResult = deduplicatePractitioners(resourceArrays.practitioners);
  resourceArrays = replaceResourceReferences(resourceArrays, practitionersResult.refReplacementMap);
  resourceArrays.practitioners = practitionersResult.combinedResources;
  danglingLinks.push(...practitionersResult.danglingReferences);

  // Conditions deduplication
  const conditionsResult = deduplicateConditions(resourceArrays.conditions);
  resourceArrays = replaceResourceReferences(resourceArrays, conditionsResult.refReplacementMap);
  resourceArrays.conditions = conditionsResult.combinedResources;
  danglingLinks.push(...conditionsResult.danglingReferences);

  // Allergies deduplication
  const allergiesResult = deduplicateAllergyIntolerances(resourceArrays.allergies);
  resourceArrays = replaceResourceReferences(resourceArrays, allergiesResult.refReplacementMap);
  resourceArrays.allergies = allergiesResult.combinedResources;
  danglingLinks.push(...allergiesResult.danglingReferences);

  // Medication deduplication
  const medicationsResult = deduplicateMedications(resourceArrays.medications);
  resourceArrays = replaceResourceReferences(resourceArrays, medicationsResult.refReplacementMap);
  resourceArrays.medications = medicationsResult.combinedResources;
  danglingLinks.push(...medicationsResult.danglingReferences);

  // MedicationAdministration deduplication
  const medAdminsResult = deduplicateMedAdmins(resourceArrays.medicationAdministrations);
  resourceArrays = replaceResourceReferences(resourceArrays, medAdminsResult.refReplacementMap);
  resourceArrays.medicationAdministrations = medAdminsResult.combinedResources;
  danglingLinks.push(...medAdminsResult.danglingReferences);

  // MedicationRequest deduplication
  const medRequestResult = deduplicateMedRequests(resourceArrays.medicationRequests);
  resourceArrays = replaceResourceReferences(resourceArrays, medRequestResult.refReplacementMap);
  resourceArrays.medicationRequests = medRequestResult.combinedResources;
  danglingLinks.push(...medRequestResult.danglingReferences);

  // MedicationStatement deduplication
  const medStatementResult = deduplicateMedStatements(resourceArrays.medicationStatements);
  resourceArrays = replaceResourceReferences(resourceArrays, medStatementResult.refReplacementMap);
  resourceArrays.medicationStatements = medStatementResult.combinedResources;
  danglingLinks.push(...medStatementResult.danglingReferences);

  // Encounter deduplication
  const encountersResult = deduplicateEncounters(resourceArrays.encounters);
  resourceArrays = replaceResourceReferences(resourceArrays, encountersResult.refReplacementMap);
  resourceArrays.encounters = encountersResult.combinedResources;
  danglingLinks.push(...encountersResult.danglingReferences);

  // DiagnosticReport deduplication
  const diagReportsResult = deduplicateDiagReports(resourceArrays.diagnosticReports);
  resourceArrays = replaceResourceReferences(resourceArrays, diagReportsResult.refReplacementMap);
  resourceArrays.diagnosticReports = diagReportsResult.combinedResources;
  danglingLinks.push(...diagReportsResult.danglingReferences);

  // Immunization deduplication
  const immunizationsResult = deduplicateImmunizations(resourceArrays.immunizations);
  resourceArrays = replaceResourceReferences(resourceArrays, immunizationsResult.refReplacementMap);
  resourceArrays.immunizations = immunizationsResult.combinedResources;
  danglingLinks.push(...immunizationsResult.danglingReferences);

  // Procedure deduplication
  const proceduresResult = deduplicateProcedures(resourceArrays.procedures);
  resourceArrays = replaceResourceReferences(resourceArrays, proceduresResult.refReplacementMap);
  resourceArrays.procedures = proceduresResult.combinedResources;
  danglingLinks.push(...proceduresResult.danglingReferences);

  // Observation (social history) deduplication
  const obsSocialResult = deduplicateObservationsSocial(resourceArrays.observationSocialHistory);
  resourceArrays = replaceResourceReferences(resourceArrays, obsSocialResult.refReplacementMap);
  resourceArrays.observationSocialHistory = obsSocialResult.combinedResources;
  danglingLinks.push(...obsSocialResult.danglingReferences);

  // Observation (labs) deduplication
  const obsLabsResult = deduplicateObservations(resourceArrays.observationLaboratory);
  resourceArrays = replaceResourceReferences(resourceArrays, obsLabsResult.refReplacementMap);
  resourceArrays.observationLaboratory = obsLabsResult.combinedResources;
  danglingLinks.push(...obsLabsResult.danglingReferences);

  // Observation (vitals) deduplication
  const obsVitalsResult = deduplicateObservations(resourceArrays.observationVitals);
  resourceArrays = replaceResourceReferences(resourceArrays, obsVitalsResult.refReplacementMap);
  resourceArrays.observationVitals = obsVitalsResult.combinedResources;
  danglingLinks.push(...obsVitalsResult.danglingReferences);

  // Observation (other) deduplication
  const obsOthersResult = deduplicateObservations(resourceArrays.observationOther);
  resourceArrays = replaceResourceReferences(resourceArrays, obsOthersResult.refReplacementMap);
  resourceArrays.observationOther = obsOthersResult.combinedResources;
  danglingLinks.push(...obsOthersResult.danglingReferences);

  // Location deduplication
  const locationsResult = deduplicateLocations(resourceArrays.locations);
  resourceArrays = replaceResourceReferences(resourceArrays, locationsResult.refReplacementMap);
  resourceArrays.locations = locationsResult.combinedResources;
  danglingLinks.push(...locationsResult.danglingReferences);

  // Organization deduplication
  const organizationsResult = deduplicateOrganizations(resourceArrays.organizations);
  resourceArrays = replaceResourceReferences(resourceArrays, organizationsResult.refReplacementMap);
  resourceArrays.organizations = organizationsResult.combinedResources;
  danglingLinks.push(...organizationsResult.danglingReferences);

  // RelatedPerson deduplication
  const relatedPersonsResult = deduplicateRelatedPersons(resourceArrays.relatedPersons);
  resourceArrays = replaceResourceReferences(
    resourceArrays,
    relatedPersonsResult.refReplacementMap
  );
  resourceArrays.relatedPersons = relatedPersonsResult.combinedResources;
  danglingLinks.push(...relatedPersonsResult.danglingReferences);

  // FamilyMemberHistory deduplication
  const famMemHistoriesResult = deduplicateFamilyMemberHistories(
    resourceArrays.familyMemberHistories
  );
  resourceArrays = replaceResourceReferences(
    resourceArrays,
    famMemHistoriesResult.refReplacementMap
  );
  resourceArrays.familyMemberHistories = famMemHistoriesResult.combinedResources;
  danglingLinks.push(...famMemHistoriesResult.danglingReferences);

  // Coverage deduplication
  const coveragesResult = deduplicateCoverages(resourceArrays.coverages);
  resourceArrays = replaceResourceReferences(resourceArrays, coveragesResult.refReplacementMap);
  resourceArrays.coverages = coveragesResult.combinedResources;
  danglingLinks.push(...coveragesResult.danglingReferences);

  const deduplicatedEntries: BundleEntry<Resource>[] = [];
  // Rebuild the entries with deduplicated resources and add whatever is left unprocessed
  for (const [key, resources] of Object.entries(resourceArrays)) {
    // we will add compositions later
    if (key === "compositions") {
      continue;
    } else {
      // Extract all other resources
      const entriesArray = resources && Array.isArray(resources) ? resources : [resources];
      const entriesFlat = entriesArray.flatMap(v => v || []);
      const entriesWithDeduplicatedReferences = entriesFlat.map(removeDuplicateReferences);
      deduplicatedEntries.push(...entriesWithDeduplicatedReferences);
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

const immunizationFiltersMap = new Map<string, ResourceFilter>([
  ["Practitioner", removeDanglingReferences],
  ["Organization", removeDanglingReferences],
]);

const resourceFiltersMap = new Map<string, Map<string, ResourceFilter>>([
  ["AllergyIntolerance", allergiesFiltersMap],
  ["Condition", conditionsFiltersMap],
  ["Coverage", coveragesFiltersMap],
  ["DiagnosticReport", diagReportFiltersMap],
  ["Encounter", encounterFiltersMap],
  ["Immunization", immunizationFiltersMap],
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
  if ("requester" in entry) {
    if (entry.requester.reference === link) delete entry.requester;
  }
  if ("performer" in entry) {
    if (Array.isArray(entry.performer)) {
      if (
        entry.resourceType === "DiagnosticReport" ||
        entry.resourceType === "Observation" ||
        entry.resourceType === "ServiceRequest"
      ) {
        entry.performer = entry.performer.filter(p => p.reference !== link);
      } else if (
        entry.resourceType === "Immunization" ||
        entry.resourceType === "MedicationAdministration" ||
        entry.resourceType === "MedicationDispense" ||
        entry.resourceType === "MedicationRequest" ||
        entry.resourceType === "Procedure" ||
        entry.resourceType === "RiskAssessment"
      ) {
        entry.performer = entry.performer?.filter(p => p.actor?.reference !== link);
      }
      if (entry.performer.length === 0) {
        delete entry.performer;
      }
    } else {
      if (entry.performer.reference === link) {
        delete entry.performer;
      }
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

export function removeDuplicateReferencesFromBundle<T extends Resource>(entries: T[]): T[] {
  return entries.map(removeDuplicateReferences);
}

function removeDuplicateReferences<T extends Resource>(entry: T): T {
  if (!entry) return entry;

  if ("result" in entry && entry.result) {
    const results = entry.result;
    if (Array.isArray(results)) {
      const uniqueResults = new Set();
      entry.result = results.filter(item => {
        if (uniqueResults.has(item.reference)) return false;
        uniqueResults.add(item.reference);
        return true;
      });
    }
  }

  if ("diagnosis" in entry && entry.diagnosis && entry.resourceType === "Encounter") {
    const diagnoses = entry.diagnosis as EncounterDiagnosis[];
    const uniqueDiagnoses = new Set();
    entry.diagnosis = diagnoses.filter(diagnosis => {
      if (uniqueDiagnoses.has(diagnosis.condition?.reference)) {
        return false;
      }
      uniqueDiagnoses.add(diagnosis.condition?.reference);
      return true;
    });
  }

  if ("author" in entry && entry.author && entry.resourceType === "Composition") {
    const uniqueAuthors = new Set();
    entry.author = entry.author?.filter(author => {
      if (uniqueAuthors.has(author.reference)) return false;
      uniqueAuthors.add(author.reference);
      return true;
    });
  }

  if ("section" in entry && entry.section) {
    entry.section = entry.section.map(section => {
      if (section.entry) {
        const uniqueEntries = new Set();
        section.entry = section.entry.filter(item => {
          if (uniqueEntries.has(item.reference)) return false;
          uniqueEntries.add(item.reference);
          return true;
        });
      }
      return section;
    });
  }

  if ("location" in entry && entry.location && entry.resourceType === "Encounter") {
    const uniqueLocations = new Set();
    entry.location = entry.location.filter(location => {
      if (uniqueLocations.has(location.location?.reference)) return false;
      uniqueLocations.add(location.location?.reference);
      return true;
    });
  }

  if ("participant" in entry && entry.participant && entry.resourceType === "Encounter") {
    const uniqueParticipants = new Set();
    entry.participant = entry.participant?.filter(part => {
      if (uniqueParticipants.has(part.individual?.reference)) return false;
      uniqueParticipants.add(part.individual?.reference);
      return true;
    });
  }

  if ("performer" in entry && entry.performer) {
    if (entry.resourceType === "DiagnosticReport") {
      const uniquePerformers = new Set();
      entry.performer = entry.performer?.filter(performer => {
        if (uniquePerformers.has(performer.reference)) return false;
        uniquePerformers.add(performer.reference);
        return true;
      });
    } else if (entry.resourceType === "Procedure") {
      const uniquePerformers = new Set();
      entry.performer = entry.performer?.filter(performer => {
        if (uniquePerformers.has(performer.actor)) return false;
        uniquePerformers.add(performer.actor);
        return true;
      });
    }
  }

  if ("payor" in entry && entry.payor) {
    const uniquePayors = new Set();
    entry.payor = entry.payor?.filter(payor => {
      if (uniquePayors.has(payor.reference)) return false;
      uniquePayors.add(payor.reference);
      return true;
    });
  }

  return entry;
}
