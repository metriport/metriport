import { Bundle, BundleEntry, Resource } from "@medplum/fhirtypes";
import { cloneDeep } from "lodash";
import { ExtractedFhirTypes, extractFhirTypesFromBundle } from "../external/fhir/shared/bundle";
import { deduplicateConditions } from "./resources/condition";
import { deduplicateDiagReports } from "./resources/diagnostic-report";
import { deduplicateEncounters } from "./resources/encounter";
import { deduplicateImmunizations } from "./resources/immunization";
import { deduplicateMedications } from "./resources/medication";
import { deduplicateMedAdmins } from "./resources/medication-administration";
import { deduplicateMedRequests } from "./resources/medication-request";
import { deduplicateMedStatements } from "./resources/medication-statement";
import { deduplicateObservationsLabsAndVitals } from "./resources/observation-labs-and-vitals";
import { deduplicateObservationsSocial } from "./resources/observation-social";
import { deduplicateProcedures } from "./resources/procedure";

export function deduplicateFhir(fhirBundle: Bundle<Resource>): Bundle<Resource> {
  let resourceArrays = extractFhirTypesFromBundle(fhirBundle);
  const deduplicatedEntries: BundleEntry<Resource>[] = [];

  // TODO: Add unit tests for the ID replacements

  const processedArrays: string[] = [];
  const conditionsResult = deduplicateConditions(resourceArrays.conditions);
  resourceArrays = replaceResourceReferences(resourceArrays, conditionsResult.refReplacementMap);
  processedArrays.push("conditions");
  deduplicatedEntries.push(...conditionsResult.combinedConditions);
  // TODO dropped conditions list for Encounters

  // Medication deduplication
  const medicationsResult = deduplicateMedications(resourceArrays.medications);
  resourceArrays = replaceResourceReferences(resourceArrays, medicationsResult.refReplacementMap);
  processedArrays.push("medications");
  deduplicatedEntries.push(...medicationsResult.combinedMedications);
  // NOW Meds list for MedicationAdministration, MedicatuionStatement, MedicatioNRequest

  const medAdminsResult = deduplicateMedAdmins(resourceArrays.medicationAdministrations);
  resourceArrays = replaceResourceReferences(resourceArrays, medAdminsResult.refReplacementMap);
  processedArrays.push("medicationAdministrations");
  deduplicatedEntries.push(...medAdminsResult.combinedMedAdmins);

  const medRequestResult = deduplicateMedRequests(resourceArrays.medicationRequests);
  resourceArrays = replaceResourceReferences(resourceArrays, medRequestResult.refReplacementMap);
  processedArrays.push("medicationRequests");
  deduplicatedEntries.push(...medRequestResult.combinedMedRequests);

  const medStatementResult = deduplicateMedStatements(resourceArrays.medicationStatements);
  resourceArrays = replaceResourceReferences(resourceArrays, medStatementResult.refReplacementMap);
  processedArrays.push("medicationStatements");
  deduplicatedEntries.push(...medStatementResult.combinedMedStatements);

  const encountersResult = deduplicateEncounters(resourceArrays.encounters);
  resourceArrays = replaceResourceReferences(resourceArrays, encountersResult.refReplacementMap);
  processedArrays.push("encounters");
  deduplicatedEntries.push(...encountersResult.combinedEncounters);
  // TODO dropped encounters to remove in DiagnosticReports

  const obsSocialResult = deduplicateObservationsSocial(resourceArrays.observationSocialHistory);
  resourceArrays = replaceResourceReferences(resourceArrays, obsSocialResult.refReplacementMap);
  processedArrays.push("observationSocialHistory");
  deduplicatedEntries.push(...obsSocialResult.combinedObservations);

  const obsLabsResult = deduplicateObservationsLabsAndVitals(resourceArrays.observationLaboratory);
  resourceArrays = replaceResourceReferences(resourceArrays, obsLabsResult.refReplacementMap);
  processedArrays.push("observationLaboratory");
  deduplicatedEntries.push(...obsLabsResult.combinedObservations);

  const obsVitalsResult = deduplicateObservationsLabsAndVitals(resourceArrays.observationVitals);
  resourceArrays = replaceResourceReferences(resourceArrays, obsVitalsResult.refReplacementMap);
  processedArrays.push("observationVitals");
  deduplicatedEntries.push(...obsVitalsResult.combinedObservations);
  // TODO dropped encounters to remove in DiagnosticReports

  const diagReportsResult = deduplicateDiagReports(resourceArrays.diagnosticReports);
  resourceArrays = replaceResourceReferences(resourceArrays, diagReportsResult.refReplacementMap);
  processedArrays.push("diagnosticReports");
  deduplicatedEntries.push(...diagReportsResult.combinedDiagnosticReports);

  const immunizationsResult = deduplicateImmunizations(resourceArrays.immunizations);
  resourceArrays = replaceResourceReferences(resourceArrays, immunizationsResult.refReplacementMap);
  processedArrays.push("immunizations");
  deduplicatedEntries.push(...immunizationsResult.combinedImmunizations);

  const proceduresResult = deduplicateProcedures(resourceArrays.procedures);
  resourceArrays = replaceResourceReferences(resourceArrays, proceduresResult.refReplacementMap);
  processedArrays.push("procedures");
  deduplicatedEntries.push(...proceduresResult.combinedProcedures);

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
