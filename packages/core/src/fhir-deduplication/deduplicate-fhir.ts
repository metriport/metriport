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
  const deduplicatedEntries: BundleEntry<Resource>[] = [];

  // TODO: Add unit tests for the ID replacements

  const processedArrays: string[] = [];
  const danglingLinks: string[] = [];

  // Practitioner deduplication
  const practitionersResult = deduplicatePractitioners(resourceArrays.practitioners);
  resourceArrays = replaceResourceReferences(resourceArrays, practitionersResult.refReplacementMap);
  processedArrays.push("practitioners");
  danglingLinks.push(...practitionersResult.danglingReferences);
  deduplicatedEntries.push(...practitionersResult.combinedPractitioners);

  // Conditions deduplication
  const conditionsResult = deduplicateConditions(resourceArrays.conditions);
  resourceArrays = replaceResourceReferences(resourceArrays, conditionsResult.refReplacementMap);
  processedArrays.push("conditions");
  danglingLinks.push(...conditionsResult.danglingReferences);
  deduplicatedEntries.push(...conditionsResult.combinedConditions);

  // Allergies deduplication
  const allergiesResult = deduplicateAllergyIntolerances(resourceArrays.allergies);
  resourceArrays = replaceResourceReferences(resourceArrays, allergiesResult.refReplacementMap);
  processedArrays.push("allergies");
  danglingLinks.push(...allergiesResult.danglingReferences);
  deduplicatedEntries.push(...allergiesResult.combinedAllergies);

  // Medication deduplication
  const medicationsResult = deduplicateMedications(resourceArrays.medications);
  resourceArrays = replaceResourceReferences(resourceArrays, medicationsResult.refReplacementMap);
  processedArrays.push("medications");
  danglingLinks.push(...medicationsResult.danglingReferences);
  deduplicatedEntries.push(...medicationsResult.combinedMedications);

  // MedicationAdministration deduplication
  const medAdminsResult = deduplicateMedAdmins(resourceArrays.medicationAdministrations);
  resourceArrays = replaceResourceReferences(resourceArrays, medAdminsResult.refReplacementMap);
  processedArrays.push("medicationAdministrations");
  danglingLinks.push(...medAdminsResult.danglingReferences);
  deduplicatedEntries.push(...medAdminsResult.combinedMedAdmins);

  // MedicationRequest deduplication
  const medRequestResult = deduplicateMedRequests(resourceArrays.medicationRequests);
  resourceArrays = replaceResourceReferences(resourceArrays, medRequestResult.refReplacementMap);
  processedArrays.push("medicationRequests");
  danglingLinks.push(...medRequestResult.danglingReferences);
  deduplicatedEntries.push(...medRequestResult.combinedMedRequests);

  // MedicationStatement deduplication
  const medStatementResult = deduplicateMedStatements(resourceArrays.medicationStatements);
  resourceArrays = replaceResourceReferences(resourceArrays, medStatementResult.refReplacementMap);
  processedArrays.push("medicationStatements");
  danglingLinks.push(...medStatementResult.danglingReferences);
  deduplicatedEntries.push(...medStatementResult.combinedMedStatements);

  // Encounter deduplication
  const encountersResult = deduplicateEncounters(resourceArrays.encounters);
  resourceArrays = replaceResourceReferences(resourceArrays, encountersResult.refReplacementMap);
  processedArrays.push("encounters");
  danglingLinks.push(...encountersResult.danglingReferences);
  deduplicatedEntries.push(...encountersResult.combinedEncounters);

  // DiagnosticReport deduplication
  const diagReportsResult = deduplicateDiagReports(resourceArrays.diagnosticReports);
  resourceArrays = replaceResourceReferences(resourceArrays, diagReportsResult.refReplacementMap);
  processedArrays.push("diagnosticReports");
  danglingLinks.push(...diagReportsResult.danglingReferences);
  deduplicatedEntries.push(...diagReportsResult.combinedDiagnosticReports);

  // Immunization deduplication
  const immunizationsResult = deduplicateImmunizations(resourceArrays.immunizations);
  resourceArrays = replaceResourceReferences(resourceArrays, immunizationsResult.refReplacementMap);
  processedArrays.push("immunizations");
  deduplicatedEntries.push(...immunizationsResult.combinedImmunizations);

  // Procedure deduplication
  const proceduresResult = deduplicateProcedures(resourceArrays.procedures);
  resourceArrays = replaceResourceReferences(resourceArrays, proceduresResult.refReplacementMap);
  processedArrays.push("procedures");
  deduplicatedEntries.push(...proceduresResult.combinedProcedures);

  // Observation (social history) deduplication
  const obsSocialResult = deduplicateObservationsSocial(resourceArrays.observationSocialHistory);
  resourceArrays = replaceResourceReferences(resourceArrays, obsSocialResult.refReplacementMap);
  processedArrays.push("observationSocialHistory");
  danglingLinks.push(...obsSocialResult.danglingReferences);
  deduplicatedEntries.push(...obsSocialResult.combinedObservations);

  // Observation (labs) deduplication
  const obsLabsResult = deduplicateObservations(resourceArrays.observationLaboratory);
  resourceArrays = replaceResourceReferences(resourceArrays, obsLabsResult.refReplacementMap);
  processedArrays.push("observationLaboratory");
  danglingLinks.push(...obsLabsResult.danglingReferences);
  deduplicatedEntries.push(...obsLabsResult.combinedObservations);

  // Observation (vitals) deduplication
  const obsVitalsResult = deduplicateObservations(resourceArrays.observationVitals);
  resourceArrays = replaceResourceReferences(resourceArrays, obsVitalsResult.refReplacementMap);
  processedArrays.push("observationVitals");
  danglingLinks.push(...obsVitalsResult.danglingReferences);
  deduplicatedEntries.push(...obsVitalsResult.combinedObservations);

  // Observation (other) deduplication
  const obsOthersResult = deduplicateObservations(resourceArrays.observationOther);
  resourceArrays = replaceResourceReferences(resourceArrays, obsOthersResult.refReplacementMap);
  processedArrays.push("observationOther");
  danglingLinks.push(...obsOthersResult.danglingReferences);
  deduplicatedEntries.push(...obsOthersResult.combinedObservations);

  // Location deduplication
  const locationsResult = deduplicateLocations(resourceArrays.locations);
  resourceArrays = replaceResourceReferences(resourceArrays, locationsResult.refReplacementMap);
  processedArrays.push("locations");
  danglingLinks.push(...locationsResult.danglingReferences);
  deduplicatedEntries.push(...locationsResult.combinedLocations);

  // Organization deduplication
  const organizationsResult = deduplicateOrganizations(resourceArrays.organizations);
  resourceArrays = replaceResourceReferences(resourceArrays, organizationsResult.refReplacementMap);
  processedArrays.push("organizations");
  danglingLinks.push(...organizationsResult.danglingReferences);
  deduplicatedEntries.push(...organizationsResult.combinedOrganizations);

  // RelatedPerson deduplication
  const relatedPersonsResult = deduplicateRelatedPersons(resourceArrays.relatedPersons);
  resourceArrays = replaceResourceReferences(
    resourceArrays,
    relatedPersonsResult.refReplacementMap
  );
  processedArrays.push("relatedPersons");
  danglingLinks.push(...relatedPersonsResult.danglingReferences);
  deduplicatedEntries.push(...relatedPersonsResult.combinedRelatedPersons);

  // FamilyMemberHistory deduplication
  const famMemHistoriesResult = deduplicateFamilyMemberHistories(
    resourceArrays.familyMemberHistories
  );
  resourceArrays = replaceResourceReferences(
    resourceArrays,
    famMemHistoriesResult.refReplacementMap
  );
  processedArrays.push("familyMemberHistories");
  danglingLinks.push(...famMemHistoriesResult.danglingReferences);
  deduplicatedEntries.push(...famMemHistoriesResult.combinedFamMemHistories);

  // Coverage deduplication
  const coveragesResult = deduplicateCoverages(resourceArrays.coverages);
  resourceArrays = replaceResourceReferences(resourceArrays, coveragesResult.refReplacementMap);
  processedArrays.push("coverages");
  danglingLinks.push(...coveragesResult.danglingReferences);
  deduplicatedEntries.push(...coveragesResult.combinedCoverages);

  // Rebuild the entries with deduplicated resources and add whatever is left unprocessed
  for (const [key, resources] of Object.entries(resourceArrays)) {
    // we will add compositions later
    if (processedArrays.includes(key) || key === "compositions") {
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
  // ["Organization", removeDanglingReferences],
]);

const resourceFiltersMap = new Map<string, Map<string, ResourceFilter>>([
  ["AllergyIntolerance", allergiesFiltersMap],
  ["Condition", conditionsFiltersMap],
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

  return entry;
}
