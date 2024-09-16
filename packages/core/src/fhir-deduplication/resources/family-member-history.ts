import { CodeableConcept, FamilyMemberHistory } from "@medplum/fhirtypes";
import { DeduplicationResult, combineResources, createRef, fillMaps } from "../shared";

export function deduplicateFamilyMemberHistories(
  famMemberHists: FamilyMemberHistory[]
): DeduplicationResult<FamilyMemberHistory> {
  const { famMemberHistsMap, refReplacementMap, danglingReferences } =
    groupSameFamilyMemberHistories(famMemberHists);
  return {
    combinedResources: combineResources({
      combinedMaps: [famMemberHistsMap],
    }),
    refReplacementMap,
    danglingReferences,
  };
}

/**
 * Approach:
 * 1 map, where the key is made of:
 * - relationship
 * - dob
 */
export function groupSameFamilyMemberHistories(famMemberHists: FamilyMemberHistory[]): {
  famMemberHistsMap: Map<string, FamilyMemberHistory>;
  refReplacementMap: Map<string, string[]>;
  danglingReferences: string[];
} {
  const famMemberHistsMap = new Map<string, FamilyMemberHistory>();
  const refReplacementMap = new Map<string, string[]>();
  const danglingReferencesSet = new Set<string>();

  function ensureFhirValidFamilyMemberHistory(
    famMemberHist: FamilyMemberHistory
  ): FamilyMemberHistory {
    famMemberHist.condition?.forEach(condition => {
      if (
        condition.onsetAge?.unit === "a" &&
        condition.onsetAge.value === 0 &&
        condition.onsetAge.system === "http://unitsofmeasure.org"
      ) {
        condition.onsetAge.value = 1;
        condition.onsetAge.unit = "Day";
      }
    });
    return famMemberHist;
  }

  const updatedFamMemberHists = famMemberHists.map(ensureFhirValidFamilyMemberHistory);

  for (const famMemberHist of updatedFamMemberHists) {
    const relationship = extractCode(famMemberHist.relationship);
    const dob = famMemberHist.bornDate;
    // const date = getDateFromResource(famMemberHist, "date"); // We're currently not mapping the date for FamilyMemberHistory.hbs
    if (relationship) {
      const key = JSON.stringify({ relationship, dob });
      fillMaps(famMemberHistsMap, key, famMemberHist, refReplacementMap, undefined);
    } else {
      danglingReferencesSet.add(createRef(famMemberHist));
    }
  }

  return {
    famMemberHistsMap,
    refReplacementMap,
    danglingReferences: [...danglingReferencesSet],
  };
}

export function extractCode(concept: CodeableConcept | undefined): string | undefined {
  if (!concept) return undefined;

  if (concept && concept.coding) {
    for (const coding of concept.coding) {
      const system = coding.system?.toLowerCase();
      const code = coding.code?.trim().toLowerCase();
      const display = coding.display?.trim().toLowerCase();
      if (system && display) {
        if (display !== "unknown") return display;
        if (code !== "unk") return code;
      }
    }
  }
  return undefined;
}
