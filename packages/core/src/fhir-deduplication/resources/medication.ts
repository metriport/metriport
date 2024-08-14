import { CodeableConcept, Medication } from "@medplum/fhirtypes";
import {
  NDC_CODE,
  NDC_OID,
  RXNORM_CODE,
  RXNORM_OID,
  SNOMED_CODE,
  SNOMED_OID,
  combineResources,
  fillMaps,
} from "../shared";

export function deduplicateMedications(medications: Medication[]): {
  combinedMedications: Medication[];
  idReplacementMap: Map<string, string[]>;
} {
  const { rxnormMap, ndcMap, snomedMap, remainingMedications, idReplacementMap } =
    groupSameMedications(medications);
  return {
    combinedMedications: combineResources({
      combinedMaps: [rxnormMap, ndcMap, snomedMap],
      remainingResources: remainingMedications,
    }),
    idReplacementMap,
  };
}

export function groupSameMedications(medications: Medication[]): {
  rxnormMap: Map<string, Medication>;
  ndcMap: Map<string, Medication>;
  snomedMap: Map<string, Medication>;
  remainingMedications: Medication[];
  idReplacementMap: Map<string, string[]>;
} {
  const rxnormMap = new Map<string, Medication>();
  const ndcMap = new Map<string, Medication>();
  const snomedMap = new Map<string, Medication>();
  const idReplacementMap = new Map<string, string[]>();
  const remainingMedications: Medication[] = [];

  for (const medication of medications) {
    // TODO: Deal with medications that contain >1 rxnorm / ndc code
    const { rxnormCode, ndcCode, snomedCode } = extractCodes(medication.code);

    if (rxnormCode) {
      fillMaps(rxnormMap, rxnormCode, medication, idReplacementMap);
    } else if (ndcCode) {
      fillMaps(ndcMap, ndcCode, medication, idReplacementMap);
    } else if (snomedCode) {
      fillMaps(snomedMap, snomedCode, medication, idReplacementMap);
    } else {
      remainingMedications.push(medication);
    }
  }

  return {
    rxnormMap,
    ndcMap,
    snomedMap,
    remainingMedications,
    idReplacementMap,
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
      const system = coding.system?.toLowerCase();
      const code = coding.code?.trim().toLowerCase();
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
