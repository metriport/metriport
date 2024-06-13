import {
  Bundle,
  CodeableConcept,
  FamilyMemberHistory,
  FamilyMemberHistoryCondition,
} from "@medplum/fhirtypes";
import { toArray } from "@metriport/shared";
import { isFamilyMemberHistory } from "../../../external/fhir/shared";
import { FamilyHistorySection } from "../../cda-types/sections";
import {
  ActStatusCode,
  CdaCodeCe,
  CdaCodeCv,
  ObservationEntry,
  ObservationOrganizer,
  ObservationTableRow,
  Subject,
} from "../../cda-types/shared-types";
import {
  buildCodeCe,
  buildCodeCvFromCodeableConcept,
  buildInstanceIdentifier,
  buildSimpleReference,
  formatDateToCdaTimestamp,
  getDisplaysFromCodeableConcepts,
  mapGenderCode,
  withNullFlavor,
} from "../commons";
import {
  NOT_SPECIFIED,
  _xmlnsSdtcAttribute,
  extensionValue2015,
  loincCodeSystem,
  loincSystemName,
  oids,
  placeholderOrgOid,
  snomedCodeSystem,
  snomedSystemName,
} from "../constants";
import { createTableRowsAndEntries } from "../create-table-rows-and-entries";
import { initiateSectionTable } from "../table";
import { AugmentedFamilyMemberHistory } from "./augmented-resources";

const familyHistorySectionName = "familyhistory";

const tableHeaders = ["Medical History", "Relation", "Name", "Comments"];

export function buildFamilyHistory(fhirBundle: Bundle): FamilyHistorySection {
  const familyHistory: FamilyMemberHistory[] =
    fhirBundle.entry?.flatMap(entry =>
      isFamilyMemberHistory(entry.resource) ? [entry.resource] : []
    ) || [];

  if (familyHistory.length === 0) {
    return undefined;
  }

  const augmentedMemberHistories = familyHistory.map(memberHistory => {
    return new AugmentedFamilyMemberHistory(familyHistorySectionName, memberHistory);
  });

  const { trs, entries } = createTableRowsAndEntries(
    augmentedMemberHistories,
    createTableRowFromMemberHistory,
    createEntryFromMemberHistory
  );

  const table = initiateSectionTable(familyHistorySectionName, tableHeaders, trs);

  return {
    templateId: buildInstanceIdentifier({
      root: oids.familyHistorySection,
      extension: extensionValue2015,
    }),
    code: buildCodeCe({
      code: "10157-6",
      codeSystem: loincCodeSystem,
      codeSystemName: loincSystemName,
      displayName: "Family History",
    }),
    title: "FAMILY HISTORY",
    text: table,
    entry: entries,
  };
}

function createTableRowFromMemberHistory(
  augHistory: AugmentedFamilyMemberHistory,
  referenceId: string
): ObservationTableRow[] {
  const relationship = augHistory.resource.relationship;
  return [
    {
      tr: {
        _ID: referenceId,
        ["td"]: [
          {
            "#text": getMedicalConditions(augHistory.resource.condition) ?? NOT_SPECIFIED,
          },
          {
            "#text": relationship ? getDisplaysFromCodeableConcepts(relationship) : NOT_SPECIFIED,
          },
          {
            "#text": augHistory.resource.patient?.display ?? NOT_SPECIFIED,
          },
          {
            "#text": getNotes(augHistory.resource.condition) ?? NOT_SPECIFIED,
          },
        ],
      },
    },
  ];
}

function getMedicalConditions(
  conditions: FamilyMemberHistoryCondition[] | undefined
): string | undefined {
  if (!conditions) return undefined;
  return conditions
    ?.map(condition =>
      condition.code ? getDisplaysFromCodeableConcepts(toArray(condition.code)) : undefined
    )
    .join("; ");
}

function getNotes(conditions: FamilyMemberHistoryCondition[] | undefined): string | undefined {
  if (!conditions) return undefined;
  const combinedNotes = conditions
    ?.map(condition => condition.note?.map(note => note.text).join("; "))
    .join("; ");
  if (!combinedNotes.length) return undefined;
  return combinedNotes;
}

