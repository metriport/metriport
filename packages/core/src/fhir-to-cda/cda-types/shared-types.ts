import {
  _xmlnsSdtcAttribute,
  _xmlnsXsiAttribute,
  _xsiTypeAttribute,
} from "../cda-templates/constants";

export type ClinicalDocument = {
  ClinicalDocument: {
    _xmlns: string;
    [_xmlnsSdtcAttribute]: string;
    [_xmlnsXsiAttribute]: string;
    _moodCode: string;
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
  reference: {
    _value: string;
  };
};

// Ce (CE) stands for Coded with Equivalents
export type CdaCodeCe = {
  _code?: string;
  _codeSystem?: string;
  _codeSystemName?: string;
  _displayName?: string;
};

// St (ST) stands for Simple Text
export type CdaValueSt = {
  [_xsiTypeAttribute]?: "ST";
  [_xmlnsXsiAttribute]?: string;
  "#text"?: string;
};

// Cd (CD) stands for Concept Descriptor
export type CdaValueCd = {
  [_xsiTypeAttribute]?: "CD";
  _code?: string | undefined;
  _displayName?: string | undefined;
  _codeSystem?: string | undefined;
  originalText?: CDAOriginalText;
};

// Cv (CV) stands for Coded Value
export interface CdaCodeCv extends CdaCodeCe {
  originalText?: CDAOriginalText | string | undefined;
  translation?: CdaCodeCe[] | undefined;
}

// see https://build.fhir.org/ig/HL7/CDA-core-sd/StructureDefinition-II.html
export type CdaInstanceIdentifier = {
  _root?: string;
  _extension?: string;
  _assigningAuthorityName?: string;
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
) => ObservationTableRow | ObservationTableRow[];

export type CreateEntriesCallback<T, R> = (aug: T, sectionPrefix: string) => R;

export type TableRowsAndEntriesResult<D> = {
  trs: ObservationTableRow[];
  entries: D[];
};

export type ObservationTableRow = {
  tr: {
    _ID: string;
    td: {
      _ID?: string;
      "#text"?: string | undefined;
    }[];
  };
};
export type ObservationEntry = {
  _typeCode?: string;
  observation: {
    _classCode: string;
    _moodCode: string;
    templateId?: {
      _root?: string;
      _extension?: string;
    };
    id?: {
      _root?: string;
      _extension?: string;
    };
    code?: {
      _code?: string | undefined;
      _codeSystem?: string | undefined;
      _codeSystemName?: string | undefined;
      _displayName?: string | undefined;
    };
    text?: {
      reference: {
        _value: string;
      };
    };
    statusCode?: {
      _code: string;
    };
    effectiveTime?: {
      _value?: string | undefined;
    };
    value?: CdaValueCd | undefined;
    entryRelationship?: ObservationEntryRelationship[];
    interpretationCode?: CdaCodeCe;
  };
};

export type ObservationEntryRelationship = ObservationEntry & {
  _typeCode: string;
};

export type SubstanceAdministationEntry = {
  substanceAdministration: {
    _classCode: string;
    _moodCode: string;
    templateId?: {
      _root?: string;
      _extension?: string;
    };
    id?: {
      _root?: string;
      _extension?: string;
    };
    statusCode: {
      _code?: string | undefined;
    };
    effectiveTime: {
      [_xsiTypeAttribute]: string;
      low: {
        _value?: string | undefined;
      };
      high: {
        _value?: string | undefined;
      };
    };
    consumable: {
      _typeCode: string;
      manufacturedProduct: {
        // _code: string;
        templateId?: {
          _root?: string;
          _extension?: string;
        };
        manufacturedMaterial: {
          code: CdaCodeCv | Entry;
        };
      };
    };
    entryRelationship?: {
      supply?: {
        _classCode: string;
        _moodCode: string;
      };
    };
  };
};

export type ProblemsConcernActEntry = {
  act: {
    _classCode: string;
    _moodCode: string;
    templateId: CdaInstanceIdentifier;
    id: CdaInstanceIdentifier;
    code: CdaCodeCe;
    statusCode: {
      _code: string;
    };
    effectiveTime: {
      low?: EntryObject;
      high?: EntryObject;
    };
    entryRelationship: ObservationEntry;
  };
};
