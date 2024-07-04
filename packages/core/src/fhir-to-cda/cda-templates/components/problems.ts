import { Bundle, CodeableConcept, Condition } from "@medplum/fhirtypes";
import { isCondition } from "../../../external/fhir/shared";
import { ProblemsSection } from "../../cda-types/sections";
import {
  ConcernActEntry,
  ObservationEntryRelationship,
  ObservationTableRow,
} from "../../cda-types/shared-types";
import {
  buildCodeCe,
  buildInstanceIdentifier,
  buildValueCd,
  formatDateToCdaTimestamp,
  getTextFromCode,
  isLoinc,
  mapCodingSystem,
  withoutNullFlavorObject,
} from "../commons";
import {
  NOT_SPECIFIED,
  extensionValue2014,
  extensionValue2015,
  loincCodeSystem,
  loincSystemName,
  oids,
  placeholderOrgOid,
} from "../constants";
import { createTableRowsAndEntries } from "../create-table-rows-and-entries";
import { initiateSectionTable } from "../table";
import { AugmentedCondition } from "./augmented-resources";

const problemsSectionName = "problems";
const tableHeaders = [
  "ICD Code",
  "Diagnosis",
  "Provider Response",
  "Status",
  "Treatment Plan",
  "Comments",
];

export function buildProblems(fhirBundle: Bundle): ProblemsSection {
  const conditions: Condition[] =
    fhirBundle.entry?.flatMap(entry => (isCondition(entry.resource) ? [entry.resource] : [])) || [];

  if (conditions.length === 0) {
    return undefined;
  }

  const augmentedConditions = conditions.map(condition => {
    return new AugmentedCondition(problemsSectionName, condition);
  });

  const { trs, entries } = createTableRowsAndEntries(
    augmentedConditions,
    createTableRowFromCondition,
    createEntryFromCondition
  );

  const table = initiateSectionTable(problemsSectionName, tableHeaders, trs);

  const problemsSection = {
    templateId: buildInstanceIdentifier({
      root: oids.problemsSection,
      extension: extensionValue2015,
    }),
    code: buildCodeCe({
      code: "11450-4",
      codeSystem: loincCodeSystem,
      codeSystemName: loincSystemName,
      displayName: "Problem list - Reported",
    }),
    title: "PROBLEMS",
    text: table,
    entry: entries,
  };
  return problemsSection;
}

function createTableRowFromCondition(
  condition: AugmentedCondition,
  referenceId: string
): ObservationTableRow[] {
  const name = getTextFromCode(condition.resource.code);
  return [
    {
      tr: {
        _ID: referenceId,
        ["td"]: [
          {
            "#text": getIcdCode(condition.resource.code),
          },
          {
            "#text": name,
          },
          {
            "#text": NOT_SPECIFIED, // TODO: Find out what Provider Response stands for and map accordingly
          },
          {
            "#text": NOT_SPECIFIED, // TODO: Find out what Status stands for and map accordingly
          },
          {
            "#text": condition.resource.note?.[0]?.text ?? NOT_SPECIFIED,
          },
          {
            "#text": NOT_SPECIFIED, // TODO: Figure out where to put comments in the Condition resource
          },
        ],
      },
    },
  ];
}

function createEntryFromCondition(
  condition: AugmentedCondition,
  referenceId: string
): ConcernActEntry {
  return {
    act: {
      _classCode: "ACT",
      _moodCode: "EVN",
      templateId: buildInstanceIdentifier({
        root: condition.typeOid,
        extension: extensionValue2014,
      }),
      id: buildInstanceIdentifier({
        root: placeholderOrgOid,
        extension: condition.resource.id,
      }),
      code: buildCodeCe({
        code: "CONC",
        codeSystem: "2.16.840.1.113883.5.6",
        displayName: "Concern",
      }),
      statusCode: {
        _code: condition.resource.clinicalStatus?.coding?.[0]?.code ?? "active", // TODO: Check if this is the correct approach
      },
      effectiveTime: {
        low: withoutNullFlavorObject(
          formatDateToCdaTimestamp(condition.resource.recordedDate),
          "_value"
        ),
      },
      entryRelationship: createEntryRelationship(condition.resource, referenceId),
    },
  };
}

function getIcdCode(code: CodeableConcept | undefined): string {
  const icdCoding = code?.coding?.find(coding => {
    if (coding.system?.toLowerCase().includes("icd-10")) {
      return true;
    }
    if (mapCodingSystem(coding.system?.toLowerCase())) {
      return true;
    }
    return false;
  });
  return icdCoding?.code ?? NOT_SPECIFIED;
}

function createEntryRelationship(
  condition: Condition,
  referenceId: string
): ObservationEntryRelationship {
  const codeSystem = condition.code?.coding?.[0]?.system;
  const systemIsLoinc = isLoinc(codeSystem);
  return {
    _typeCode: "SUBJ",
    observation: {
      _classCode: "OBS",
      _moodCode: "EVN",
      templateId: buildInstanceIdentifier({
        root: oids.problemObs,
        extension: extensionValue2015,
      }),
      id: buildInstanceIdentifier({
        root: placeholderOrgOid,
        extension: condition.id,
      }),
      code: buildCodeCe({
        code: condition.code?.coding?.[0]?.code,
        codeSystem: systemIsLoinc ? loincCodeSystem : codeSystem,
        codeSystemName: systemIsLoinc ? loincSystemName : undefined,
        displayName: condition.code?.coding?.[0]?.display,
      }),
      value: buildValueCd(condition.code, referenceId),
    },
  };
}
