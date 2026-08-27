import {
  DISCHARGE_DISPOSITION_SYSTEM,
  fhirDischargeDisposition,
} from "../../../../external/fhir/shared/discharge-disposition";

export { DISCHARGE_DISPOSITION_SYSTEM, fhirDischargeDisposition };

const adtPatientClass = ["B", "C", "E", "I", "N", "O", "P", "R", "U"] as const;
export type AdtPatientClass = (typeof adtPatientClass)[number];

export function isAdtPatientClass(code: string): code is AdtPatientClass {
  return adtPatientClass.includes(code as AdtPatientClass);
}

type CodingWithCodeAndDisplay = {
  code: string;
  display: string;
};

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

/**
 * Text-based discharge disposition patterns for HL7 PV1.36 values.
 * Based on actual PV1.36 values observed in production ADT messages.
 *
 * Order matters - more specific patterns must come before generic ones.
 */
const hl7DischargeDispositionPatterns: Array<{
  patterns: RegExp[];
  disposition: CodingWithCodeAndDisplay;
}> = [
  // Hospice (check before "home" patterns since "Home - with Hospice" contains "home")
  {
    patterns: [/\bhospice\b/i, /\bpalliative\b/i],
    disposition: fhirDischargeDisposition.hosp,
  },
  // alt-home: "Home - with ..." or "Home with ..." patterns (must come before plain "home")
  {
    patterns: [
      /\bhome\s*-\s*with\b/i,
      /\bhome\s+with\b/i,
      /\bassisted\s+living\b.*\b(and|with)\b.*\bhealth\b/i,
      /\bfamily\b.*\bhome\b/i,
      /\balt(ernative)?[- ]?home\b/i,
    ],
    disposition: fhirDischargeDisposition.altHome,
  },
  // Plain home
  {
    patterns: [/^home$/i, /\bself[- ]?care\b/i, /\broutine\b/i],
    disposition: fhirDischargeDisposition.home,
  },
  // Skilled Nursing Facility
  {
    patterns: [/\bsnf\b/i, /\bskilled\s*nursing\b/i],
    disposition: fhirDischargeDisposition.snf,
  },
  // Hospital / Other healthcare facility
  {
    patterns: [/^hospital$/i, /\btransfer/i, /\banother\b.*\b(hospital|facility)\b/i],
    disposition: fhirDischargeDisposition.otherHcf,
  },
  // Deceased / Expired
  {
    patterns: [/\bdeceased\b/i, /\bexpire[ds]?\b/i, /\bdeath\b/i, /\bdied\b/i, /\bmortality\b/i],
    disposition: fhirDischargeDisposition.exp,
  },
  // Long-term care (Assisted Living, Intermediate Care, Long-Term Care)
  {
    patterns: [
      /\bassisted\s*living\b/i,
      /\bintermediate\s*care\b/i,
      /\blong[- ]?term\s*care\b/i,
      /\bltc\b/i,
    ],
    disposition: fhirDischargeDisposition.long,
  },
  // Against Medical Advice / Left without being seen
  {
    patterns: [
      /\bagainst\s*medical\s*advice\b/i,
      /\bleft\s*without\b/i,
      /\bama\b/i,
      /\beloped\b/i,
      /\blwbs\b/i,
    ],
    disposition: fhirDischargeDisposition.aadvice,
  },
  // Rehabilitation
  {
    patterns: [/\binpatient\s*rehab/i, /\brehab(ilitation)?\s*(facility)?\b/i, /\birf\b/i],
    disposition: fhirDischargeDisposition.rehab,
  },
  // Psychiatric
  {
    patterns: [/\bpsych(iatric)?\b/i, /\bmental\s*health\b/i],
    disposition: fhirDischargeDisposition.psy,
  },
  // Other (Court/law enforcement, etc.)
  {
    patterns: [/\bcourt\b/i, /\blaw\s*enforcement\b/i, /\bjail\b/i, /\bprison\b/i],
    disposition: fhirDischargeDisposition.oth,
  },
];

/**
 * Maps an HL7 PV1.36 discharge disposition value to FHIR R4 discharge disposition.
 * Uses text pattern matching based on actual values observed in production.
 *
 * @param pv136Value - The raw PV1.36 value from the HL7 message
 * @returns The FHIR discharge disposition coding, or undefined if no match found
 */
export function mapDischargeDisposition(
  pv136Value: string | undefined
): CodingWithCodeAndDisplay | undefined {
  if (!pv136Value) return undefined;

  const trimmed = pv136Value.trim();
  if (!trimmed) return undefined;

  for (const { patterns, disposition } of hl7DischargeDispositionPatterns) {
    for (const pattern of patterns) {
      if (pattern.test(trimmed)) {
        return disposition;
      }
    }
  }

  return undefined;
}
