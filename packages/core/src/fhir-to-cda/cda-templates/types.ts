import {
  assigningAuthorityNameAttribute,
  classCodeAttribute,
  codeAttribute,
  codeSystemAttribute,
  codeSystemNameAttribute,
  displayNameAttribute,
  extensionAttribute,
  inlineTextAttribute,
  moodCodeAttribute,
  namespaceXsiAttribute,
  rootAttribute,
  typeCodeAttribute,
  valueAttribute,
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
  administrativeGenderCode?: EntryObject | CDACodeCE;
  birthTime?: EntryObject;
  deceasedInd?: EntryObject;
  maritalStatusCode?: EntryObject | CDACodeCE;
  languageCommunication?: {
    languageCode: EntryObject | CDACodeCE;
  };
};

export type CDAName = {
  use?: EntryObject;
  given?: Entry;
  family?: Entry;
  validTime: CDAPeriod;
};

export type CDAOriginalText = {
  originalText: {
    reference: {
      [valueAttribute]: string;
    };
  };
};
export type CDACodeCE = {
  [codeAttribute]?: string | undefined;
  [codeSystemAttribute]?: string | undefined;
  [codeSystemNameAttribute]?: string | undefined;
  [displayNameAttribute]?: string | undefined;
};

export type CDAValueST = {
  [xsiTypeAttribute]?: string;
  [namespaceXsiAttribute]?: string;
  [inlineTextAttribute]?: string;
};
export interface CDACodeCV extends CDACodeCE {
  originalText?: CDAOriginalText | string | undefined;
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
    ["@_ID"]: string;
    td: {
      ["#text"]?: string | undefined;
    }[];
  };
};

export type ObservationEntry = {
  observation: {
    [classCodeAttribute]: string;
    [moodCodeAttribute]: string;
    templateId?: {
      [rootAttribute]?: string;
      [extensionAttribute]?: string;
    };
    id?: {
      [rootAttribute]?: string;
      [extensionAttribute]?: string;
    };
    code?: {
      [codeAttribute]?: string | undefined;
      [codeSystemAttribute]?: string | undefined;
      [codeSystemNameAttribute]?: string | undefined;
      [displayNameAttribute]?: string | undefined;
    };
    text: {
      reference: {
        [valueAttribute]: string;
      };
    };
    statusCode: {
      [codeAttribute]: string;
    };
    effectiveTime?: {
      [valueAttribute]?: string | undefined;
    };
    entryRelationship?: ObservationEntry[];
    interpretationCode?: CDACodeCE;
  };
};

export type SubstanceAdministationEntry = {
  substanceAdministration: {
    [classCodeAttribute]: string;
    [moodCodeAttribute]: string;
    templateId?: {
      [rootAttribute]?: string;
      [extensionAttribute]?: string;
    };
    id?: {
      [rootAttribute]?: string;
      [extensionAttribute]?: string;
    };
    statusCode: {
      [codeAttribute]?: string | undefined;
    };
    effectiveTime: {
      low: {
        [valueAttribute]?: string | undefined;
      };
      high: {
        [valueAttribute]?: string | undefined;
      };
    };
    consumable: {
      [typeCodeAttribute]: string;
      manufacturedProduct: {
        [codeAttribute]: string;
        templateId?: {
          [rootAttribute]?: string;
          [extensionAttribute]?: string;
        };
        manufacturedMaterial: {
          code: CDACodeCV | Entry;
        };
      };
    };
    entryRelationship?: {
      supply?: {
        [classCodeAttribute]: string;
        [moodCodeAttribute]: string;
      };
    };
  };
};
