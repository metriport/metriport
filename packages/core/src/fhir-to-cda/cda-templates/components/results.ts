import { Bundle, DiagnosticReport, Observation } from "@medplum/fhirtypes";
import {
  findResourceInBundle,
  isDiagnosticReport,
  isObservation,
} from "../../../external/fhir/shared";
import { base64ToString } from "../../../util/base64";
import { ResultsSection } from "../../cda-types/sections";
import { ObservationOrganizer } from "../../cda-types/shared-types";
import {
  buildCodeCe,
  buildCodeCvFromCodeableConcept,
  buildInstanceIdentifier,
  formatDateToCdaTimestamp,
  notOnFilePlaceholder,
  withoutNullFlavorObject,
} from "../commons";
import { extensionValue2015, oids, placeholderOrgOid } from "../constants";
import { createObservations } from "./observations";
import { notesCodingMap } from "./notes";

export function buildResult(fhirBundle: Bundle): ResultsSection {
  const resultsSection: ResultsSection = {
    templateId: buildInstanceIdentifier({
      root: oids.resultsSection,
    }),
    code: buildCodeCe({
      code: "30954-2",
      codeSystem: "2.16.840.1.113883.6.1",
      codeSystemName: "LOINC",
      displayName: "Diagnostic Results",
    }),
    title: "Diagnostic Results",
    text: notOnFilePlaceholder,
  };

  const diagnosticReports: DiagnosticReport[] =
    fhirBundle.entry?.flatMap(entry =>
      isDiagnosticReport(entry.resource) ? [entry.resource] : []
    ) || [];
  if (diagnosticReports.length === 0) {
    return resultsSection;
  }

  const resultsReports = diagnosticReports.filter(report =>
    report.code?.coding?.some(
      coding => coding.code && !Array.from(notesCodingMap.keys()).includes(coding.code)
    )
  );

  const text = getTextItemsFromDiagnosticReports(resultsReports);
  const textSection = text.flatMap(t => (t && t.item) || []);
  resultsSection.text = textSection;
  resultsSection.entry = buildEntriesFromDiagnosticReports(resultsReports, fhirBundle);

  return resultsSection;
}

function getTextItemsFromDiagnosticReports(diagnosticReports: DiagnosticReport[]) {
  return (
    diagnosticReports.flatMap(report => {
      const contentLines = report.presentedForm?.[0]?.data
        ? base64ToString(report.presentedForm[0].data).split(/\n/)
        : [];
      if (contentLines.length > 0) {
        const contentObjects = contentLines.map(line => ({
          br: line,
        }));
        return {
          item: {
            content: {
              _ID: `_${report.id}`,
              br: contentObjects.map(o => o.br),
            },
          },
        };
      }
      return undefined;
    }) || []
  );
}

function buildEntriesFromDiagnosticReports(
  diagnosticReports: DiagnosticReport[],
  fhirBundle: Bundle
): ObservationOrganizer[] {
  return diagnosticReports.map(report => {
    const codeElement = buildCodeCvFromCodeableConcept(report.code);
    const observations: Observation[] = [];
    report.result?.forEach(result => {
      if (!result.reference) {
        return;
      }
      const observation = findResourceInBundle(fhirBundle, result.reference);
      if (isObservation(observation)) {
        observations.push(observation);
      }
    });

    const organizer = {
      _classCode: "BATTERY",
      _moodCode: "EVN",
      templateId: buildInstanceIdentifier({
        root: oids.resultOrganizer,
        extension: extensionValue2015,
      }),
      id: buildInstanceIdentifier({
        root: placeholderOrgOid,
        extension: report.id,
      }),
      code: codeElement,
      statusCode: buildCodeCe({
        code: report.status,
      }),
      effectiveTime: withoutNullFlavorObject(
        formatDateToCdaTimestamp(report.effectiveDateTime),
        "_value"
      ),
      component: createObservations(observations).map(o => o.component),
    };

    return {
      _typeCode: "DRIV",
      organizer,
    };
  });
}
