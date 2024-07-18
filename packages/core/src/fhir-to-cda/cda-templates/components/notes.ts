import { Bundle, DiagnosticReport } from "@medplum/fhirtypes";
import { isDiagnosticReport, isOrganization, isPractitioner } from "../../../external/fhir/shared";
import { base64ToString } from "../../../util/base64";
import { NotesSection } from "../../cda-types/sections";
import { ConcernActEntry, TextUnstructured } from "../../cda-types/shared-types";
import { buildAuthor } from "../clinical-document/author";
import {
  buildCodeCe,
  buildCodeCvFromCodeableConcept,
  buildInstanceIdentifier,
  buildTemplateIds,
  formatDateToCdaTimestamp,
  getDisplaysFromCodeableConcepts,
  withoutNullFlavorObject,
} from "../commons";
import { extensionValue2015, oids, placeholderOrgOid } from "../constants";
import { buildResponsibleParty } from "./encompassing-encounter";
import { mapEncounterStatusCode } from "./encounters";

export const notesCodingMap = new Map<string, string>([
  ["34111-5", "ED Notes"],
  ["10164-2", "Progress Notes"],
  ["34117-2", "H&P Notes"],
]);

export function buildNotes(fhirBundle: Bundle) {
  const diagnosticReports: DiagnosticReport[] =
    fhirBundle.entry?.flatMap(entry =>
      isDiagnosticReport(entry.resource) ? [entry.resource] : []
    ) || [];

  if (diagnosticReports.length === 0) {
    return undefined;
  }
  const notesReports = diagnosticReports.filter(report =>
    report.code?.coding?.some(
      coding => coding.code && Array.from(notesCodingMap.keys()).includes(coding.code)
    )
  );

  return notesReports.map(report => buildNotesSection(report, fhirBundle));
}

function buildNotesSection(diagnosticReport: DiagnosticReport, fhirBundle: Bundle): NotesSection {
  const text = getTextItemsFromDiagnosticReports(diagnosticReport);
  const code = diagnosticReport.code;
  const primaryCoding = code?.coding?.[0];
  const primaryCode = primaryCoding?.code;
  const title = primaryCode
    ? notesCodingMap.get(primaryCode)
    : getDisplaysFromCodeableConcepts(code);
  return {
    templateId: buildInstanceIdentifier({
      root: oids.notesSection,
    }),
    code: buildCodeCe({
      code: primaryCoding?.code,
      codeSystem: primaryCoding?.system,
      displayName: primaryCoding?.display,
    }),
    title: title ?? "Notes",
    text,
    entry: buildEntriesFromDiagnosticReport(diagnosticReport, fhirBundle),
  };
}

export function getTextItemsFromDiagnosticReports(
  report: DiagnosticReport
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

    return [
      {
        content: {
          _ID: `_${report.id}`,
          br: contentObjects.map(o => o.br),
        },
      },
    ];
  }
  return "Not on file";
}

export function buildEntriesFromDiagnosticReport(
  report: DiagnosticReport,
  fhirBundle: Bundle
): ConcernActEntry {
  const categoryCodes = report.category?.flatMap(
    category => buildCodeCvFromCodeableConcept(category) || []
  );
  const codeCodes = report.code?.coding?.map(coding =>
    buildCodeCe({
      code: coding.code,
      codeSystem: coding.system,
      displayName: coding.display,
    })
  );

  const authorOrgs = report.performer?.flatMap(performer => {
    const orgId = performer.reference?.includes("Organization") ? performer.reference : undefined;
    if (!orgId) return [];
    return fhirBundle.entry?.map(e => e.resource).find(isOrganization) || [];
  });
  const primaryOrganization = authorOrgs?.[0];
  const author = primaryOrganization && buildAuthor(primaryOrganization);

  const practitioners = report.performer?.flatMap(performer => {
    const practitionerId = performer.reference?.includes("Practitioner")
      ? performer.reference
      : undefined;
    if (!practitionerId) return [];
    return fhirBundle.entry?.map(e => e.resource).find(isPractitioner) || [];
  });

  const primaryPractitioner = practitioners?.[0];
  const practitioner = buildResponsibleParty(primaryPractitioner);

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
      code:
        categoryCodes?.[0] ??
        codeCodes?.[0] ??
        buildCodeCe({ code: "10164-2", codeSystem: "2.16.840.1.113883.6.1" }),
      statusCode: {
        _code: mapEncounterStatusCode(report.status),
      },
      effectiveTime: withoutNullFlavorObject(
        formatDateToCdaTimestamp(report.effectiveDateTime),
        "_value"
      ),
      author,
      informant: practitioner,
    },
  };
}
