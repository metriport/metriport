import { Bundle, DiagnosticReport, Observation } from "@medplum/fhirtypes";
import {
  findResourceInBundle,
  isDiagnosticReport,
  isObservation,
} from "../../../external/fhir/shared";
import { base64ToString } from "../../../util/base64";
import {
  TIMESTAMP_CLEANUP_REGEX,
  buildCodeCe,
  buildCodeCvFromCodeableConcept,
  buildInstanceIdentifier,
  withoutNullFlavorObject,
} from "../commons";
import {
  _classCodeAttribute,
  _idAttribute,
  _moodCodeAttribute,
  _typeCodeAttribute,
  _valueAttribute,
  extensionValue2015,
  oids,
  placeholderOrgOid,
} from "../constants";
import { createObservations } from "./observations";

function buildEntriesFromDiagnosticReports(
  diagnosticReports: DiagnosticReport[],
  fhirBundle: Bundle
) {
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
      [_classCodeAttribute]: "BATTERY",
      [_moodCodeAttribute]: "EVN",
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
        report.effectiveDateTime?.replace(TIMESTAMP_CLEANUP_REGEX, ""),
        _valueAttribute
      ),
      component: createObservations(observations).map(o => o.component),
    };

    return {
      entry: {
        [_typeCodeAttribute]: "DRIV",
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
    text: text.map(t => t && t.item),
    entry: buildEntriesFromDiagnosticReports(diagnosticReports, fhirBundle).map(e => e.entry),
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
              [_idAttribute]: `_${report.id}`,
              br: contentObjects.map(o => o.br),
            },
          },
        };
      }
      return undefined;
    }) || []
  );
}
