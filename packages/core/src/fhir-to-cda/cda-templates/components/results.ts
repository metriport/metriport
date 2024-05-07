import { Bundle, DiagnosticReport, Observation } from "@medplum/fhirtypes";
import { base64ToString } from "../../../util/base64";
import { findResourceInBundle, isDiagnosticReport, isObservation } from "../../fhir";
import {
  TIMESTAMP_CLEANUP_REGEX,
  buildCodeCE,
  buildCodeCVFromCodeableConcept,
  buildInstanceIdentifier,
  withoutNullFlavorObject,
} from "../commons";
import {
  classCodeAttribute,
  extensionValue2015,
  idAttribute,
  moodCodeAttribute,
  placeholderOrgOid,
  typeCodeAttribute,
  valueAttribute,
} from "../constants";
import { buildObservations } from "./observations";

function buildEntriesFromDiagnosticReports(
  diagnosticReports: DiagnosticReport[],
  fhirBundle: Bundle
) {
  return diagnosticReports.map(report => {
    const codeElement = buildCodeCVFromCodeableConcept(report.code);
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
      [classCodeAttribute]: "BATTERY",
      [moodCodeAttribute]: "EVN",
      templateId: buildInstanceIdentifier({
        root: "2.16.840.1.113883.10.20.22.4.1",
        extension: extensionValue2015,
      }),
      id: buildInstanceIdentifier({
        root: placeholderOrgOid,
        extension: report.id,
      }),
      code: codeElement,
      statusCode: buildCodeCE({
        code: report.status,
      }),
      effectiveTime: withoutNullFlavorObject(
        report.effectiveDateTime?.replace(TIMESTAMP_CLEANUP_REGEX, ""),
        valueAttribute
      ),
      component: buildObservations(observations).map(o => o.component),
    };

    return {
      entry: {
        [typeCodeAttribute]: "DRIV",
        organizer,
      },
    };
  });
}

export function buildResult(fhirBundle: Bundle) {
  const diagnosticReports: DiagnosticReport[] =
    fhirBundle.entry?.flatMap(entry =>
      isDiagnosticReport(entry.resource) ? [entry.resource] : []
    ) || [];
  if (diagnosticReports.length === 0) {
    return undefined;
  }
  const text = getTextItemsFromDiagnosticReports(diagnosticReports);

  const resultsSection = {
    component: {
      section: {
        templateId: buildInstanceIdentifier({
          root: "2.16.840.1.113883.10.20.22.2.3.1",
        }),
        code: buildCodeCE({
          code: "30954-2",
          codeSystem: "2.16.840.1.113883.6.1",
          codeSystemName: "LOINC",
          displayName: "Diagnostic Results",
        }),
        title: "Diagnostic Results",
        text: text.map(t => t && t.item),
        entry: buildEntriesFromDiagnosticReports(diagnosticReports, fhirBundle).map(e => e.entry),
      },
    },
  };
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
              [idAttribute]: `_${report.id}`,
              br: contentObjects.map(o => o.br),
            },
          },
        };
      }
      return undefined;
    }) || []
  );
}
