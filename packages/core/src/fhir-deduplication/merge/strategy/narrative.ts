import { Narrative } from "@medplum/fhirtypes";
import { mergeWithLeastCommonSubstring } from "./util/least-common-substring";

export function mergeNarratives(
  masterNarrative: Narrative | undefined,
  narratives: Narrative[]
): Narrative | undefined {
  const firstNarrative = masterNarrative ? masterNarrative : narratives[0];
  if (!firstNarrative) return undefined;

  for (const narrative of narratives) {
    if (narrative === firstNarrative) continue;
    if (narrative.div) {
      if (firstNarrative.div) {
        firstNarrative.div = mergeWithLeastCommonSubstring(firstNarrative.div, narrative.div);
      } else {
        firstNarrative.div = narrative.div;
      }
    }
  }

  return firstNarrative;
}
