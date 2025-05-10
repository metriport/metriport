import { Coverage } from "@medplum/fhirtypes";
import { DeduplicationResult, combineResources, createRef, deduplicateWithinMap } from "../shared";

export function deduplicateCoverages(coverages: Coverage[]): DeduplicationResult<Coverage> {
  const { coveragesMap, refReplacementMap, danglingReferences } = groupSameCoverages(coverages);
  return {
    combinedResources: combineResources({
      combinedMaps: [coveragesMap],
    }),
    refReplacementMap,
    danglingReferences,
  };
}

/**
 * Approach:
 * 1 map, where the key is made of:
 * - payor: Organization reference ID
 * - status, optional
 * - period, optional
 */
export function groupSameCoverages(coverages: Coverage[]): {
  coveragesMap: Map<string, Coverage>;
  refReplacementMap: Map<string, string>;
  danglingReferences: Set<string>;
} {
  const coveragesMap = new Map<string, Coverage>();
  const refReplacementMap = new Map<string, string>();
  const danglingReferences = new Set<string>();

  for (const coverage of coverages) {
    const payor = coverage.payor?.find(ref => ref.reference?.startsWith("Organization"));
    const status = coverage.status;
    const period = coverage.period;

    if (payor) {
      const key = JSON.stringify({ payor, status, period });
      deduplicateWithinMap({
        dedupedResourcesMap: coveragesMap,
        dedupKey: key,
        candidateResource: coverage,
        refReplacementMap,
      });
    } else {
      danglingReferences.add(createRef(coverage));
    }
  }

  return {
    coveragesMap,
    refReplacementMap,
    danglingReferences,
  };
}
