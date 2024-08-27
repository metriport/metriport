import { Coverage } from "@medplum/fhirtypes";
import { combineResources, fillMaps } from "../shared";

export function deduplicateCoverages(medications: Coverage[]): {
  combinedCoverages: Coverage[];
  refReplacementMap: Map<string, string[]>;
} {
  const { coveragesMap, refReplacementMap } = groupSameCoverages(medications);
  return {
    combinedCoverages: combineResources({
      combinedMaps: [coveragesMap],
    }),
    refReplacementMap,
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
  refReplacementMap: Map<string, string[]>;
} {
  const coveragesMap = new Map<string, Coverage>();
  const refReplacementMap = new Map<string, string[]>();

  for (const coverage of coverages) {
    const payor = coverage.payor?.find(ref => ref.reference?.startsWith("Organization"));
    const status = coverage.status;
    const period = coverage.period;

    if (payor) {
      const key = JSON.stringify({ payor, status, period });
      fillMaps(coveragesMap, key, coverage, refReplacementMap);
    }
  }

  return {
    coveragesMap,
    refReplacementMap: refReplacementMap,
  };
}
