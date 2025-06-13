import { Bundle, CodeableConcept, Procedure } from "@medplum/fhirtypes";
import { encodeToHtml } from "@metriport/shared/common/html";
import { isProcedure } from "../../../external/fhir/shared";
import { ProceduresSection } from "../../cda-types/sections";
import { ObservationTableRow, ProcedureActivityEntry } from "../../cda-types/shared-types";
import {
  buildCodeCe,
  buildCodeCvFromCodeableConcept,
  buildInstanceIdentifier,
  buildTemplateIds,
  formatDateToCdaTimestamp,
  formatDateToHumanReadableFormat,
  getNotes,
  getTextFromCode,
  mapCodingSystem,
  notOnFilePlaceholder,
  withNullFlavor,
} from "../commons";
import {
  extensionValue2015,
  loincCodeSystem,
  loincSystemName,
  NOT_SPECIFIED,
  oids,
  placeholderOrgOid,
} from "../constants";
import { createTableRowsAndEntries } from "../create-table-rows-and-entries";
import { initiateSectionTable } from "../table";
import { AugmentedProcedure } from "./augmented-resources";

const proceduresSectionName = "procedures";
const tableHeaders = ["Procedure", "ICD Code", "Associated Diagnosis", "Date/Time", "Comments"];

export function buildProcedures(fhirBundle: Bundle) {
  const proceduresSection: ProceduresSection = {
    templateId: buildTemplateIds({
      root: oids.proceduresSection,
      extension: extensionValue2015,
    }),
    code: buildCodeCe({
      code: "47519-4",
      codeSystem: loincCodeSystem,
      codeSystemName: loincSystemName,
      displayName: "History of Procedures Document",
    }),
    title: "PROCEDURES",
    text: notOnFilePlaceholder,
  };

  const procedures: Procedure[] =
    fhirBundle.entry?.flatMap(entry => (isProcedure(entry.resource) ? [entry.resource] : [])) || [];

  if (procedures.length === 0) {
    return {
      _nullFlavor: "NI",
      ...proceduresSection,
    };
  }

  const augmentedProcedures = procedures.map(procedure => {
    return new AugmentedProcedure(proceduresSectionName, procedure);
  });

  const { trs, entries } = createTableRowsAndEntries(
    augmentedProcedures,
    createTableRowFromProcedure,
    createEntryFromProcedure
  );

  const table = initiateSectionTable(proceduresSectionName, tableHeaders, trs);

  proceduresSection.text = table;
  proceduresSection.entry = entries;

  return proceduresSection;
}

function createTableRowFromProcedure(
  procedure: AugmentedProcedure,
  referenceId: string
): ObservationTableRow[] {
  const name = getTextFromCode(procedure.resource.code);
  return [
    {
      tr: {
        _ID: referenceId,
        ["td"]: [
          {
            "#text": name,
          },
          {
            "#text": getIcdCode(procedure.resource.code),
          },
          {
            "#text": NOT_SPECIFIED, // TODO: Figure out the mapping for the diagnosis / results
          },
          {
            "#text":
              formatDateToHumanReadableFormat(procedure.resource.performedPeriod?.start) ??
              formatDateToHumanReadableFormat(procedure.resource.performedDateTime) ??
              NOT_SPECIFIED,
          },
          {
            "#text": encodeToHtml(getNotes(procedure.resource.note) ?? NOT_SPECIFIED),
          },
        ],
      },
    },
  ];
}

function createEntryFromProcedure(
  procedure: AugmentedProcedure,
  referenceId: string
): ProcedureActivityEntry {
  return {
    procedure: {
      _classCode: "PROC",
      _moodCode: "EVN",
      templateId: buildTemplateIds({
        root: oids.procedureActivity,
        extension: extensionValue2015,
      }),
      id: buildInstanceIdentifier({
        root: placeholderOrgOid,
        extension: procedure.resource.id,
      }),
      code: buildCodeCvFromCodeableConcept(procedure.resource.code),
      text: {
        reference: {
          _value: `#${referenceId}`,
        },
      },
      statusCode: {
        _code: "completed",
      },
      effectiveTime: {
        low: withNullFlavor(
          formatDateToCdaTimestamp(procedure.resource.performedPeriod?.start),
          "_value"
        ),
        high: withNullFlavor(
          formatDateToCdaTimestamp(procedure.resource.performedPeriod?.end),
          "_value"
        ),
      },
    },
  };
}

function getIcdCode(code: CodeableConcept | undefined): string {
  const icdCoding = code?.coding?.find(coding => {
    if (coding.system?.toLowerCase().includes("icd")) {
      return true;
    }
    if (mapCodingSystem(coding.system?.toLowerCase())) {
      return true;
    }
    return false;
  });
  return icdCoding?.code ?? NOT_SPECIFIED;
}
