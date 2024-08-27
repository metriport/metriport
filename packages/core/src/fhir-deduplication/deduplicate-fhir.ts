import { Bundle, BundleEntry, Resource } from "@medplum/fhirtypes";
import { cloneDeep } from "lodash";
import { ExtractedFhirTypes, extractFhirTypesFromBundle } from "../external/fhir/shared/bundle";
import { deduplicateAllergyIntolerances } from "./resources/allergy-intolerance";
import { deduplicateConditions } from "./resources/condition";
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

export function deduplicateFhir(fhirBundle: Bundle<Resource>): Bundle<Resource> {
  let resourceArrays = extractFhirTypesFromBundle(fhirBundle);
  const deduplicatedEntries: BundleEntry<Resource>[] = [];

  // TODO: Add unit tests for the ID replacements

  const processedArrays: string[] = [];

  // Practitioner deduplication
  const practitionersResult = deduplicatePractitioners(resourceArrays.practitioners);
  resourceArrays = replaceResourceReferences(resourceArrays, practitionersResult.refReplacementMap);
  processedArrays.push("practitioners");
  deduplicatedEntries.push(...practitionersResult.combinedPractitioners);

  // Conditions deduplication
  const conditionsResult = deduplicateConditions(resourceArrays.conditions);
  resourceArrays = replaceResourceReferences(resourceArrays, conditionsResult.refReplacementMap);
  processedArrays.push("conditions");
  deduplicatedEntries.push(...conditionsResult.combinedConditions);

  // Allergies deduplication
  const allergiesResult = deduplicateAllergyIntolerances(resourceArrays.allergies);
  resourceArrays = replaceResourceReferences(resourceArrays, allergiesResult.refReplacementMap);
  processedArrays.push("allergies");
  deduplicatedEntries.push(...allergiesResult.combinedAllergies);

  // Medication deduplication
  const medicationsResult = deduplicateMedications(resourceArrays.medications);
  resourceArrays = replaceResourceReferences(resourceArrays, medicationsResult.refReplacementMap);
  processedArrays.push("medications");
  deduplicatedEntries.push(...medicationsResult.combinedMedications);

  // MedicationAdministration deduplication
  const medAdminsResult = deduplicateMedAdmins(resourceArrays.medicationAdministrations);
  resourceArrays = replaceResourceReferences(resourceArrays, medAdminsResult.refReplacementMap);
  processedArrays.push("medicationAdministrations");
  deduplicatedEntries.push(...medAdminsResult.combinedMedAdmins);

  // MedicationRequest deduplication
  const medRequestResult = deduplicateMedRequests(resourceArrays.medicationRequests);
  resourceArrays = replaceResourceReferences(resourceArrays, medRequestResult.refReplacementMap);
  processedArrays.push("medicationRequests");
  deduplicatedEntries.push(...medRequestResult.combinedMedRequests);

  // MedicationStatement deduplication
  const medStatementResult = deduplicateMedStatements(resourceArrays.medicationStatements);
  resourceArrays = replaceResourceReferences(resourceArrays, medStatementResult.refReplacementMap);
  processedArrays.push("medicationStatements");
  deduplicatedEntries.push(...medStatementResult.combinedMedStatements);

  // Encounter deduplication
  const encountersResult = deduplicateEncounters(resourceArrays.encounters);
  resourceArrays = replaceResourceReferences(resourceArrays, encountersResult.refReplacementMap);
  processedArrays.push("encounters");
  deduplicatedEntries.push(...encountersResult.combinedEncounters);

  // DiagnosticReport deduplication
  const diagReportsResult = deduplicateDiagReports(resourceArrays.diagnosticReports);
  resourceArrays = replaceResourceReferences(resourceArrays, diagReportsResult.refReplacementMap);
  processedArrays.push("diagnosticReports");
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
  deduplicatedEntries.push(...obsSocialResult.combinedObservations);

  // Observation (labs) deduplication
  const obsLabsResult = deduplicateObservations(resourceArrays.observationLaboratory);
  resourceArrays = replaceResourceReferences(resourceArrays, obsLabsResult.refReplacementMap);
  processedArrays.push("observationLaboratory");
  deduplicatedEntries.push(...obsLabsResult.combinedObservations);

  // Observation (vitals) deduplication
  const obsVitalsResult = deduplicateObservations(resourceArrays.observationVitals);
  resourceArrays = replaceResourceReferences(resourceArrays, obsVitalsResult.refReplacementMap);
  processedArrays.push("observationVitals");
  deduplicatedEntries.push(...obsVitalsResult.combinedObservations);

  // Observation (other) deduplication
  const obsOthersResult = deduplicateObservations(resourceArrays.observationOther);
  resourceArrays = replaceResourceReferences(resourceArrays, obsOthersResult.refReplacementMap);
  processedArrays.push("observationOther");
  deduplicatedEntries.push(...obsOthersResult.combinedObservations);

  // Location deduplication
  const locationsResult = deduplicateLocations(resourceArrays.locations);
  resourceArrays = replaceResourceReferences(resourceArrays, locationsResult.refReplacementMap);
  processedArrays.push("locations");
  deduplicatedEntries.push(...locationsResult.combinedLocations);

  // Organization deduplication
  const organizationsResult = deduplicateOrganizations(resourceArrays.organizations);
  resourceArrays = replaceResourceReferences(resourceArrays, organizationsResult.refReplacementMap);
  processedArrays.push("organizations");
  deduplicatedEntries.push(...organizationsResult.combinedOrganizations);

  // RelatedPerson deduplication
  const relatedPersonsResult = deduplicateRelatedPersons(resourceArrays.relatedPersons);
  resourceArrays = replaceResourceReferences(
    resourceArrays,
    relatedPersonsResult.refReplacementMap
  );
  processedArrays.push("relatedPersons");
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
  deduplicatedEntries.push(...famMemHistoriesResult.combinedFamMemHistories);

  // Rebuild the entries with deduplicated resources and add whatever is left unprocessed
  for (const [key, resources] of Object.entries(resourceArrays)) {
    if (processedArrays.includes(key)) {
      continue;
    } else {
      // Push all other resources unchanged
      const entriesArray = resources && Array.isArray(resources) ? resources : [resources];
      const entriesFlat = entriesArray.flatMap(v => v || []);
      deduplicatedEntries.push(...entriesFlat);
    }
  }

  const deduplicatedBundle: Bundle = cloneDeep(fhirBundle);
  deduplicatedBundle.entry = deduplicatedEntries.map(
    r => ({ resource: r } as BundleEntry<Resource>)
  );
  deduplicatedBundle.total = deduplicatedEntries.length;

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
