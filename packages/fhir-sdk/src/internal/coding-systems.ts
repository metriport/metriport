/**
 * FHIR Coding System URLs and configuration for common coding systems
 */

/**
 * Standard FHIR coding system URLs
 */
export const CODING_SYSTEMS = {
  LOINC: "http://loinc.org",
  ICD10: "http://hl7.org/fhir/sid/icd-10-cm",
  SNOMED: "http://snomed.info/sct",
  RXNORM: "http://www.nlm.nih.gov/research/umls/rxnorm",
  NDC: "http://hl7.org/fhir/sid/ndc",
} as const;

/**
 * Configuration for dynamically generated coding system methods.
 * Similar to RESOURCE_METHODS pattern in FhirBundleSdk.
 *
 * Each entry generates methods for both Coding and CodeableConcept:
 * - Coding: is{System}()
 * - CodeableConcept: get{System}(), get{System}Codings(), get{System}Code(), etc.
 */
export const CODING_SYSTEM_CONFIG = [
  {
    systemName: "Loinc",
    systemUrl: CODING_SYSTEMS.LOINC,
  },
  {
    systemName: "Icd10",
    systemUrl: CODING_SYSTEMS.ICD10,
  },
  {
    systemName: "Snomed",
    systemUrl: CODING_SYSTEMS.SNOMED,
  },
  {
    systemName: "RxNorm",
    systemUrl: CODING_SYSTEMS.RXNORM,
  },
  {
    systemName: "Ndc",
    systemUrl: CODING_SYSTEMS.NDC,
  },
] as const;

/**
 * Type helper to extract system names from configuration
 */
export type CodingSystemName = (typeof CODING_SYSTEM_CONFIG)[number]["systemName"];
