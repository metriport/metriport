import { Coding } from "@medplum/fhirtypes";
import { HL7_ACT_URL, LOINC_CODE, LOINC_OID } from "./constants";
import loincCodeClassLookupData from "./loinc/loinc-code-class-lookup.json";
import loincClassDisplayLookupData from "./loinc/loinc-class-display-lookup.json";

export type LoincClassType = "1" | "2" | "3" | "4";

type LoincCodeClassLookup = Record<string, { class: string; classType: LoincClassType }>;

type LoincClassDisplayLookup = Record<string, { displayValue: string; partCode: string }>;

const loincCodeClassLookup = loincCodeClassLookupData as LoincCodeClassLookup;
const loincClassDisplayLookup = loincClassDisplayLookupData as LoincClassDisplayLookup;

function getLoincLookups(): {
  codeClass: LoincCodeClassLookup;
  classDisplay: LoincClassDisplayLookup;
} {
  return { codeClass: loincCodeClassLookup, classDisplay: loincClassDisplayLookup };
}

export type LoincClass = keyof LoincClassDisplayLookup;

export function isLoinc(system: string | undefined): boolean {
  if (
    system?.toLowerCase().trim().includes(LOINC_CODE) ||
    system?.toLowerCase().trim().includes(LOINC_OID)
  ) {
    return true;
  }
  return false;
}

export function isLoincCoding(coding: Coding | undefined): boolean {
  if (isLoinc(coding?.system)) {
    return true;
  }
  return false;
}

export function isActCoding(coding: Coding | undefined): boolean {
  return coding?.system?.toLowerCase().trim().includes(HL7_ACT_URL.toLowerCase()) ?? false;
}

export function getLoincCodeClass(
  loincCode: string
): { abbreviation: string; display: string } | undefined {
  const { codeClass, classDisplay } = getLoincLookups();
  const classLookup = codeClass[loincCode];
  if (!classLookup) {
    return undefined;
  }
  const classDisplayLookup = classDisplay[classLookup.class];
  if (!classDisplayLookup) {
    return undefined;
  }

  return {
    abbreviation: classLookup.class,
    display: classDisplayLookup.displayValue,
  };
}
