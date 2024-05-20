import { Bundle, CodeableConcept, Condition } from "@medplum/fhirtypes";
import { ObservationTableRow } from "../../cda-types/shared-types";
import { isCondition } from "../../fhir";
import {
  buildCodeCe,
  buildInstanceIdentifier,
  buildValueCd,
  formatDateToCdaTimestamp,
  getTextFromCode,
  initiateSectionTable,
  isLoinc,
  withoutNullFlavorObject,
} from "../commons";
import {
  NOT_SPECIFIED,
  _classCodeAttribute,
  _codeAttribute,
  _idAttribute,
  _inlineTextAttribute,
  _moodCodeAttribute,
  _typeCodeAttribute,
  _valueAttribute,
  extensionValue2014,
  extensionValue2015,
  loincCodeSystem,
  loincSystemName,
  placeholderOrgOid,
} from "../constants";
import { createTableRowsAndEntries } from "../create-table-rows-and-entries";
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

export function buildProblems(fhirBundle: Bundle) {
  const conditions: Condition[] =
    fhirBundle.entry?.flatMap(entry => (isCondition(entry.resource) ? [entry.resource] : [])) || [];

  if (conditions.length === 0) {
    return undefined;
  }

  const augmentedConditions = conditions.map(condition => {
    return new AugmentedCondition(condition, problemsSectionName);
  });

  const { trs, entries } = createTableRowsAndEntries(
    augmentedConditions,
    createTableRowFromCondition,
    createEntryFromCondition
  );

  const table = initiateSectionTable(problemsSectionName, tableHeaders, trs);

  const problemsSection = {
    component: {
      section: {
        templateId: buildInstanceIdentifier({
          root: "2.16.840.1.113883.10.20.22.2.5.1",
          extension: extensionValue2015,
        }),
        code: buildCodeCe({
          code: "11450-4",
          codeSystem: loincCodeSystem,
          codeSystemName: loincSystemName,
          displayName: "Problem list - Reported",
        }),
        title: "PROBLEMS",
        text: { table },
        entry: entries,
      },
    },
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
        [_idAttribute]: referenceId,
        ["td"]: [
          {
            [_inlineTextAttribute]: getIcdCode(condition.resource.code),
          },
          {
            [_inlineTextAttribute]: name,
          },
          {
            [_inlineTextAttribute]: "", // TODO: Find out what Provider Response stands for and map accordingly
          },
          {
            [_inlineTextAttribute]: "", // TODO: Find out what Status stands for and map accordingly
          },
          {
            [_inlineTextAttribute]: condition.resource.note?.[0]?.text ?? NOT_SPECIFIED,
          },
          {
            [_inlineTextAttribute]: "", // TODO: Figure out where to put comments in the Condition resource
          },
        ],
      },
    },
  ];
}

function createEntryFromCondition(condition: AugmentedCondition, referenceId: string) {
  return [
    {
      act: {
        [_classCodeAttribute]: "ACT",
        [_moodCodeAttribute]: "EVN",
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
          [_codeAttribute]: condition.resource.clinicalStatus?.coding?.[0]?.code ?? "active", // TODO: Check if this is the correct approach
        },
        effectiveTime: {
          low: withoutNullFlavorObject(
            formatDateToCdaTimestamp(condition.resource.recordedDate),
            _valueAttribute
          ),
        },
        entryRelationship: createEntryRelationship(condition.resource, referenceId),
      },
    },
  ];
}

function getIcdCode(code: CodeableConcept | undefined): string | undefined {
  const icdCoding = code?.coding?.find(coding => coding.system?.includes("icd-10-codes"));
  return icdCoding?.code;
}

function createEntryRelationship(condition: Condition, referenceId: string) {
  const codeSystem = condition.code?.coding?.[0]?.system;
  const systemIsLoinc = isLoinc(codeSystem);
  return {
    [_typeCodeAttribute]: "SUBJ",
    observation: {
      [_classCodeAttribute]: "OBS",
      [_moodCodeAttribute]: "EVN",
      templateId: buildInstanceIdentifier({
        root: "2.16.840.1.113883.10.20.22.4.4",
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
