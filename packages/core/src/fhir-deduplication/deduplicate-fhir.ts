import { Bundle, BundleEntry, Resource } from "@medplum/fhirtypes";
import { cloneDeep } from "lodash";
import { ExtractedFhirTypes, extractFhirTypesFromBundle } from "../external/fhir/shared/bundle";
import { deduplicateConditions } from "./resources/condition";
import { deduplicateDiagReports } from "./resources/diagnostic-report";
import { deduplicateEncounters } from "./resources/encounter";
import { deduplicateFamilyMemberHistories } from "./resources/family-member-history";
import { deduplicateImmunizations } from "./resources/immunization";
import { deduplicateMedications } from "./resources/medication";
import { deduplicateMedAdmins } from "./resources/medication-administration";
import { deduplicateMedRequests } from "./resources/medication-request";
import { deduplicateMedStatements } from "./resources/medication-statement";
import { deduplicateObservationsLabs } from "./resources/observation-labs";
import { deduplicateObservationsSocial } from "./resources/observation-social";
import { deduplicateProcedures } from "./resources/procedure";

export function deduplicateFhir(fhirBundle: Bundle<Resource>): Bundle<Resource> {
  let resourceArrays = extractFhirTypesFromBundle(fhirBundle);
  const deduplicatedEntries: BundleEntry<Resource>[] = [];

  // TODO: Add unit tests for the ID replacements

  const processedArrays: string[] = [];
  // Conditions deduplication
  const conditionsResult = deduplicateConditions(resourceArrays.conditions);
  resourceArrays = replaceResourceReferences(resourceArrays, conditionsResult.refReplacementMap);
  deduplicatedEntries.push(...conditionsResult.combinedConditions);

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

  // FamilyMemberHistory deduplication
  const familyMemHistResult = deduplicateFamilyMemberHistories(
    resourceArrays.familyMemberHistories
  );
  resourceArrays = replaceResourceReferences(resourceArrays, familyMemHistResult.refReplacementMap);
  processedArrays.push("familyMemberHistories");
  deduplicatedEntries.push(...familyMemHistResult.combinedFamMemHistories);

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
  const obsLabsResult = deduplicateObservationsLabs(resourceArrays.observationLaboratory);
  resourceArrays = replaceResourceReferences(resourceArrays, obsLabsResult.refReplacementMap);
  processedArrays.push("observationLaboratory");
  deduplicatedEntries.push(...obsLabsResult.combinedObservations);

  // Observation (vitals) deduplication
  const obsVitalsResult = deduplicateObservationsLabs(resourceArrays.observationVitals);
  resourceArrays = replaceResourceReferences(resourceArrays, obsVitalsResult.refReplacementMap);
  processedArrays.push("observationVitals");
  deduplicatedEntries.push(...obsVitalsResult.combinedObservations);

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
