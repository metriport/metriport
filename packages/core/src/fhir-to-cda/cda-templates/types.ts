export type Entry = { [key: string]: string } | string;
export type EntryObject = { [key: string]: string };

export type CDATelecom = {
  use?: EntryObject;
  value?: EntryObject;
};

export type CDAPeriod = {
  low?: Entry;
  high?: Entry;
};

export type CDAAddress = {
  streetAddressLine?: Entry;
  city?: Entry;
  state?: Entry;
  postalCode?: Entry;
  country?: Entry;
  useablePeriod?: CDAPeriod | undefined;
};

export type CDAOrganization = {
  id?: CDAInstanceIdentifier[] | undefined;
  name?: Entry;
  telecom?: CDATelecom[] | undefined;
  addr?: CDAAddress[] | undefined;
};

export type CDAAssignedAuthor = {
  id: Entry;
  addr?: CDAAddress[] | undefined;
  telecom?: CDATelecom[] | undefined;
  representedOrganization?: CDAOrganization | undefined;
};

export type CDAPatientRole = {
  name?: CDAName[] | undefined;
  administrativeGenderCode?: EntryObject;
  birthTime?: EntryObject;
  deceasedInd?: EntryObject;
  maritalStatusCode?: EntryObject;
  languageCommunication?: {
    languageCode: EntryObject;
  };
};

export type CDAName = {
  use?: EntryObject;
  given?: Entry;
  family?: Entry;
  validTime: CDAPeriod;
};

export type CDACodeCE = {
  "@_code"?: string;
  "@_codeSystem"?: string;
  "@_codeSystemName"?: string;
  "@_displayName"?: string;
};

export interface CDACodeCV extends CDACodeCE {
  originalText?: string | undefined;
  translation?: CDACodeCE[] | undefined;
}

// see https://build.fhir.org/ig/HL7/CDA-core-sd/StructureDefinition-II.html
export type CDAInstanceIdentifier = {
  "@_root"?: string;
  "@_extension"?: string;
  "@_assigningAuthorityName"?: string;
};

// TOP Level CDA Section Types
export type CDAAuthor = {
  time: Entry;
  assignedAuthor: CDAAssignedAuthor;
};

export type CDACustodian = {
  assignedCustodian: {
    representedCustodianOrganization: CDAOrganization | undefined;
  };
};

export type CDARecordTarget = {
  patientRole: {
    id?: CDAInstanceIdentifier[] | undefined;
    addr?: CDAAddress[] | undefined;
    telecom?: CDATelecom[] | undefined;
    patient: CDAPatientRole;
  };
};
