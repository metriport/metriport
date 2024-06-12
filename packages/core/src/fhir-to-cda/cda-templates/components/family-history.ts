import { Bundle, FamilyMemberHistory, FamilyMemberHistoryCondition } from "@medplum/fhirtypes";
import { toArray } from "@metriport/shared";
import { isFamilyMemberHistory } from "../../../external/fhir/shared";
import { ConcernActEntry, ObservationTableRow } from "../../cda-types/shared-types";
import {
  buildCodeCe,
  buildCodeCvFromCodeableConcept,
  buildInstanceIdentifier,
  buildValueCd,
  getDisplaysFromCodeableConcepts,
} from "../commons";
import {
  NOT_SPECIFIED,
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

export function buildFamilyHistory(fhirBundle: Bundle) {
  const familyHistory: FamilyMemberHistory[] =
    fhirBundle.entry?.flatMap(entry =>
      isFamilyMemberHistory(entry.resource) ? [entry.resource] : []
    ) || [];

  if (familyHistory.length === 0) {
    return undefined;
  }

  console.log(familyHistory);
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
) {
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
        extension: augHistory.resource.id, // TODO: potentially a different ID
      }),
      statusCode: {
        _code: mapFamilyHistoryStatusCode(augHistory.resource.status),
      },
      subject: {
        relatedSubject: {
          // _classCode: "PRS",
          code: buildCodeCvFromCodeableConcept(augHistory.resource.relationship, referenceId),
          subject: {
            administrativeGenderCode: buildCodeCvFromCodeableConcept(augHistory.resource.sex),
          },
        },
      },
      ...buildComponents(augHistory.resource.condition),
    },
  };
}

function buildComponents(conditions: FamilyMemberHistoryCondition[] | undefined) {
  if (!conditions) return undefined;
  const code = buildCodeCe({
    code: "418799008",
    codeSystem: snomedCodeSystem,
    codeSystemName: snomedSystemName,
    displayName: "Finding reported by subject or history provider (finding)",
  });
  // const codeCv = buildCodeCeFromCodeCv();
  return conditions.map(condition => {
    return {
      observation: {
        _classCode: "OBS",
        _moodCode: "EVN",
        templateId: buildInstanceIdentifier({
          root: oids.familyHistoryObservation,
          extension: extensionValue2015,
        }),
        code,
        text: {
          "#text": condition.code?.text,
        },
      },
    };
  });
}

function mapFamilyHistoryStatusCode(status: string | undefined): string | undefined {
  // function mapFamilyHistoryStatusCode(status: string | undefined): ActStatusCode | undefined {
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

export function createEntryRelationshipObservation(
  encounter: FamilyMemberHistory,
  referenceId: string
): ConcernActEntry {
  return {
    _typeCode: "RSON",
    act: {
      _classCode: "ACT",
      _moodCode: "EVN",
      templateId: buildInstanceIdentifier({
        root: oids.encounterDiagnosis,
      }),
      code: buildCodeCe({
        code: "29308-4",
        codeSystem: loincCodeSystem,
        codeSystemName: loincSystemName,
        displayName: "Encounter Diagnosis",
      }),
      entryRelationship: {
        _inversionInd: false,
        _typeCode: "SUBJ",
        observation: {
          _classCode: "OBS",
          _moodCode: "EVN",
          code: {
            ...buildCodeCe({
              code: "282291009",
              codeSystem: "2.16.840.1.113883.3.88.12.3221.7.2", // https://www.findacode.com/snomed/282291009--diagnosis-interpretation.html
              codeSystemName: "SNOMED CT",
              displayName: "Diagnosis",
            }),
            translation: [
              buildCodeCe({
                code: "29308-4",
                codeSystem: loincCodeSystem,
                codeSystemName: loincSystemName,
                displayName: "Diagnosis",
              }),
            ],
          },
          value: encounter.reasonCode?.flatMap(reason => buildValueCd(reason, referenceId) || []),
        },
      },
    },
  };
}
