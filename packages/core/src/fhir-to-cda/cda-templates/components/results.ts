import { Bundle, DiagnosticReport, CodeableConcept } from "@medplum/fhirtypes";
import { withNullFlavor, withNullFlavorObject } from "../utils";
import { base64ToString } from "../../../util/base64";

function convertCodeableConceptToCDA(codeableConcept: CodeableConcept | undefined) {
  // Provide a default empty object if codeableConcept is undefined

  if (!codeableConcept) {
    return withNullFlavor(codeableConcept);
  }
  const codeElement = {
    "@_codeSystem": codeableConcept.coding?.[0]?.system,
    "@_code": codeableConcept.coding?.[0]?.code,
    originalText: codeableConcept.text,
    translation: codeableConcept.coding?.slice(1).map(coding => ({
      "@_code": coding.code,
      "@_codeSystem": coding.system,
      "@_displayName": coding.display,
    })),
  };

  return codeElement;
}

function constructEntriesFromDiagnosticReports(diagnosticReports: DiagnosticReport[]) {
  return diagnosticReports.map(report => {
    const codeElement = convertCodeableConceptToCDA(report.code);

    return {
      entry: {
        "@_typeCode": "DRIV",
        organizer: {
          "@_classCode": "BATTERY",
          "@_moodCode": "EVN",
          templateId: [
            { "@_root": "2.16.840.1.113883.10.20.22.4.1" },
            { "@_root": "2.16.840.1.113883.10.20.22.4.1", "@_extension": "2015-08-01" },
          ],
          id: {
            "@_root": "1.2.840.114350.1.13.104.2.7.2.798268",
            "@_extension": "225981285",
          },
          code: codeElement,
          statusCode: withNullFlavorObject(report.status, "@_code"),
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

export function constructResult(fhirBundle: Bundle): unknown {
  const diagnosticReports = fhirBundle.entry
    ?.filter(
      (entry): entry is { resource: DiagnosticReport } =>
        entry.resource?.resourceType === "DiagnosticReport"
    )
    .map(entry => entry.resource as DiagnosticReport);

  if (!diagnosticReports || diagnosticReports.length === 0) {
    return null;
  }
  const items = diagnosticReports?.map(report => {
    const content = report.presentedForm?.[0]?.data
      ? base64ToString(report.presentedForm[0].data)
      : "";
    return {
      item: {
        content: {
          "@_ID": report.id,
          "#text": content,
        },
      },
    };
  });

  const resultsSection = {
    component: {
      section: {
        templateId: { "@_root": "2.16.840.1.113883.10.20.22.2.3.1" },
        code: {
          "@_code": "30954-2",
          "@_codeSystem": "2.16.840.1.113883.6.1",
          "@_codeSystemName": "LOINC",
          "@_displayName": "Diagnostic Results",
        },
        title: "Diagnostic Results",
        text: {
          list: {
            "@_styleCode": "xTOC",
            item: items.map(item => item.item),
          },
        },
        entry: constructEntriesFromDiagnosticReports(diagnosticReports).map(e => e.entry),
      },
    },
  };
  return resultsSection;
}
