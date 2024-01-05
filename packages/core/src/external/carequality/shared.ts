/*
CONFIDENTIALITY_CODE is always N, or normal, indicating its normal PHI
FORMAT_CODE is always urn:ihe:iti:xds:2017:mimeTypeSufficient, which is sufficient for all document types.
*/

export const DEFAULT_CLASS_CODE_NODE = "34133-9";
export const DEFAULT_CLASS_CODE_DISPLAY = "Continuity of Care Document";
export const DEFAULT_CONFIDENTIALITY_CODE = "N";
export const CONFIDENTIALITY_CODE_SYSTEM = "2.16.840.1.113883.5.25";
export const LOINC_CODE = "2.16.840.1.113883.6.1";
export const SNOMED_CODE = "2.16.840.1.113883.6.96";
export const DEFAULT_FORMAT_CODE_SYSTEM = "1.3.6.1.4.1.19376.1.2.3";
export const DEFAULT_FORMAT_CODE_NODE = "urn:ihe:iti:xds:2017:mimeTypeSufficient";
export const DEFAULT_PRACTICE_SETTING_CODE_NODE = "394802001";
export const DEFAULT_PRACTICE_SETTING_CODE_DISPLAY = "General Medicine";
export const DEFAULT_HEALTHCARE_FACILITY_TYPE_CODE_NODE = "394777002";
export const DEFAULT_HEALTHCARE_FACILITY_TYPE_CODE_DISPLAY = "Health Encounter Site";
export const METRIPORT_HOME_COMMUNITY_ID = "urn:oid:2.16.840.1.113883.3.9621";
export const METRIPORT_REPOSITORY_UNIQUE_ID = "urn:oid:2.16.840.1.113883.3.9621";
export const CODE_SYSTEM_REQUESTED_ERROR = "1.3.6.1.4.1.19376.1.2.27.1";
export const CODE_SYSTEM_REQUIRED_ERROR = "1.3.6.1.4.1.19376.1.2.27.3";

export function createPatientUniqueId(internalId: string, patientId: string): string {
  return btoa(`${internalId}/${patientId}`);
}

export class XDSUnknownPatientId extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "XDSUnknownPatientId";
  }
}

export class XDSUnknownCommunity extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "XDSUnknownCommunity";
  }
}

export class XDSMissingHomeCommunityId extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "XDSMissingHomeCommunityId";
  }
}

export class XDSRegistryError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "XDSRegistryError";
  }
}

export class XDSUnknownDocumentId extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "XDSUnknownDocumentId";
  }
}
