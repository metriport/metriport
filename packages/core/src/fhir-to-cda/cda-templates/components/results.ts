import { DiagnosticReport, Observation } from "@medplum/fhirtypes";
import { base64ToString } from "../../../util/base64";
import { ResultsSection } from "../../cda-types/sections";
import { ActStatusCode } from "../../cda-types/shared-types";
import {
  buildCodeCe,
  buildCodeCvFromCodeableConcept,
  buildInstanceIdentifier,
  buildTemplateIds,
  formatDateToCdaTimestamp,
  notOnFilePlaceholder,
  withNullFlavor,
} from "../commons";
import { extensionValue2015, oids, placeholderOrgOid } from "../constants";
import { AssembledNote } from "./augmented-resources";
import { createObservations } from "./observations";
import { SectionDetails } from "./notes-and-results";

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

  resultsSection.text = combinedText;
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

  let presentedFormText;
  if (contentLines.length > 0) {
    const contentObjects = contentLines.map(line => ({
      br: line,
    }));
    presentedFormText = {
      content: {
        _ID: referenceId,
        br: contentObjects.map(o => o.br),
      },
    };
  }

  if (observations) {
    // TODO: Implement observation text table creation?
  }

  return presentedFormText ?? "";
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
