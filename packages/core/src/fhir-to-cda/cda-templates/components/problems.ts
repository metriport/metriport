import { Bundle, CodeableConcept, Condition } from "@medplum/fhirtypes";
import { isCondition } from "../../fhir";
import {
  buildCodeCE,
  buildInstanceIdentifier,
  createTableHeader,
  formatDateToCDATimeStamp,
  getTextFromCode,
  withoutNullFlavorObject,
} from "../commons";
import {
  classCodeAttribute,
  codeAttribute,
  extensionValue2014,
  extensionValue2015,
  idAttribute,
  inlineTextAttribute,
  loincCodeSystem,
  loincSystemName,
  moodCodeAttribute,
  placeholderOrgOid,
  valueAttribute,
} from "../constants";
import { createTableRowsAndEntries } from "../create-table-rows-and-entries";
import { ObservationTableRow } from "../types";
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
    [idAttribute]: problemsSectionName,
    thead: createTableHeader(tableHeaders),
    tbody: {
      tr: trs.map(row => ({
        [idAttribute]: row.tr[idAttribute],
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
        code: buildCodeCE({
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
      [idAttribute]: referenceId,
      ["td"]: [
        {
          [inlineTextAttribute]: getIcdCode(condition.resource.code),
        },
        {
          [inlineTextAttribute]: name,
        },
        {
          [inlineTextAttribute]: "TODO: Check Provider Response",
        },
        {
          [inlineTextAttribute]: "TODO: Check Status",
        },
        {
          [inlineTextAttribute]: condition.resource.note?.[0]?.text ?? "Not Specified",
        },
        {
          [inlineTextAttribute]: "TODO: Figure out where to put comments in the Condition resource",
        },
      ],
    },
  };
}

function createEntryFromCondition(condition: AugmentedCondition, referenceId: string) {
  return [
    {
      act: {
        [classCodeAttribute]: "ACT",
        [moodCodeAttribute]: "EVN",
        templateId: buildInstanceIdentifier({
          root: condition.typeOid,
          extension: extensionValue2014,
        }),
        id: buildInstanceIdentifier({
          root: placeholderOrgOid,
          extension: condition.resource.id,
        }),
        code: buildCodeCE({
          code: "CONC",
          codeSystem: "2.16.840.1.113883.5.6",
          displayName: "Concern",
        }),
        statusCode: {
          [codeAttribute]: condition.resource.clinicalStatus?.coding?.[0]?.code ?? "active", // TODO: Check if this is the correct approach
        },
        text: {
          reference: {
            [valueAttribute]: referenceId,
          },
        },
        effectiveTime: {
          low: withoutNullFlavorObject(
            formatDateToCDATimeStamp(condition.resource.recordedDate),
            valueAttribute
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
