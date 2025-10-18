/*
CONFIDENTIALITY_CODE is always N, or normal, indicating its normal PHI
*/
export const DEFAULT_CONFIDENTIALITY_CODE = "N";

export const DEFAULT_CLASS_CODE_NODE = "34133-9";
export const DEFAULT_CLASS_CODE_DISPLAY = "Continuity of Care Document";
export const CONFIDENTIALITY_CODE_SYSTEM = "2.16.840.1.113883.5.25";
export const LOINC_CODE = "2.16.840.1.113883.6.1";
export const SNOMED_CODE = "2.16.840.1.113883.6.96";
export const DEFAULT_FORMAT_CODE_SYSTEM = "1.3.6.1.4.1.19376.1.2.3";
export const DEFAULT_FORMAT_CODE_NODE = "urn:ihe:pcc:xphr:2007";
export const DEFAULT_PRACTICE_SETTING_CODE_NODE = "394802001";
export const DEFAULT_PRACTICE_SETTING_CODE_DISPLAY = "General Medicine";
export const DEFAULT_HEALTHCARE_FACILITY_TYPE_CODE_NODE = "394777002";
export const DEFAULT_HEALTHCARE_FACILITY_TYPE_CODE_DISPLAY = "Health Encounter Site";
export const NHIN_PURPOSE_CODE_SYSTEM = "2.16.840.1.113883.3.18.7.1";

/**
 * IHE XDS Classification Scheme UUIDs
 * Source: IHE IT Infrastructure Technical Framework Volume 3, Table 4.2.3.2-1
 * These UUIDs are stable and standardized across all IHE XDS implementations
 */
export const XDSDocumentEntryAuthor = "urn:uuid:93606bcf-9494-43ec-9b4e-a7748d1a838d";
export const XDSDocumentEntryClassCode = "urn:uuid:41a5887f-8865-4c09-adf7-e362475b143a";
export const XDSDocumentEntryConfidentialityCode = "urn:uuid:f4f85eac-e6cb-4883-b524-f2705394840f";
export const XDSDocumentEntryEventCodeList = "urn:uuid:2c6b8cb7-8b2a-4051-b291-b1ae6a575ef4";
export const XDSDocumentEntryFormatCode = "urn:uuid:a09d5840-386c-46f2-b5ad-9c3699a4309d";
export const XDSDocumentEntryHealthcareFacilityTypeCode =
  "urn:uuid:f33fb8ac-18af-42cc-ae0e-ed0b0bdb91e1";
export const XDSDocumentEntryPracticeSettingCode = "urn:uuid:cccf5598-8b07-4b77-a05e-ae952c785ead";
export const XDSDocumentEntryTypeCode = "urn:uuid:f0306f51-975f-434e-a61c-c59651d33983";

/**
 * IHE XDS ExternalIdentifier Scheme UUIDs
 * Source: IHE IT Infrastructure Technical Framework Volume 3, Table 4.2.5-1
 */
export const XDSDocumentEntryPatientId = "urn:uuid:58a6f841-87b3-4a3e-92fd-a8ffeff98427";
export const XDSDocumentEntryUniqueId = "urn:uuid:2e82c1f6-a085-4c72-9da3-8640a32e42ab";
