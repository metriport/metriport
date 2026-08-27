export const DISCHARGE_DISPOSITION_SYSTEM =
  "http://terminology.hl7.org/CodeSystem/discharge-disposition";

/**
 * FHIR R4 Discharge Disposition codes.
 *
 * @see {@link https://hl7.org/fhir/R4/valueset-encounter-discharge-disposition.html}
 */
export const fhirDischargeDisposition = {
  home: { code: "home", display: "Home" },
  altHome: { code: "alt-home", display: "Alternative home" },
  otherHcf: { code: "other-hcf", display: "Other healthcare facility" },
  hosp: { code: "hosp", display: "Hospice" },
  long: { code: "long", display: "Long-term care" },
  aadvice: { code: "aadvice", display: "Left against advice" },
  exp: { code: "exp", display: "Expired" },
  psy: { code: "psy", display: "Psychiatric hospital" },
  rehab: { code: "rehab", display: "Rehabilitation" },
  snf: { code: "snf", display: "Skilled nursing facility" },
  oth: { code: "oth", display: "Other" },
} as const;

export type DischargeDispositionCode =
  (typeof fhirDischargeDisposition)[keyof typeof fhirDischargeDisposition];
