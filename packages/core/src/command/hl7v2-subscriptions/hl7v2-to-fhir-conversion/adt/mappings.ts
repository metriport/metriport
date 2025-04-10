import { Coding } from "@medplum/fhirtypes";

const adtPatientClass = ["B", "C", "E", "I", "N", "O", "P", "R", "U"] as const;
export type AdtPatientClass = (typeof adtPatientClass)[number];

export function isAdtPatientClass(code: string): code is AdtPatientClass {
  return adtPatientClass.includes(code as AdtPatientClass);
}

type CodingWithCodeAndDisplay = Coding & {
  code: string;
  display: string;
};

// TODO 2883: Not sure this is a good class for default
export const DEFAULT_ENCOUNTER_CLASS: CodingWithCodeAndDisplay = {
  code: "AMB",
  display: "ambulatory",
};

/**
 * Contains the mapping for HL7 ADT Patient Class code to FHIR R4 Encounter class code.
 *
 * @see {@link https://hl7-definition.caristix.com/v2/HL7v2.5.1/Tables/0004}
 * @see {@link https://hl7.org/fhir/R4/v3/ActEncounterCode/vs.html}
 */
export const adtToFhirEncounterClassMap: Record<AdtPatientClass, CodingWithCodeAndDisplay> = {
  B: { code: "IMP", display: "inpatient encounter" }, // Obstetrics → Inpatient
  C: { code: "AMB", display: "ambulatory" }, // Commercial Account → Ambulatory
  E: { code: "EMER", display: "emergency" }, // Emergency → Emergency
  I: { code: "IMP", display: "inpatient encounter" }, // Inpatient → Inpatient
  N: DEFAULT_ENCOUNTER_CLASS, // Not Applicable → Default to Ambulatory
  O: { code: "AMB", display: "ambulatory" }, // Outpatient → Ambulatory
  P: { code: "PRENC", display: "pre-admission" }, // Preadmit → Pre-admission
  R: { code: "SS", display: "short stay" }, // Recurring patient → Short stay
  U: DEFAULT_ENCOUNTER_CLASS, // Unknown → Default to Ambulatory
};
