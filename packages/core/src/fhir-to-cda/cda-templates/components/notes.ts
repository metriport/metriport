import { DiagnosticReport } from "@medplum/fhirtypes";
import { base64ToString } from "../../../util/base64";
import { NotesSection } from "../../cda-types/sections";
import { ConcernActEntry, TextUnstructured } from "../../cda-types/shared-types";
import {
  buildCodeCe,
  buildCodeCvFromCodeableConcept,
  buildInstanceIdentifier,
  buildTemplateIds,
  formatDateToCdaTimestamp,
  notOnFilePlaceholder,
  withoutNullFlavorObject,
} from "../commons";
import { extensionValue2015, oids, placeholderOrgOid } from "../constants";
import { AssembledNote } from "./augmented-resources";
import { mapEncounterStatusCode } from "./encounters";
import { SectionDetails } from "./notes-and-results";

export function buildNotes(
  assembledNotes: AssembledNote[],
  sectionDetails: SectionDetails,
  sectionCode: string
): NotesSection {
  const resultsSection: NotesSection = {
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
    const referenceId = `${sectionDetails.sectionName
      .split(" ")
      .join("_")
      .replace(/&/g, "")
      .toLowerCase()}${index + 1}`;
    combinedText.push(getTextItemsFromDiagnosticReport(note.report, referenceId));
    entries.push(buildEntriesFromDiagnosticReport(note.report, referenceId));
  });

  resultsSection.text = combinedText;
  resultsSection.entry = entries;
  return resultsSection;
}

export function getTextItemsFromDiagnosticReport(
  report: DiagnosticReport,
  referenceId: string
): string | TextUnstructured {
  const contentLines = report.presentedForm?.[0]?.data
    ? base64ToString(report.presentedForm[0].data).split(/\n/)
    : [];

  if (contentLines.length > 0) {
    const contentObjects = contentLines.map(line => ({
      br: line,
    }));

    if (contentLines.some(line => line.includes("<table>"))) {
      return contentObjects.map(o => o.br.trim()).join("");
    }

    return {
      content: {
        _ID: `${referenceId}`,
        br: contentObjects.map(o => o.br),
      },
    };
  }
  return "Not on file";
}

export function buildEntriesFromDiagnosticReport(
  report: DiagnosticReport,
  referenceId: string
): ConcernActEntry {
  const cdCodesFromCodes = buildCodeCvFromCodeableConcept(report.code);
  const defaultNoteCode = buildCodeCe({ code: "10164-2", codeSystem: "2.16.840.1.113883.6.1" });

  // TODO: Implement if required
  // const author = buildAuthor(primaryOrganization);
  // const practitioner = buildResponsibleParty(primaryPractitioner);

  return {
    act: {
      _classCode: "ACT",
      _moodCode: "EVN",
      templateId: buildTemplateIds({
        root: oids.noteActivity,
        extension: extensionValue2015,
      }),
      id: buildInstanceIdentifier({
        root: placeholderOrgOid,
        extension: report.id,
      }),
      code: cdCodesFromCodes ?? defaultNoteCode,
      text: {
        reference: {
          _value: `#${referenceId}`,
        },
      },
      statusCode: {
        _code: mapEncounterStatusCode(report.status),
      },
      effectiveTime: withoutNullFlavorObject(
        formatDateToCdaTimestamp(report.effectiveDateTime),
        "_value"
      ),
      // author,
      // informant: practitioner,
    },
  };
}
