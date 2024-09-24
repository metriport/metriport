import { Bundle, BundleEntry, EncounterDiagnosis, Resource } from "@medplum/fhirtypes";
import { cloneDeep } from "lodash";
import {
  buildBundleEntry,
  ExtractedFhirTypes,
  extractFhirTypesFromBundle,
} from "../external/fhir/shared/bundle";
import { deduplicateAllergyIntolerances } from "./resources/allergy-intolerance";
import { deduplicateConditions } from "./resources/condition";
import { deduplicateCoverages } from "./resources/coverage";
import { deduplicateDiagReports } from "./resources/diagnostic-report";
import { processDocumentReferences } from "./resources/document-reference";
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

  // Medication deduplication
  console.time("deduplicateMedications");
  const medicationsResult = deduplicateMedications(resourceArrays.medications);
  console.timeEnd("deduplicateMedications");
  console.time("replaceResourceReferencesMedications");

  resourceArrays = replaceResourceReferences(resourceArrays, medicationsResult.refReplacementMap, [
    "medicationAdministrations",
    "medicationStatements",
    "medicationRequests",
  ]);
  console.timeEnd("replaceResourceReferencesMedications");
  resourceArrays.medications = medicationsResult.combinedResources;
  danglingLinks.push(...medicationsResult.danglingReferences);

  // MedicationAdministration deduplication
  console.time("deduplicateMedAdmins");
  const medAdminsResult = deduplicateMedAdmins(resourceArrays.medicationAdministrations);
  console.timeEnd("deduplicateMedAdmins");
  resourceArrays.medicationAdministrations = medAdminsResult.combinedResources;
  danglingLinks.push(...medAdminsResult.danglingReferences);
  // MedicationRequest deduplication
  console.time("deduplicateMedRequests");
  const medRequestResult = deduplicateMedRequests(resourceArrays.medicationRequests);
  console.timeEnd("deduplicateMedRequests");
  resourceArrays.medicationRequests = medRequestResult.combinedResources;
  danglingLinks.push(...medRequestResult.danglingReferences);
  // MedicationStatement deduplication
  console.time("deduplicateMedStatements");
  const medStatementResult = deduplicateMedStatements(resourceArrays.medicationStatements);
  console.timeEnd("deduplicateMedStatements");
  resourceArrays.medicationStatements = medStatementResult.combinedResources;
  danglingLinks.push(...medStatementResult.danglingReferences);
  // DocumentReference cleaning
  console.time("processDocumentReferences");
  resourceArrays.documentReferences = processDocumentReferences(resourceArrays.documentReferences);
  console.timeEnd("processDocumentReferences");

  // Practitioner deduplication
  console.time("deduplicatePractitioners");
  const practitionersResult = deduplicatePractitioners(resourceArrays.practitioners);
  console.timeEnd("deduplicatePractitioners");
  resourceArrays.practitioners = practitionersResult.combinedResources;
  danglingLinks.push(...practitionersResult.danglingReferences);

  // Conditions deduplication
  console.time("deduplicateConditions");
  const conditionsResult = deduplicateConditions(resourceArrays.conditions);
  console.timeEnd("deduplicateConditions");
  resourceArrays.conditions = conditionsResult.combinedResources;
  danglingLinks.push(...conditionsResult.danglingReferences);

  // Allergies deduplication
  console.time("deduplicateAllergyIntolerances");
  const allergiesResult = deduplicateAllergyIntolerances(resourceArrays.allergies);
  console.timeEnd("deduplicateAllergyIntolerances");
  resourceArrays.allergies = allergiesResult.combinedResources;
  danglingLinks.push(...allergiesResult.danglingReferences);

  // Encounter deduplication
  console.time("deduplicateEncounters");
  const encountersResult = deduplicateEncounters(resourceArrays.encounters);
  console.timeEnd("deduplicateEncounters");
  resourceArrays.encounters = encountersResult.combinedResources;
  danglingLinks.push(...encountersResult.danglingReferences);

  // DiagnosticReport deduplication
  console.time("deduplicateDiagReports");
  const diagReportsResult = deduplicateDiagReports(resourceArrays.diagnosticReports);
  console.timeEnd("deduplicateDiagReports");
  resourceArrays.diagnosticReports = diagReportsResult.combinedResources;
  danglingLinks.push(...diagReportsResult.danglingReferences);

  // Immunization deduplication
  console.time("deduplicateImmunizations");
  const immunizationsResult = deduplicateImmunizations(resourceArrays.immunizations);
  console.timeEnd("deduplicateImmunizations");
  resourceArrays.immunizations = immunizationsResult.combinedResources;
  danglingLinks.push(...immunizationsResult.danglingReferences);

  // Procedure deduplication
  console.time("deduplicateProcedures");
  const proceduresResult = deduplicateProcedures(resourceArrays.procedures);
  console.timeEnd("deduplicateProcedures");
  resourceArrays.procedures = proceduresResult.combinedResources;
  danglingLinks.push(...proceduresResult.danglingReferences);

  // Observation (social history) deduplication
  console.time("deduplicateObservationsSocial");
  const obsSocialResult = deduplicateObservationsSocial(resourceArrays.observationSocialHistory);
  console.timeEnd("deduplicateObservationsSocial");
  resourceArrays.observationSocialHistory = obsSocialResult.combinedResources;
  danglingLinks.push(...obsSocialResult.danglingReferences);

  // Observation (labs) deduplication
  console.time("deduplicateObservationsLabs");
  const obsLabsResult = deduplicateObservations(resourceArrays.observationLaboratory);
  console.timeEnd("deduplicateObservationsLabs");
  resourceArrays.observationLaboratory = obsLabsResult.combinedResources;
  danglingLinks.push(...obsLabsResult.danglingReferences);

  // Observation (vitals) deduplication
  console.time("deduplicateObservationsVitals");
  const obsVitalsResult = deduplicateObservations(resourceArrays.observationVitals);
  console.timeEnd("deduplicateObservationsVitals");
  resourceArrays.observationVitals = obsVitalsResult.combinedResources;
  danglingLinks.push(...obsVitalsResult.danglingReferences);

  // Observation (other) deduplication
  console.time("deduplicateObservationsOther");
  const obsOthersResult = deduplicateObservations(resourceArrays.observationOther);
  console.timeEnd("deduplicateObservationsOther");
  resourceArrays.observationOther = obsOthersResult.combinedResources;
  danglingLinks.push(...obsOthersResult.danglingReferences);

  // Location deduplication
  console.time("deduplicateLocations");
  const locationsResult = deduplicateLocations(resourceArrays.locations);
  console.timeEnd("deduplicateLocations");
  resourceArrays.locations = locationsResult.combinedResources;
  danglingLinks.push(...locationsResult.danglingReferences);

  // Organization deduplication
  console.time("deduplicateOrganizations");
  const organizationsResult = deduplicateOrganizations(resourceArrays.organizations);
  console.timeEnd("deduplicateOrganizations");
  resourceArrays.organizations = organizationsResult.combinedResources;
  danglingLinks.push(...organizationsResult.danglingReferences);

  // RelatedPerson deduplication
  console.time("deduplicateRelatedPersons");
  const relatedPersonsResult = deduplicateRelatedPersons(resourceArrays.relatedPersons);
  console.timeEnd("deduplicateRelatedPersons");
  resourceArrays.relatedPersons = relatedPersonsResult.combinedResources;
  danglingLinks.push(...relatedPersonsResult.danglingReferences);

  // FamilyMemberHistory deduplication
  console.time("deduplicateFamilyMemberHistories");
  const famMemHistoriesResult = deduplicateFamilyMemberHistories(
    resourceArrays.familyMemberHistories
  );
  console.timeEnd("deduplicateFamilyMemberHistories");
  resourceArrays.familyMemberHistories = famMemHistoriesResult.combinedResources;
  danglingLinks.push(...famMemHistoriesResult.danglingReferences);

  // Coverage deduplication
  console.time("deduplicateCoverages");
  const coveragesResult = deduplicateCoverages(resourceArrays.coverages);
  console.timeEnd("deduplicateCoverages");
  resourceArrays.coverages = coveragesResult.combinedResources;
  danglingLinks.push(...coveragesResult.danglingReferences);

  // Combine all the remaining replacementMaps into one map
  const combinedReplacementMap = new Map<string, string>([
    ...medAdminsResult.refReplacementMap,
    ...medRequestResult.refReplacementMap,
    ...medStatementResult.refReplacementMap,
    ...practitionersResult.refReplacementMap,
    ...conditionsResult.refReplacementMap,
    ...allergiesResult.refReplacementMap,
    ...encountersResult.refReplacementMap,
    ...diagReportsResult.refReplacementMap,
    ...immunizationsResult.refReplacementMap,
    ...proceduresResult.refReplacementMap,
    ...obsSocialResult.refReplacementMap,
    ...obsLabsResult.refReplacementMap,
    ...obsVitalsResult.refReplacementMap,
    ...obsOthersResult.refReplacementMap,
    ...locationsResult.refReplacementMap,
    ...organizationsResult.refReplacementMap,
    ...relatedPersonsResult.refReplacementMap,
    ...famMemHistoriesResult.refReplacementMap,
    ...coveragesResult.refReplacementMap,
  ]);
  console.time("combineReplacementMaps");
  resourceArrays = replaceResourceReferences(resourceArrays, combinedReplacementMap);
  console.timeEnd("combineReplacementMaps");

  const deduplicatedEntries: BundleEntry<Resource>[] = [];
  // Rebuild the entries with deduplicated resources and add whatever is left unprocessed
  console.time("rebuildDeduplicatedEntries");
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
  console.timeEnd("rebuildDeduplicatedEntries");

  // Remove resources with dangling links
  console.time("removeResourcesWithDanglingLinks");
  const deduplicatedNoDangling = removeResourcesWithDanglingLinks(
    deduplicatedEntries,
    danglingLinks
  );
  console.timeEnd("removeResourcesWithDanglingLinks");

  console.time("removeCompositionsWithDanglingLinks");
  const compositionsNoDangling = removeResourcesWithDanglingLinks(
    resourceArrays.compositions,
    danglingLinks
  );
  console.timeEnd("removeCompositionsWithDanglingLinks");

  // Rebuild the final bundle
  console.time("buildFinalBundle");
  const deduplicatedBundle: Bundle = cloneDeep(fhirBundle);
  deduplicatedBundle.entry = [...deduplicatedNoDangling, ...compositionsNoDangling].map(
    buildBundleEntry
  );
  deduplicatedBundle.total = deduplicatedNoDangling.length;
  console.timeEnd("buildFinalBundle");

  return deduplicatedBundle;
}

