import { CodeableConcept, Coding } from "@medplum/fhirtypes";
import { cloneDeep } from "lodash";

// A map of system -> code -> Coding object
type CodingMap = Record<string, Record<string, Coding>>;

export function mergeCodeableConcepts(
  masterCodeableConcept: CodeableConcept | undefined,
  codeableConcepts: CodeableConcept[]
): CodeableConcept | undefined {
  const firstCodeableConcept = masterCodeableConcept ? masterCodeableConcept : codeableConcepts[0];
  if (!firstCodeableConcept) return undefined;
  const mergedCodeableConcept = cloneDeep(firstCodeableConcept);

  // Build a map of all coding systems and codes, with precedence to the master codeable concept
  const codingMap: CodingMap = {};
  addCodeableConceptToCodingMap(codingMap, firstCodeableConcept);
  for (const codeableConcept of codeableConcepts) {
    if (codeableConcept === firstCodeableConcept) continue;
    addCodeableConceptToCodingMap(codingMap, codeableConcept);
  }
  mergedCodeableConcept.coding = getCodingArrayFromMap(codingMap);
  return firstCodeableConcept;
}

function addCodeableConceptToCodingMap(
  codingMap: CodingMap,
  codeableConcept: CodeableConcept
): void {
  if (!codeableConcept.coding) return;
  for (const coding of codeableConcept.coding) {
    addToCodingMap(codingMap, coding);
  }
}

function addToCodingMap(codingMap: CodingMap, coding: Coding): void {
  if (!coding.system || !coding.code) return;
  let systemMap = codingMap[coding.system];
  if (!systemMap) {
    systemMap = codingMap[coding.system] = {};
  }
  if (!systemMap[coding.code]) {
    systemMap[coding.code] = coding;
  }
}

function getCodingArrayFromMap(codingMap: CodingMap): Coding[] {
  return Object.values(codingMap).flatMap(systemMap => Object.values(systemMap));
}
