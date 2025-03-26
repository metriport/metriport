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
    componentOf: EncompassingEncounter | undefined;
    component: unknown;
  };
};

export type ActStatusCode =
  | "new"
  | "active"
  | "held"
  | "completed"
  | "cancelled"
  | "nullified"
  | "completed"
  | "suspended";

export type CdaAddressUse =
  | "BAD"
  | "CONF"
  | "DIR"
  | "H"
  | "HP"
  | "HV"
  | "PHYS"
  | "PST"
  | "PUB"
  | "TMP"
  | "WP";

export type CdaGender = "M" | "F" | "UN" | undefined;
export type CdaTelecomUse = "AS" | "EC" | "HP" | "HV" | "MC" | "PG" | "WP";
export type Entry = { [key: string]: string } | string;
export type EntryObject = { [key: string]: string };

export type CdaTelecom = {
  _use?: EntryObject;
  _value?: EntryObject;
};

export type CdaPeriod = {
  low?: Entry;
  high?: Entry;
};

export type CdaAddress = {
  _use?: string;
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
  assignedAuthoringDevice: {
    manufacturerModelName: {
      "#text": string;
    };
    softwareName: {
      "#text": string;
    };
  };
};

export type CdaPatientRole = {
  name?: CdaName[] | undefined;
  administrativeGenderCode?: EntryObject;
  birthTime?: EntryObject;
  deceasedInd?: EntryObject;
  maritalStatusCode?: EntryObject | CdaCodeCe;
  raceCode?: Entry | CdaCodeCe;
  ethnicGroupCode?: Entry | CdaCodeCe;
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

export type CdaOriginalText = {
  _mediaType?: string;
  _representation?: string;
  reference: {
    _value: string;
  };
  "#text"?: string;
};

// Ce (CE) stands for Coded with Equivalents
export type CdaCodeCe = {
  _nullFlavor?: string;
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

// Ed (ED) stands for EncapsulatedData
export type CdaValueEd = {
  [_xsiTypeAttribute]?: "ED";
  [_xmlnsXsiAttribute]?: string;
  _representation?: string;
  _mediaType?: string;
  reference?: {
    _value: string;
  };
  "#text"?: string;
};

// Cd (CD) stands for Concept Descriptor
export type CdaValueCd = {
  [_xsiTypeAttribute]: "CD";
  _code?: string | undefined;
  _displayName?: string | undefined;
  _codeSystem?: string | undefined;
  _codeSystemName?: string | undefined;
  originalText?: CdaOriginalText;
  [_xmlnsXsiAttribute]?: string;
};

export type CdaValuePq = {
  [_xsiTypeAttribute]?: "PQ";
  _unit?: string | undefined;
  _value: string | number;
};

// Cv (CV) stands for Coded Value
export interface CdaCodeCv extends CdaCodeCe {
  originalText?: CdaOriginalText | string | undefined;
  translation?: CdaCodeCe[] | undefined;
}

/**
 * @see https://build.fhir.org/ig/HL7/CDA-core-sd/StructureDefinition-II.html
 */
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

export type EffectiveTimeLowHigh = {
  low?: EntryObject;
  high?: EntryObject;
};

export type EffectiveTimeValue = {
  _value?: string | undefined;
};

export type ObservationEntry = {
  _inversionInd?: boolean;
  _typeCode?: string;
  observation: {
    _classCode: string;
    _moodCode: string;
    templateId?: CdaInstanceIdentifier[];
    id?: CdaInstanceIdentifier[] | Entry;
    code?: CdaCodeCe | CdaCodeCv | undefined;
    text?: {
      reference?: {
        _value?: string | undefined;
      };
      "#text"?: string | undefined;
    };
    statusCode?: EntryObject;
    effectiveTime?: EffectiveTimeValue | EffectiveTimeLowHigh;
    priorityCode?: Entry;
    value?:
      | CdaValuePq
      | CdaValuePq[]
      | CdaValueCd
      | CdaValueCd[]
      | CdaValueEd
      | CdaValueEd[]
      | CdaValueSt
      | CdaValueSt[]
      | undefined;
    participant?: Participant | undefined;
    entryRelationship?: ObservationEntryRelationship | ObservationEntryRelationship[] | undefined;
    interpretationCode?: CdaCodeCe | CdaCodeCe[] | undefined;
  };
};

export type ObservationMedia = {
  _classCode: string;
  _moodCode: string;
  templateId?: CdaInstanceIdentifier[];
  id?: CdaInstanceIdentifier[];
  value?: CdaValueEd | undefined;
};

export type ObservationMediaEntry = {
  observationMedia: ObservationMedia;
};

export type ObservationEntryRelationship = ObservationEntry & {
  _typeCode?: string;
  _contextConductionInd?: boolean;
  code?: CdaCodeCv | undefined;
  value?: CdaValueCd[] | undefined;
};

export type Participant = {
  _typeCode: string;
  _contextControlCode?: string;
  participantRole: {
    id?: CdaInstanceIdentifier[] | Entry;
    _classCode?: string;
    templateId?: CdaInstanceIdentifier[];
    code?: CdaCodeCv | Entry | undefined;
    addr?: CdaAddress[] | undefined;
    telecom?: CdaTelecom[] | undefined;
    playingEntity?: {
      _classCode?: string;
      code?: CdaCodeCv | undefined;
      name?: {
        "#text": string;
      };
    };
  };
};

export type Consumable = {
  _typeCode: string;
  manufacturedProduct: {
    _classCode?: string;
    templateId?: CdaInstanceIdentifier[];
    manufacturedMaterial?: {
      code: CdaCodeCv | undefined;
    };
  };
};

export type SubstanceAdministationEntry = {
  substanceAdministration: {
    _classCode: string;
    _moodCode: string;
    _negationInd?: boolean;
    templateId: CdaInstanceIdentifier[];
    id?: CdaInstanceIdentifier;
    code?: CdaCodeCe | CdaCodeCv | undefined;
    text?: CdaOriginalText;
    statusCode: {
      _code?: string | undefined;
    };
    effectiveTime:
      | EntryObject
      | {
          [_xsiTypeAttribute]?: string;
          low: {
            _value?: string | undefined;
          };
          high: {
            _value?: string | undefined;
          };
        };
    doseQuantity?: CdaValuePq | EntryObject;
    consumable: Consumable;
    entryRelationship?: {
      supply?: {
        _classCode: string;
        _moodCode: string;
      };
    };
    performer?: AssignedEntity | undefined;
  };
};

export type ConcernActEntry = {
  _typeCode?: string;
  _contextConductionInd?: boolean;
  act: ConcernActEntryAct;
};

export type ConcernActEntryAct = {
  _classCode: string;
  _moodCode: string;
  templateId: CdaInstanceIdentifier[];
  id?: CdaInstanceIdentifier;
  code?: CdaCodeCe;
  text?: CdaOriginalText | undefined;
  statusCode?: {
    _code: string;
  };
  effectiveTime?: EffectiveTimeLowHigh;
  author?: CdaAuthor | undefined;
  informant?: ResponsibleParty | undefined;
  entryRelationship?: ObservationEntryRelationship;
};

export type ProcedureActivityEntry = {
  _typeCode?: string;
  procedure: {
    _classCode: string;
    _moodCode: string;
    templateId: CdaInstanceIdentifier[];
    id?: CdaInstanceIdentifier;
    code?: CdaCodeCv | undefined;
    text?: CdaOriginalText | undefined;
    statusCode?: {
      _code: string;
    };
    effectiveTime?: EffectiveTimeLowHigh;
  };
};

export type EncounterEntry = {
  encounter: {
    _classCode?: string;
    _moodCode?: string;
    templateId?: CdaInstanceIdentifier[];
    id?: CdaInstanceIdentifier;
    code: CdaCodeCv;
    statusCode?: {
      _code: string;
    };
    effectiveTime?: EffectiveTimeLowHigh;
    performer?: AssignedEntity[];
    participant?: Participant[] | undefined;
    entryRelationship: ConcernActEntry | ConcernActEntry[];
  };
};

export type AssignedPerson = {
  name: {
    given?: string | undefined;
    family?: string | undefined;
  };
};

export type RepresentedOrganization = {
  _classCode: string;
  name?: {
    "#text": string;
  };
  addr?: CdaAddress[] | undefined;
  telecom?: CdaTelecom[] | undefined;
};

export type AssignedEntity = {
  assignedEntity: {
    id?: CdaInstanceIdentifier | undefined;
    addr?: CdaAddress[] | undefined;
    code?: CdaCodeCv | CdaCodeCv[] | undefined;
    telecom?: CdaTelecom[] | undefined;
    assignedPerson?: AssignedPerson | undefined;
    representedOrganization?: RepresentedOrganization;
  };
};

export type ObservationOrganizer = {
  _classCode: Entry | string;
  _moodCode: string;
  templateId: CdaInstanceIdentifier[];
  id?: CdaInstanceIdentifier;
  code?: CdaCodeCe | CdaCodeCv | undefined;
  statusCode: {
    _code?: string | undefined;
  };
  effectiveTime?: EffectiveTimeLowHigh;
  subject?: {
    relatedSubject?: {
      _classCode: string;
      code: CdaCodeCv | undefined;
      subject: Subject;
    };
  };
  component?: (ObservationEntry | ObservationMediaEntry)[] | undefined;
};

export type ObservationOrganizerEntry = {
  _typeCode?: string;
  organizer: ObservationOrganizer;
};

export type ResponsibleParty = {
  assignedEntity: {
    id: CdaInstanceIdentifier;
    addr?: CdaAddress[] | undefined;
    telecom?: CdaTelecom[] | undefined;
    assignedPerson?: AssignedPerson | undefined;
    representedOrganization?: {
      name?: string;
    };
  };
};

export type HealthCareFacility = {
  id: CdaInstanceIdentifier;
  location: {
    name: string | undefined;
    addr: CdaAddress[] | undefined;
  };
};

export type EncompassingEncounter = {
  encompassingEncounter: {
    id: CdaInstanceIdentifier;
    code: CdaCodeCv;
    effectiveTime: {
      low: EntryObject;
      high: EntryObject;
    };
    responsibleParty: ResponsibleParty | undefined;
    location: {
      healthCareFacility: HealthCareFacility;
    };
  };
};

export type Subject = {
  name?: string | undefined;
  administrativeGenderCode?: CdaCodeCe | undefined;
  birthTime?: Entry | undefined;
  "sdtc:deceasedInd"?:
    | {
        _value?: boolean | undefined;
        [_xmlnsSdtcAttribute]: string;
      }
    | undefined;
};

export type TextParagraph = {
  paragraph: {
    "#text": string;
  };
};

type TextContent = {
  content: {
    _ID: string;
    br: string[];
  };
};

export type TextUnstructured = TextContent | TextContent[];
