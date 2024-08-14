import { CodeableConcept, Medication } from "@medplum/fhirtypes";
import {
  NDC_CODE,
  NDC_OID,
  RXNORM_CODE,
  RXNORM_OID,
  SNOMED_CODE,
  SNOMED_OID,
  combineResources,
  combineTwoResources,
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
      const key = rxnormCode;
      const existing = rxnormMap.get(key);
      if (existing?.id) {
        const merged = combineTwoResources(existing, medication, false);
        rxnormMap.set(key, merged);

        const existingReplacementIds = idReplacementMap.get(existing.id);
        if (medication.id) {
          if (existingReplacementIds) {
            idReplacementMap.set(existing.id, [...existingReplacementIds, medication.id]);
          } else {
            idReplacementMap.set(existing.id, [medication.id]);
          }
        }
      } else {
        rxnormMap.set(key, medication);
      }
    } else if (ndcCode) {
      const key = ndcCode;
      const existing = ndcMap.get(key);
      if (existing?.id) {
        const merged = combineTwoResources(existing, medication, false);
        ndcMap.set(key, merged);

        const existingReplacementIds = idReplacementMap.get(existing.id);
        if (medication.id) {
          if (existingReplacementIds) {
            idReplacementMap.set(existing.id, [...existingReplacementIds, medication.id]);
          } else {
            idReplacementMap.set(existing.id, [medication.id]);
          }
        }
      } else {
        ndcMap.set(key, medication);
      }
    } else if (snomedCode) {
      const key = snomedCode;
      const existing = snomedMap.get(key);
      if (existing?.id) {
        const merged = combineTwoResources(existing, medication, false);
        snomedMap.set(key, merged);

        const existingReplacementIds = idReplacementMap.get(existing.id);
        if (medication.id) {
          if (existingReplacementIds) {
            idReplacementMap.set(existing.id, [...existingReplacementIds, medication.id]);
          } else {
            idReplacementMap.set(existing.id, [medication.id]);
          }
        }
      } else {
        snomedMap.set(key, medication);
      }
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
