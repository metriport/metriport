import { Bundle, BundleEntry, Resource } from "@medplum/fhirtypes";
import { cloneDeep } from "lodash";
import { ExtractedFhirTypes, extractFhirTypesFromBundle } from "../external/fhir/shared/bundle";
import { deduplicateConditions } from "./resources/condition";
import { deduplicateMedications } from "./resources/medication";
import { deduplicateMedAdmins } from "./resources/medication-administration";
import { deduplicateMedRequests } from "./resources/medication-request";
import { deduplicateMedStatements } from "./resources/medication-statement";

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
