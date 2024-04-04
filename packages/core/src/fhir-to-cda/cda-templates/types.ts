import {
  assigningAuthorityNameAttribute,
  codeAttribute,
  codeSystemAttribute,
  codeSystemNameAttribute,
  displayNameAttribute,
  extensionAttribute,
  inlineTextAttribute,
  rootAttribute,
  xmlnsXsiAttribute,
  xsiTypeAttribute,
} from "./constants";

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
  id?: CDAInstanceIdentifier[] | Entry;
  name?: Entry | undefined;
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
  [codeAttribute]?: string;
  [codeSystemAttribute]?: string;
  [codeSystemNameAttribute]?: string;
  [displayNameAttribute]?: string;
};

export type CDAValueST = {
  [xsiTypeAttribute]?: string;
  [xmlnsXsiAttribute]?: string;
  [inlineTextAttribute]?: string;
};
export interface CDACodeCV extends CDACodeCE {
  originalText?: string | undefined;
  translation?: CDACodeCE[] | undefined;
}

// see https://build.fhir.org/ig/HL7/CDA-core-sd/StructureDefinition-II.html
export type CDAInstanceIdentifier = {
  [rootAttribute]?: string;
  [extensionAttribute]?: string;
  [assigningAuthorityNameAttribute]?: string;
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
    id?: CDAInstanceIdentifier[] | Entry;
    addr?: CDAAddress[] | undefined;
    telecom?: CDATelecom[] | undefined;
    patient: CDAPatientRole;
  };
};
