import { Bundle, DiagnosticReport } from "@medplum/fhirtypes";
import {
  withNullFlavorObject,
  buildCodeCVFromCodeableConcept,
  buildCodeCE,
  buildInstanceIdentifier,
} from "../commons";
import { base64ToString } from "../../../util/base64";

function buildEntriesFromDiagnosticReports(diagnosticReports: DiagnosticReport[]) {
  return diagnosticReports.map(report => {
    const codeElement = buildCodeCVFromCodeableConcept(report.code);

    return {
      entry: {
        "@_typeCode": "DRIV",
        organizer: {
          "@_classCode": "BATTERY",
          "@_moodCode": "EVN",
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
          effectiveTime: withNullFlavorObject(
            report.effectiveDateTime?.replace(/-|:|\.\d+Z$/g, ""),
            "@_value"
          ),
          text: {
            reference: {
              "@_value": report.id,
            },
          },
        },
      },
    };
  });
}

export function buildResult(fhirBundle: Bundle): unknown {
  const diagnosticReports = fhirBundle.entry
    ?.filter(
      (entry): entry is { resource: DiagnosticReport } =>
        entry.resource?.resourceType === "DiagnosticReport"
    )
    .map(entry => entry.resource as DiagnosticReport);

  if (!diagnosticReports || diagnosticReports.length === 0) {
    return undefined;
  }
  const items = diagnosticReports
    .map(report => {
      const content = report.presentedForm?.[0]?.data
        ? base64ToString(report.presentedForm[0].data)
        : undefined;
      if (content) {
        return {
          item: {
            content: {
              "@_ID": report.id,
              "#text": content,
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
            "@_styleCode": "xTOC",
            item: items.map(item => item.item),
          },
        },
        entry: buildEntriesFromDiagnosticReports(diagnosticReports).map(e => e.entry),
      },
    },
  };
  return resultsSection;
}
