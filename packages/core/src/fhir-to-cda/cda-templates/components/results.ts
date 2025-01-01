import { DiagnosticReport, Observation } from "@medplum/fhirtypes";
import { base64ToString } from "../../../util/base64";
import { ResultsSection } from "../../cda-types/sections";
import { ActStatusCode, ObservationTableRow } from "../../cda-types/shared-types";
import {
  buildCodeCe,
  buildCodeCvFromCodeableConcept,
  buildInstanceIdentifier,
  buildTemplateIds,
  formatDateToCdaTimestamp,
  formatDateToHumanReadableFormat,
  notOnFilePlaceholder,
  withNullFlavor,
} from "../commons";
import { NOT_SPECIFIED, extensionValue2015, oids, placeholderOrgOid } from "../constants";
import { AssembledNote } from "./augmented-resources";
import { SectionDetails } from "./notes-and-results";
import { createObservations } from "./observations";
import { initiateSectionTable } from "../table";

const resultsTableHeaders = ["Measurement", "Value and Unit", "Score", "Date Recorded"];

export function buildResultsSection(
  assembledNotes: AssembledNote[],
  sectionDetails: SectionDetails,
  sectionCode: string
): ResultsSection {
  const resultsSection: ResultsSection = {
    templateId: buildTemplateIds({
      root: oids.resultsSection,
      extension: extensionValue2015,
    }),
    code: buildCodeCe({
      code: sectionCode,
      codeSystem: "2.16.840.1.113883.6.1",
      codeSystemName: "LOINC",
      displayName: sectionDetails.display ?? sectionDetails.sectionName,
    }),
    title: sectionDetails.sectionName,
    text: notOnFilePlaceholder,
  };

  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  const combinedText: any = [];
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entries: any = [];

  assembledNotes.forEach((note, index) => {
    const referenceId = `results${index + 1}`;
    combinedText.push(
      getTextItemsFromDiagnosticReport(note.report, note.observations, referenceId)
    );
    entries.push(buildEntriesFromAssembledNote(note, referenceId));
  });

  resultsSection.text = combinedText.flat();
  resultsSection.entry = entries;
  return resultsSection;
}

function getTextItemsFromDiagnosticReport(
  report: DiagnosticReport,
  observations: Observation[] | undefined,
  referenceId: string
) {
  const contentLines = report.presentedForm?.[0]?.data
    ? base64ToString(report.presentedForm[0].data).split(/\n/)
    : [];

  const combinedText = [];
  if (contentLines.length > 0) {
    const contentObjects = contentLines.map(line => ({
      br: line,
    }));
    const presentedFormText = {
      content: {
        _ID: referenceId,
        br: contentObjects.map(o => o.br),
      },
    };
    combinedText.push(presentedFormText);
  }

  if (observations) {
    const rows = observations.map((obs, index) => {
      const obsReference = `${referenceId}-observation${index + 1}`;
      return createTableRowFromObservation(obs, obsReference);
    });
    const table = initiateSectionTable("results", resultsTableHeaders, rows);
    combinedText.push(table);
  }

  return combinedText;
}

function createTableRowFromObservation(
  observation: Observation,
  referenceId: string
): ObservationTableRow {
  const interpretation = observation.interpretation;
  const score = interpretation?.[0]?.coding?.[0]?.display ?? interpretation?.[0]?.text;
  const intValue = score ? parseInt(score) : undefined;
  const scoreValue = intValue != undefined && !isNaN(intValue) ? intValue.toString() : undefined;
  const scoreDisplay = scoreValue ?? score;

  const valueAndUnit =
    `${observation.valueQuantity?.value} ${observation.valueQuantity?.unit}`.trim();

  return {
    tr: {
      _ID: referenceId,
      ["td"]: [
        {
          "#text": observation.code?.coding?.[0]?.display ?? observation.code?.text,
        },
        {
          "#text": valueAndUnit ?? NOT_SPECIFIED,
        },
        {
          "#text": scoreDisplay ?? NOT_SPECIFIED,
        },
        {
          "#text": formatDateToHumanReadableFormat(observation.effectiveDateTime) ?? "Unknown",
        },
      ],
    },
  };
}

function buildEntriesFromAssembledNote(note: AssembledNote, referenceId: string) {
  const report = note.report;
  const observations = note.observations;
  const codeElement = buildCodeCvFromCodeableConcept(report.code);
  const organizer = {
    _classCode: "BATTERY",
    _moodCode: "EVN",
    templateId: buildTemplateIds({
      root: oids.resultOrganizer,
      extension: extensionValue2015,
    }),
    id: buildInstanceIdentifier({
      root: placeholderOrgOid,
      extension: report.id,
    }),
    code: codeElement,
    statusCode: buildCodeCe({
      code: mapResultsStatusCode(report.status),
    }),
    effectiveTime: {
      low: withNullFlavor(formatDateToCdaTimestamp(report.effectiveDateTime), "_value"),
      high: withNullFlavor(undefined, "_value"),
    },
    component: createObservations(observations, referenceId).map(o => o.component), // TODO: Add procedure components
  };

  return {
    _typeCode: "DRIV",
    organizer,
  };
}

/**
 * For FHIR statuses
 * @see https://hl7.org/fhir/R4/valueset-diagnostic-report-status.html
 * For CDA statuses:
 * @see https://terminology.hl7.org/5.2.0/ValueSet-v3-ActStatus.html
 */
export function mapResultsStatusCode(status: string | undefined): ActStatusCode {
  if (!status) return "completed";
  switch (status) {
    case "final" || "corrected" || "appended" || "amended":
      return "completed";
    case "registered":
      return "active";
    case "entered-in-error":
      return "nullified";
    case "cancelled":
      return "cancelled";
    case "preliminary":
      return "new";
    case "partial":
      return "active";
    default:
      return "completed";
  }
}
