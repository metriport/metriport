import { Bundle, CodeableConcept, Condition } from "@medplum/fhirtypes";
import { ObservationTableRow } from "../../cda-types/shared-types";
import { isCondition } from "../../fhir";
import {
  buildCodeCe,
  buildInstanceIdentifier,
  createTableHeader,
  formatDateToCdaTimestamp,
  getTextFromCode,
  withoutNullFlavorObject,
} from "../commons";
import {
  _classCodeAttribute,
  _codeAttribute,
  _idAttribute,
  _inlineTextAttribute,
  _moodCodeAttribute,
  _valueAttribute,
  extensionValue2014,
  extensionValue2015,
  loincCodeSystem,
  loincSystemName,
  placeholderOrgOid,
} from "../constants";
import { createTableRowsAndEntries } from "../create-table-rows-and-entries";
import { AugmentedCondition } from "./augmented-resources";

export const problemsSectionName = "problems";
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
    return new AugmentedCondition(condition);
  });

  const { trs, entries } = createTableRowsAndEntries(
    augmentedConditions,
    createTableRowsFromCondition,
    createEntryFromCondition
  );

  const table = {
    [_idAttribute]: problemsSectionName,
    thead: createTableHeader(tableHeaders),
    tbody: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tr: trs.map((row: { tr: { [x: string]: any; td: any } }) => ({
        [_idAttribute]: row.tr[_idAttribute],
        td: row.tr.td,
      })),
    },
  };

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

function createTableRowsFromCondition(
  condition: AugmentedCondition,
  medicationsPrefix: string
): ObservationTableRow[] {
  const trs: ObservationTableRow[] = [];
  const tableRow = createTableRowFromCondition(condition, medicationsPrefix);
  if (tableRow) trs.push(tableRow);
  return trs;
}

function createTableRowFromCondition(
  condition: AugmentedCondition,
  referenceId: string
): ObservationTableRow | undefined {
  const name = getTextFromCode(condition.resource.code);
  return {
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
          [_inlineTextAttribute]: "TODO: Check Provider Response",
        },
        {
          [_inlineTextAttribute]: "TODO: Check Status",
        },
        {
          [_inlineTextAttribute]: condition.resource.note?.[0]?.text ?? "Not Specified",
        },
        {
          [_inlineTextAttribute]:
            "TODO: Figure out where to put comments in the Condition resource",
        },
      ],
    },
  };
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
        text: {
          reference: {
            [_valueAttribute]: referenceId,
          },
        },
        effectiveTime: {
          low: withoutNullFlavorObject(
            formatDateToCdaTimestamp(condition.resource.recordedDate),
            _valueAttribute
          ),
        },
      },
    },
  ];
}

function getIcdCode(code: CodeableConcept | undefined): string | undefined {
  const icdCoding = code?.coding?.find(coding => coding.system?.includes("icd-10-codes"));
  return icdCoding?.code;
}
