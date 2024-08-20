import { CodeableConcept, FamilyMemberHistory } from "@medplum/fhirtypes";
import { combineResources, fillMaps } from "../shared";

export function deduplicateFamilyMemberHistorys(famMemberHists: FamilyMemberHistory[]): {
  combinedFamilyMemberHistorys: FamilyMemberHistory[];
  refReplacementMap: Map<string, string[]>;
} {
  const { famMemberHistsMap, refReplacementMap } = groupSameFamilyMemberHistorys(famMemberHists);
  return {
    combinedFamilyMemberHistorys: combineResources({
      combinedMaps: [famMemberHistsMap],
    }),
    refReplacementMap,
  };
}

/**
 * Approach:
 * 1 map, where the key is made of:
 * - relationship - Could be a sufficient key for mother and father, but probably not for anyone else?
 * - date - I don't think the date should matter, as we can combine the conditions into one
 * -
 */
export function groupSameFamilyMemberHistorys(famMemberHists: FamilyMemberHistory[]): {
  famMemberHistsMap: Map<string, FamilyMemberHistory>;
  refReplacementMap: Map<string, string[]>;
} {
  const famMemberHistsMap = new Map<string, FamilyMemberHistory>();
  const refReplacementMap = new Map<string, string[]>();

  for (const famMemberHist of famMemberHists) {
    const relationship = extractCode(famMemberHist.relationship);
    const name = famMemberHist.name;
    // const date = getDateFromResource(famMemberHist, "date"); // We're currently not mapping the date for FamilyMemberHistory.hbs
    if (relationship) {
      let key;
      if (relationship === "father" || relationship === "mother") {
        key = JSON.stringify({ relationship });
      } else {
        key = JSON.stringify({ relationship, name });
      }
      fillMaps(famMemberHistsMap, key, famMemberHist, refReplacementMap, undefined);
    }
  }

  return {
    famMemberHistsMap,
    refReplacementMap,
  };
}

export function extractCode(concept: CodeableConcept | undefined): string | undefined {
  if (!concept) return undefined;

  if (concept && concept.coding) {
    for (const coding of concept.coding) {
      const system = coding.system?.toLowerCase();
      const display = coding.display?.trim().toLowerCase();
      if (system && display) {
        if (system.includes("rolecode")) {
          return display;
        }
      }
    }
  }
  return undefined;
}
