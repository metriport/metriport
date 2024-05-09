export type ClinicalDocument = {
  ClinicalDocument: {
    _namespaceAttribute: string;
    realmCode?: CDACodeCE;
    typeId?: CDAInstanceIdentifier;
    templateId?: CDAInstanceIdentifier[];
    id: CDAInstanceIdentifier;
    code: CDACodeCE;
    title?: string;
    effectiveTime: Entry;
    confidentialityCode: CDACodeCE;
    languageCode?: CDACodeCE;
    setId?: CDAInstanceIdentifier;
    versionNumber?: Entry;
    recordTarget: CDARecordTarget;
    author: CDAAuthor;
    custodian: CDACustodian;
    component: unknown;
  };
};

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
  streetAddressLine?: Entry | undefined;
  city?: string | undefined;
  state?: string | undefined;
  postalCode?: string | undefined;
  country?: string | undefined;
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
  family?: string | undefined;
  validTime: CDAPeriod;
};

export type CDACodeCE = {
  _codeAttribute?: string;
  _codeSystemAttribute?: string;
  _codeSystemNameAttribute?: string;
  _displayNameAttribute?: string;
};

export type CDAValueST = {
  _xsiTypeAttribute?: string;
  _xmlnsXsiAttribute?: string;
  _inlineTextAttribute?: string;
};
export interface CDACodeCV extends CDACodeCE {
  originalText?: string | undefined;
  translation?: CDACodeCE[] | undefined;
}

// see https://build.fhir.org/ig/HL7/CDA-core-sd/StructureDefinition-II.html
export type CDAInstanceIdentifier = {
  _rootAttribute?: string;
  _extensionAttribute?: string;
  _assigningAuthorityNameAttribute?: string;
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
