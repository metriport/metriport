import {
  CONDITION_CCSR_CATEGORY_SYSTEM_URL,
  ICD_10_URL,
  LOINC_URL,
  NDC_URL,
  RXNORM_URL,
  SNOMED_URL,
} from "@metriport/shared/medical/fhir/constants";

/**
 * FHIR Coding System URLs and configuration for common coding systems
 */

/**
 * Standard FHIR coding system URLs
 *
 * TODO: Add CPT, CVX, and many others.
 */
export const CODING_SYSTEMS = {
  LOINC: LOINC_URL,
  ICD10: ICD_10_URL,
  SNOMED: SNOMED_URL,
  RXNORM: RXNORM_URL,
  NDC: NDC_URL,
  CCSR: CONDITION_CCSR_CATEGORY_SYSTEM_URL,
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
  {
    systemName: "Ccsr",
    systemUrl: CODING_SYSTEMS.CCSR,
  },
] as const;

/**
 * Type helper to extract system names from configuration
 */
export type CodingSystemName = (typeof CODING_SYSTEM_CONFIG)[number]["systemName"];