function createEntryFromMemberHistory(
  augHistory: AugmentedFamilyMemberHistory,
  referenceId: string
): ObservationOrganizer {
  return {
    organizer: {
      _classCode: "CLUSTER",
      _moodCode: "EVN",
      templateId: buildInstanceIdentifier({
        root: augHistory.typeOid,
        extension: extensionValue2015,
      }),
      id: buildInstanceIdentifier({
        root: placeholderOrgOid,
        extension: augHistory.resource.id,
      }),
      statusCode: {
        _code: mapFamilyHistoryStatusCode(augHistory.resource.status),
      },
      subject: {
        relatedSubject: {
          code: mapRelationship(augHistory.resource.relationship, referenceId),
          subject: buildSubject(augHistory.resource),
        },
      },
      component: buildComponents(augHistory.resource.condition),
    },
  };
}

function buildSubject(memberHist: FamilyMemberHistory): Subject {
  const genderCode = buildCodeCvFromCodeableConcept(memberHist.sex);
  const mappedGenderCode = remapGenderCode(genderCode);

  const birthTime = withNullFlavor(formatDateToCdaTimestamp(memberHist.bornDate), "_value");

  const deceasedBoolean = memberHist.deceasedBoolean;
  const deceasedInd = deceasedBoolean
    ? {
        _value: memberHist.deceasedBoolean,
        [_xmlnsSdtcAttribute]: "urn:hl7-org:sdtc",
      }
    : undefined;

  return {
    administrativeGenderCode: mappedGenderCode,
    birthTime,
    deceasedInd, // TODO: Validator not accepting this even though this looks correct based on the spec..
  };
}

function mapRelationship(
  relationship: CodeableConcept | undefined,
  referenceId: string
): CdaCodeCv | undefined {
  const relationshipCoding = relationship?.coding?.[0];
  if (!relationshipCoding) return undefined;

  const { code, display, system } = relationshipCoding;
  if (!code || !system) return undefined;

  const codeCe: Partial<CdaCodeCe> = {
    _code: code,
  };

  if (system?.toLowerCase().includes("rolecode")) {
    codeCe._codeSystem = "2.16.840.1.113883.5.111";
    codeCe._codeSystemName = "RoleCode";
  } else if (system?.toLowerCase().includes("snomed")) {
    codeCe._codeSystem = snomedCodeSystem;
    codeCe._codeSystemName = snomedSystemName;
  } else {
    throw new Error("Relationship code must be in SNOMED or HL7 RoleCode coding system");
  }

  return {
    ...codeCe,
    ...(display && { _displayName: display }),
    originalText: buildSimpleReference(referenceId),
  };
}

function remapGenderCode(genderCode: CdaCodeCe | undefined): CdaCodeCe | undefined {
  if (!genderCode) return undefined;
  return buildCodeCe({
    code: mapGenderCode(genderCode._code),
    codeSystem: "2.16.840.1.113883.5.1",
    codeSystemName: "AdministrativeGender",
    displayName: genderCode._displayName,
  });
}

function buildComponents(
  conditions: FamilyMemberHistoryCondition[] | undefined
): ObservationEntry[] | undefined {
  if (!conditions) return undefined;
  const codeCe = buildCodeCe({
    code: "418799008",
    codeSystem: snomedCodeSystem,
    codeSystemName: snomedSystemName,
    displayName: "Finding reported by subject or history provider (finding)",
  });
  const codeCv: CdaCodeCv = {
    ...codeCe,
    translation: buildCodeCe({
      code: "75315-2",
      codeSystem: loincCodeSystem,
      codeSystemName: loincSystemName,
      displayName: "Condition Family member",
    }),
  };

  return conditions.map(condition => {
    return {
      observation: {
        _classCode: "OBS",
        _moodCode: "EVN",
        templateId: buildInstanceIdentifier({
          root: oids.familyHistoryObservation,
          extension: extensionValue2015,
        }),
        code: codeCv,
        text: {
          "#text": getMedicalConditions([condition]),
        },
      },
    };
  });
}

function mapFamilyHistoryStatusCode(status: string | undefined): ActStatusCode | undefined {
  if (!status) return undefined;
  switch (status) {
    case "partial":
      return "suspended";
    case "completed":
      return "completed";
    case "entered-in-error":
      return "nullified";
    case "health-unknown":
      return "new";
    default:
      return "completed";
  }
}
