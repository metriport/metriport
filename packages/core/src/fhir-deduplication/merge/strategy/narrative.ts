import { cloneDeep } from "lodash";
import { Narrative } from "@medplum/fhirtypes";
import { mergeWithLeastCommonSubstring } from "./util/least-common-substring";

/**
 * Merges narratives into a single narrative, using the least common substring strategy to merge the divs.
 *
 * @param masterNarrative - the narrative on the master resource
 * @param narratives - additional narratives on other equal resources
 * @returns the merged narrative
 */
export function mergeNarratives(
  masterNarrative: Narrative | undefined,
  narratives: Narrative[]
): Narrative | undefined {
  const firstNarrative = masterNarrative ? masterNarrative : narratives[0];
  if (!firstNarrative) return undefined;
  const mergedNarrative = cloneDeep(firstNarrative);

  for (const narrative of narratives) {
    if (narrative === firstNarrative) continue;
    mergeNarrativeDivs(mergedNarrative, narrative);
    mergeNarrativeExtensions(mergedNarrative, narrative);
    mergeNarrativeStatus(mergedNarrative, narrative);
  }

  return mergedNarrative;
}

function mergeNarrativeDivs(masterNarrative: Narrative, narrative: Narrative): void {
  if (masterNarrative.div && narrative.div) {
    masterNarrative.div = mergeWithLeastCommonSubstring(masterNarrative.div, narrative.div);
  }
}

function mergeNarrativeExtensions(masterNarrative: Narrative, narrative: Narrative): void {
  if (masterNarrative.extension && narrative.extension) {
    masterNarrative.extension = [...masterNarrative.extension, ...narrative.extension];
  }
}

function mergeNarrativeStatus(masterNarrative: Narrative, narrative: Narrative): void {
  if (!masterNarrative.status && narrative.status) {
    masterNarrative.status = narrative.status;
  }
}
