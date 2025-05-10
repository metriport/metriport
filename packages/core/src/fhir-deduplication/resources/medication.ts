import { CodeableConcept, Medication } from "@medplum/fhirtypes";
import {
  NDC_CODE,
  NDC_OID,
  RXNORM_CODE,
  RXNORM_OID,
  SNOMED_CODE,
  SNOMED_OID,
} from "../../util/constants";
import {
  DeduplicationResult,
  combineResources,
  createRef,
  extractDisplayFromConcept,
  deduplicateWithinMap,
  hasBlacklistedText,
  fetchCodingCodeOrDisplayOrSystem,
} from "../shared";

export function deduplicateMedications(medications: Medication[]): DeduplicationResult<Medication> {
  const { rxnormMap, ndcMap, snomedMap, displayMap, refReplacementMap, danglingReferences } =
    groupSameMedications(medications);
  return {
    combinedResources: combineResources({
      combinedMaps: [rxnormMap, ndcMap, snomedMap, displayMap],
    }),
    refReplacementMap,
    danglingReferences,
  };
}

export function groupSameMedications(medications: Medication[]): {
  rxnormMap: Map<string, Medication>;
  ndcMap: Map<string, Medication>;
  snomedMap: Map<string, Medication>;
  displayMap: Map<string, Medication>;
  refReplacementMap: Map<string, string>;
  danglingReferences: Set<string>;
} {
  const rxnormMap = new Map<string, Medication>();
  const ndcMap = new Map<string, Medication>();
  const snomedMap = new Map<string, Medication>();
  const displayMap = new Map<string, Medication>();
  const refReplacementMap = new Map<string, string>();
  const danglingReferences = new Set<string>();

  function removeOtherCodes(master: Medication): Medication {
    const code = master.code;
    const filtered = code?.coding?.filter(coding => {
      const system = fetchCodingCodeOrDisplayOrSystem(coding, "system");
      return (
        system?.includes(SNOMED_CODE) ||
        system?.includes(SNOMED_OID) ||
        system?.includes(NDC_CODE) ||
        system?.includes(NDC_OID) ||
        system?.includes(RXNORM_CODE) ||
        system?.includes(RXNORM_OID)
      );
    });
    if (filtered) {
      master.code = {
        ...code,
        coding: filtered,
      };
    }
    return master;
  }

  for (const medication of medications) {
    if (hasBlacklistedText(medication.code)) {
      danglingReferences.add(createRef(medication));
      continue;
    }

    // TODO: Deal with medications that contain >1 rxnorm / ndc code
    const { rxnormCode, ndcCode, snomedCode } = extractCodes(medication.code);

    if (rxnormCode) {
      deduplicateWithinMap({
        dedupedResourcesMap: rxnormMap,
        dedupKey: rxnormCode,
        candidateResource: medication,
        refReplacementMap,
        keepExtensions: false,
        onPostmerge: removeOtherCodes,
      });
    } else if (ndcCode) {
      deduplicateWithinMap({
        dedupedResourcesMap: ndcMap,
        dedupKey: ndcCode,
        candidateResource: medication,
        refReplacementMap,
        keepExtensions: false,
        onPostmerge: removeOtherCodes,
      });
    } else if (snomedCode) {
      deduplicateWithinMap({
        dedupedResourcesMap: snomedMap,
        dedupKey: snomedCode,
        candidateResource: medication,
        refReplacementMap,
        keepExtensions: false,
        onPostmerge: removeOtherCodes,
      });
    } else {
      const display = extractDisplayFromConcept(medication.code);
      if (display) {
        const compKey = JSON.stringify({ display });
        deduplicateWithinMap({
          dedupedResourcesMap: displayMap,
          dedupKey: compKey,
          candidateResource: medication,
          refReplacementMap,
        });
      } else {
        danglingReferences.add(createRef(medication));
      }
    }
  }

  return {
    rxnormMap,
    ndcMap,
    snomedMap,
    displayMap,
    refReplacementMap,
    danglingReferences,
  };
}

function extractCodes(concept: CodeableConcept | undefined): {
  rxnormCode: string | undefined;
  ndcCode: string | undefined;
  snomedCode: string | undefined;
} {
  let rxnormCode = undefined;
  let ndcCode = undefined;
  let snomedCode = undefined;
  if (!concept) return { rxnormCode, ndcCode, snomedCode };

  if (concept && concept.coding) {
    for (const coding of concept.coding) {
      const system = fetchCodingCodeOrDisplayOrSystem(coding, "system");
      const code = fetchCodingCodeOrDisplayOrSystem(coding, "code");
      if (system && code) {
        if (system.includes(RXNORM_CODE) || system.includes(RXNORM_OID)) {
          rxnormCode = code;
        } else if (system.includes(NDC_CODE) || system.includes(NDC_OID)) {
          ndcCode = code;
        } else if (system.includes(SNOMED_CODE) || system.includes(SNOMED_OID)) {
          snomedCode = code;
        }
      }
    }
  }
  return { rxnormCode, ndcCode, snomedCode };
}
