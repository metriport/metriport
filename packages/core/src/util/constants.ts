export const METRIPORT = "METRIPORT";

export const SNOMED_CODE = "snomed";
export const SNOMED_URL = "http://snomed.info/sct";
export const SNOMED_OID = "2.16.840.1.113883.6.96";

/**
 * @deprecated - use @metriport/shared/medical instead
 */
export const LOINC_CODE = "loinc";
/**
 * @deprecated - use @metriport/shared/medical instead
 */
export const LOINC_URL = "http://loinc.org";
/**
 * @deprecated - use @metriport/shared/medical instead
 */
export const LOINC_OID = "2.16.840.1.113883.6.1";

export const ICD_10_CODE = "icd-10";
export const ICD_10_URL = "http://hl7.org/fhir/sid/icd-10-cm";
export const ICD_10_OID = "2.16.840.1.113883.6.90";

export const ICD_9_CODE = "icd-9";
export const ICD_9_URL = "http://terminology.hl7.org/CodeSystem/ICD-9CM-diagnosiscodes9";

export const RXNORM_CODE = "rxnorm";
export const RXNORM_URL = "http://www.nlm.nih.gov/research/umls/rxnorm";
export const RXNORM_OID = "2.16.840.1.113883.6.88";

export const NDC_CODE = "ndc";
export const NDC_URL = "http://hl7.org/fhir/sid/ndc";
export const NDC_OID = "2.16.840.1.113883.6.69";

export const CVX_CODE = "cvx";
export const CVX_URL = "http://hl7.org/fhir/sid/cvx";
export const CVX_OID = "2.16.840.1.113883.12.292";

export const CPT_CODE = "cpt";
export const CPT_URL = "http://www.ama-assn.org/go/cpt";
export const CPT_OID = "2.16.840.1.113883.6.12";

export const NDDF_URL = "http://terminology.hl7.org/CodeSystem/nddf";

export const HL7_ACT_URL = "http://terminology.hl7.org/CodeSystem/v3-ActCode";

export const EPIC_PARTIAL_URN = "1.2.840.114350.1.13";
export const HL7_PARTIAL_URN = "2.16.840.1.113883";

export const knownSystemUrls = [
  RXNORM_URL,
  NDC_URL,
  CPT_URL,
  CVX_URL,
  ICD_10_URL,
  ICD_9_URL,
  LOINC_URL,
  SNOMED_URL,
  HL7_ACT_URL,
];
