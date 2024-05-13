import {
  assigningAuthorityNameAttribute,
  codeAttribute,
  codeSystemAttribute,
  codeSystemNameAttribute,
  displayNameAttribute,
  extensionAttribute,
  namespaceAttribute,
  rootAttribute,
} from "../cda-templates/constants";

export type ClinicalDocument = {
  ClinicalDocument: {
    [namespaceAttribute]: string;
    realmCode?: CdaCodeCe;
    typeId?: CdaInstanceIdentifier;
    templateId?: CdaInstanceIdentifier[];
    id: CdaInstanceIdentifier;
    code: CdaCodeCe;
    title?: string;
    effectiveTime: Entry;
    confidentialityCode: CdaCodeCe;
    languageCode?: CdaCodeCe;
    setId?: CdaInstanceIdentifier;
    versionNumber?: Entry;
    recordTarget: CdaRecordTarget;
    author: CdaAuthor;
    custodian: CdaCustodian;
    component: unknown;
  };
};

export type Entry = { [key: string]: string } | string;
export type EntryObject = { [key: string]: string };

export type CdaTelecom = {
  use?: EntryObject;
  value?: EntryObject;
};

export type CdaPeriod = {
  low?: Entry;
  high?: Entry;
};

export type CdaAddress = {
  streetAddressLine?: Entry | undefined;
  city?: string | undefined;
  state?: string | undefined;
  postalCode?: string | undefined;
  country?: string | undefined;
  useablePeriod?: CdaPeriod | undefined;
};

export type CdaOrganization = {
  id?: CdaInstanceIdentifier[] | Entry;
  name?: Entry | undefined;
  telecom?: CdaTelecom[] | undefined;
  addr?: CdaAddress[] | undefined;
};

export type CdaAssignedAuthor = {
  id: Entry;
  addr?: CdaAddress[] | undefined;
  telecom?: CdaTelecom[] | undefined;
  representedOrganization?: CdaOrganization | undefined;
};

export type CdaPatientRole = {
  name?: CdaName[] | undefined;
  administrativeGenderCode?: EntryObject;
  birthTime?: EntryObject;
  deceasedInd?: EntryObject;
  maritalStatusCode?: EntryObject;
  languageCommunication?: {
    languageCode: EntryObject;
  };
};

export type CdaName = {
  use?: EntryObject;
  given?: Entry;
  family?: string | undefined;
  validTime: CdaPeriod;
};

export type CdaCodeCe = {
  [codeAttribute]?: string;
  [codeSystemAttribute]?: string;
  [codeSystemNameAttribute]?: string;
  [displayNameAttribute]?: string;
};

export interface CdaCodeCv extends CdaCodeCe {
  originalText?: string | undefined;
  translation?: CdaCodeCe[] | undefined;
}

// see https://build.fhir.org/ig/HL7/CDA-core-sd/StructureDefinition-II.html
export type CdaInstanceIdentifier = {
  [rootAttribute]?: string;
  [extensionAttribute]?: string;
  [assigningAuthorityNameAttribute]?: string;
};

// TOP Level CDA Section Types
export type CdaAuthor = {
  time: Entry;
  assignedAuthor: CdaAssignedAuthor;
};

export type CdaCustodian = {
  assignedCustodian: {
    representedCustodianOrganization: CdaOrganization | undefined;
  };
};

export type CdaRecordTarget = {
  patientRole: {
    id?: CdaInstanceIdentifier[] | Entry;
    addr?: CdaAddress[] | undefined;
    telecom?: CdaTelecom[] | undefined;
    patient: CdaPatientRole;
  };
};
