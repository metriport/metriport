import { Composition } from "@medplum/fhirtypes";
import { DOC_ID_EXTENSION_URL } from "../../external/fhir/shared/extensions/doc-id-extension";
import { DeduplicationResult, combineResources, deduplicateWithinMap } from "../shared";

export function deduplicateCompositions(
  compositions: Composition[]
): DeduplicationResult<Composition> {
  const { compositionsMap, refReplacementMap, danglingReferences } =
    groupSameCompositions(compositions);
  return {
    combinedResources: combineResources({
      combinedMaps: [compositionsMap],
    }),
    refReplacementMap,
    danglingReferences,
  };
}

export function groupSameCompositions(compositions: Composition[]): {
  compositionsMap: Map<string, Composition>;
  refReplacementMap: Map<string, string>;
  danglingReferences: Set<string>;
} {
  const compositionsMap = new Map<string, Composition>();
  const refReplacementMap = new Map<string, string>();
  const danglingReferences = new Set<string>();

  for (const composition of compositions) {
    const documentName = composition.extension?.find(
      ext => ext.url === DOC_ID_EXTENSION_URL
    )?.valueString;

    if (documentName) {
      const key = JSON.stringify({ documentName });
      deduplicateWithinMap({
        dedupedResourcesMap: compositionsMap,
        dedupKey: key,
        candidateResource: composition,
        refReplacementMap,
      });
    } else {
      const key = JSON.stringify({ id: composition.id });
      deduplicateWithinMap({
        dedupedResourcesMap: compositionsMap,
        dedupKey: key,
        candidateResource: composition,
        refReplacementMap,
      });
    }
  }

  return {
    compositionsMap,
    refReplacementMap,
    danglingReferences,
  };
}
