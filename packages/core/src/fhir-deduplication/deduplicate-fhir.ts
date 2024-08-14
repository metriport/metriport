import { Bundle, BundleEntry, Resource } from "@medplum/fhirtypes";
import { cloneDeep } from "lodash";
import { ExtractedFhirTypes, extractFhirTypesFromBundle } from "../external/fhir/shared/bundle";
import { deduplicateConditions } from "./resources/condition";
import { deduplicateMedications } from "./resources/medication";

export function deduplicateFhir(fhirBundle: Bundle<Resource>): Bundle<Resource> {
  let resourceArrays = extractFhirTypesFromBundle(fhirBundle);
  const deduplicatedEntries: BundleEntry<Resource>[] = [];

  // TODO: Add unit tests for the ID replacements

  const processedArrays: string[] = [];
  // Conditions deduplication
  const conditionsResult = deduplicateConditions(resourceArrays.conditions);
  resourceArrays = replaceResourceReferences(
    resourceArrays,
    conditionsResult.idReplacementMap,
    "Condition"
  );
  processedArrays.push("conditions");
  deduplicatedEntries.push(...conditionsResult.combinedConditions);

  // Medication deduplication
  const medicationsResult = deduplicateMedications(resourceArrays.medications);
  resourceArrays = replaceResourceReferences(
    resourceArrays,
    medicationsResult.idReplacementMap,
    "Medication"
  );
  processedArrays.push("medications");
  deduplicatedEntries.push(...medicationsResult.combinedMedications);

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
  idMap: Map<string, string[]>,
  resourceType: string
): ExtractedFhirTypes {
  let updatedArrays = JSON.stringify(resourceArrays);
  for (const [masterId, otherIds] of idMap.entries()) {
    for (const id of otherIds) {
      const regex = new RegExp(`${resourceType}/${id}`, "g");
      updatedArrays = updatedArrays.replace(regex, masterId);
    }
  }

  return JSON.parse(updatedArrays);
}
