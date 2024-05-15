import {
  _assigningAuthorityNameAttribute,
  _classCodeAttribute,
  _codeAttribute,
  _codeSystemAttribute,
  _codeSystemNameAttribute,
  _displayNameAttribute,
  _extensionAttribute,
  _idAttribute,
  _inlineTextAttribute,
  _moodCodeAttribute,
  _namespaceAttribute,
  _namespaceSdtcAttribute,
  _namespaceXsiAttribute,
  _rootAttribute,
  _typeCodeAttribute,
  _valueAttribute,
  _xmlnsXsiAttribute,
  _xsiTypeAttribute,
} from "../cda-templates/constants";

export type ClinicalDocument = {
  ClinicalDocument: {
    [_namespaceAttribute]: string;
    [_namespaceSdtcAttribute]: string;
    [_namespaceXsiAttribute]: string;
    [_moodCodeAttribute]: string;
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
  maritalStatusCode?: EntryObject | CdaCodeCe;
  languageCommunication?: {
    languageCode: EntryObject | CdaCodeCe;
  };
};

export type CdaName = {
  use?: EntryObject;
  given?: Entry;
  family?: string | undefined;
  validTime: CdaPeriod;
};

export type CDAOriginalText = {
  originalText: {
    reference: {
      [_valueAttribute]: string;
    };
  };
};

// Ce (CE) stands for Coded with Equivalents
export type CdaCodeCe = {
  [_codeAttribute]?: string;
  [_codeSystemAttribute]?: string;
  [_codeSystemNameAttribute]?: string;
  [_displayNameAttribute]?: string;
};

// St (ST) stands for Simple Text
export type CdaValueSt = {
  [_xsiTypeAttribute]?: string;
  [_xmlnsXsiAttribute]?: string;
  [_inlineTextAttribute]?: string;
};

// Cv (CV) stands for Coded Value
export interface CdaCodeCv extends CdaCodeCe {
  originalText?: CDAOriginalText | string | undefined;
  translation?: CdaCodeCe[] | undefined;
}

// see https://build.fhir.org/ig/HL7/CDA-core-sd/StructureDefinition-II.html
export type CdaInstanceIdentifier = {
  [_rootAttribute]?: string;
  [_extensionAttribute]?: string;
  [_assigningAuthorityNameAttribute]?: string;
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

export type CreateTableRowsCallback<T> = (
  observation: T,
  sectionPrefix: string
) => ObservationTableRow[];

export type CreateEntriesCallback<T> = (
  aug: T,
  sectionPrefix: string
  // ) => (ObservationEntry | SubstanceAdministationEntry)[];
) => unknown[];

export type TableRowsAndEntriesResult = {
  trs: ObservationTableRow[];
  // entries: (ObservationEntry | SubstanceAdministationEntry)[];
  entries: unknown[];
};

export type ObservationTableRow = {
  tr: {
    [_idAttribute]: string;
    td: {
      [_inlineTextAttribute]?: string | undefined;
    }[];
  };
};
export type ObservationEntry = {
  observation: {
    [_classCodeAttribute]: string;
    [_moodCodeAttribute]: string;
    templateId?: {
      [_rootAttribute]?: string;
      [_extensionAttribute]?: string;
    };
    id?: {
      [_rootAttribute]?: string;
      [_extensionAttribute]?: string;
    };
    code?: {
      [_codeAttribute]?: string | undefined;
      [_codeSystemAttribute]?: string | undefined;
      [_codeSystemNameAttribute]?: string | undefined;
      [_displayNameAttribute]?: string | undefined;
    };
    text: {
      reference: {
        [_valueAttribute]: string;
      };
    };
    statusCode: {
      [_codeAttribute]: string;
    };
    effectiveTime?: {
      [_valueAttribute]?: string | undefined;
    };
    entryRelationship?: ObservationEntryRelationship[];
    interpretationCode?: CdaCodeCe;
  };
};

export type ObservationEntryRelationship = ObservationEntry & {
  observation: {
    typeCode: string;
  };
};

export type SubstanceAdministationEntry = {
  substanceAdministration: {
    [_classCodeAttribute]: string;
    [_moodCodeAttribute]: string;
    templateId?: {
      [_rootAttribute]?: string;
      [_extensionAttribute]?: string;
    };
    id?: {
      [_rootAttribute]?: string;
      [_extensionAttribute]?: string;
    };
    statusCode: {
      [_codeAttribute]?: string | undefined;
    };
    effectiveTime: {
      low: {
        [_valueAttribute]?: string | undefined;
      };
      high: {
        [_valueAttribute]?: string | undefined;
      };
    };
    consumable: {
      [_typeCodeAttribute]: string;
      manufacturedProduct: {
        // [_codeAttribute]: string;
        templateId?: {
          [_rootAttribute]?: string;
          [_extensionAttribute]?: string;
        };
        manufacturedMaterial: {
          code: CdaCodeCv | Entry;
        };
      };
    };
    entryRelationship?: {
      supply?: {
        [_classCodeAttribute]: string;
        [_moodCodeAttribute]: string;
      };
    };
  };
};
