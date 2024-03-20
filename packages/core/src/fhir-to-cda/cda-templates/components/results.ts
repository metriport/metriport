import { Bundle, DiagnosticReport, Observation } from "@medplum/fhirtypes";
import {
  withoutNullFlavorObject,
  withNullFlavor,
  buildCodeCVFromCodeableConcept,
  buildCodeCE,
  buildInstanceIdentifier,
} from "../commons";
import { base64ToString } from "../../../util/base64";
import {
  valueAttribute,
  styleCodeAttribute,
  classCodeAttribute,
  moodCodeAttribute,
  typeCodeAttribute,
  idAttribute,
} from "../constants";
import { buildObservations } from "./observations";
import { findResourceInBundle, isObservation, isDiagnosticReport } from "../../fhir";

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

    return {
      entry: {
        [typeCodeAttribute]: "DRIV",
        organizer: {
          [classCodeAttribute]: "BATTERY",
          [moodCodeAttribute]: "EVN",
          templateId: buildInstanceIdentifier({
            root: "2.16.840.1.113883.10.20.22.4.1",
            extension: "2015-08-01",
          }),
          id: buildInstanceIdentifier({
            root: report.id,
          }),
          code: codeElement,
          statusCode: buildCodeCE({
            code: report.status,
          }),
          effectiveTime: withoutNullFlavorObject(
            report.effectiveDateTime?.replace(/-|:|\.\d+Z$/g, ""),
            valueAttribute
          ),
          text: {
            reference: withNullFlavor(report.id, valueAttribute),
          },
          component: buildObservations(observations).map(o => o.component),
        },
      },
    };
  });
}

export function buildResult(fhirBundle: Bundle): unknown {
  const diagnosticReports: DiagnosticReport[] =
    fhirBundle.entry?.flatMap(entry =>
      isDiagnosticReport(entry.resource) ? [entry.resource] : []
    ) || [];
  if (diagnosticReports.length === 0) {
    return undefined;
  }
  const items = diagnosticReports
    .map(report => {
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
              [idAttribute]: report.id,
              br: contentObjects.map(o => o.br),
            },
          },
        };
      }
      return undefined;
    })
    .filter(item => item !== undefined);

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
        text: {
          list: {
            [styleCodeAttribute]: "xTOC",
            item: items.map(item => item?.item),
          },
        },
        entry: buildEntriesFromDiagnosticReports(diagnosticReports, fhirBundle).map(e => e.entry),
      },
    },
  };
  return resultsSection;
}