/**
 * Finds and updates references to the deduplicated resources
 */
function replaceResourceReferences(
  resourceArrays: ExtractedFhirTypes,
  refReplacementMap: Map<string, string>,
  resourceType?: string[]
): ExtractedFhirTypes {
  return Object.fromEntries(
    Object.entries(resourceArrays).map(([key, resources]) => {
      if (resourceType && !resourceType.includes(key)) {
        return [key, resources];
      }
      if (Array.isArray(resources)) {
        return [
          key,
          resources.map(resource => replaceResourceReference(resource, refReplacementMap)),
        ];
      } else if (resources) {
        // Handle single resource case
        return [key, replaceResourceReference(resources, refReplacementMap)];
      } else {
        // Handle null or undefined case
        return [key, resources];
      }
    })
  );
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
      if (!entry.author.length) {
        entry.author = [{ display: "No Known Author" }];
      }
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
  if ("attester" in entry) {
    entry.attester = entry.attester?.filter(attester => attester.party?.reference !== link);
    if (!entry.attester.length) delete entry.attester;
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

function replaceResourceReference<T extends Resource>(
  entry: T,
  referenceMap: Map<string, string>
): T {
  if (!entry) return entry;

  if ("result" in entry && Array.isArray(entry.result)) {
    entry.result = entry.result.map(item => {
      if (item.reference) {
        const newReference = referenceMap.get(item.reference);
        if (newReference) item.reference = newReference;
      }
      return item;
    });
  }

  if (
    "diagnosis" in entry &&
    Array.isArray(entry.diagnosis) &&
    entry.resourceType === "Encounter"
  ) {
    entry.diagnosis = entry.diagnosis.map(diagnosis => {
      if (diagnosis.condition?.reference) {
        const newReference = referenceMap.get(diagnosis.condition.reference);
        if (newReference) diagnosis.condition.reference = newReference;
      }
      return diagnosis;
    });
  }

  if ("author" in entry && Array.isArray(entry.author) && entry.resourceType === "Composition") {
    entry.author = entry.author.map(author => {
      if (author.reference) {
        const newReference = referenceMap.get(author.reference);
        if (newReference) author.reference = newReference;
      }
      return author;
    });
  }

  if ("section" in entry && Array.isArray(entry.section)) {
    entry.section = entry.section.map(section => {
      if (section.entry) {
        section.entry = section.entry.map(item => {
          if (item.reference) {
            const newReference = referenceMap.get(item.reference);
            if (newReference) item.reference = newReference;
          }
          return item;
        });
      }
      return section;
    });
  }

  if ("location" in entry && Array.isArray(entry.location) && entry.resourceType === "Encounter") {
    entry.location = entry.location.map(location => {
      if (location.location?.reference) {
        const newReference = referenceMap.get(location.location.reference);
        if (newReference) location.location.reference = newReference;
      }
      return location;
    });
  }

  if (
    "participant" in entry &&
    Array.isArray(entry.participant) &&
    entry.resourceType === "Encounter"
  ) {
    entry.participant = entry.participant.map(part => {
      if (part.individual?.reference) {
        const newReference = referenceMap.get(part.individual.reference);
        if (newReference) part.individual.reference = newReference;
      }
      return part;
    });
  }
  if ("performer" in entry && Array.isArray(entry.performer)) {
    entry.performer = entry.performer.map(performer => {
      if ("reference" in performer) {
        const newReference = referenceMap.get(performer.reference);
        if (newReference) performer.reference = newReference;
      } else if ("actor" in performer && "reference" in performer.actor) {
        const newReference = referenceMap.get(performer.actor.reference);
        if (newReference) performer.actor.reference = newReference;
      }
      return performer;
    });
  }

  if ("payor" in entry && Array.isArray(entry.payor)) {
    entry.payor = entry.payor.map(payor => {
      if (payor.reference) {
        const newReference = referenceMap.get(payor.reference);
        if (newReference) payor.reference = newReference;
      }
      return payor;
    });
  }

  if ("encounter" in entry && entry.encounter?.reference) {
    const newReference = referenceMap.get(entry.encounter.reference);
    if (newReference) entry.encounter.reference = newReference;
  }

  if ("medicationReference" in entry && entry.medicationReference?.reference) {
    const newReference = referenceMap.get(entry.medicationReference.reference);
    if (newReference) {
      entry.medicationReference.reference = newReference;
    }
  }

  if ("recorder" in entry && entry.recorder?.reference) {
    const newReference = referenceMap.get(entry.recorder.reference);
    if (newReference) entry.recorder.reference = newReference;
  }

  if ("serviceProvider" in entry && entry.serviceProvider?.reference) {
    const newReference = referenceMap.get(entry.serviceProvider.reference);
    if (newReference) entry.serviceProvider.reference = newReference;
  }

  if (entry.resourceType === "Composition" && "section" in entry) {
    entry.section = entry.section.map(section => {
      if (section.entry) {
        section.entry = section.entry.map(entryRef => {
          if (entryRef.reference) {
            const newReference = referenceMap.get(entryRef.reference);
            if (newReference) {
              entryRef.reference = newReference;
            }
          }
          return entryRef;
        });
      }
      return section;
    });
  }

  return entry;
}
