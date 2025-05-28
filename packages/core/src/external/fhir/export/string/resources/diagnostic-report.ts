import { DiagnosticReport } from "@medplum/fhirtypes";
import { presentedFormsToText } from "../../../resources/diagnostic-report";
import { defaultHasMinimumData, FHIRResourceToString } from "../fhir-resource-to-string";
import { formatCodeableConcepts } from "../shared/codeable-concept";
import { emptyIfDenied } from "../shared/deny";
import { formatIdentifiers } from "../shared/identifier";
import { formatNarrative } from "../shared/narrative";
import { formatPeriod } from "../shared/period";
import { formatReferences } from "../shared/reference";
import { FIELD_SEPARATOR } from "../shared/separator";

/**
 * Converts a FHIR DiagnosticReport resource to a string representation
 */
export class DiagnosticReportToString implements FHIRResourceToString<DiagnosticReport> {
  toString(report: DiagnosticReport, isDebug?: boolean): string | undefined {
    let hasMinimumData = defaultHasMinimumData;
    const parts: string[] = [];

    const identifierStr = formatIdentifiers({ identifiers: report.identifier });
    if (identifierStr) parts.push(identifierStr);

    // if (report.basedOn) {
    //   const basedOnStr = formatReferences(report.basedOn, "Based On");
    //   if (basedOnStr) parts.push(basedOnStr);
    // }

    if (report.status) {
      const status = emptyIfDenied(report.status);
      if (status) parts.push(isDebug ? `Status: ${status}` : status);
    }

    const categoryStr = formatCodeableConcepts({
      concepts: report.category,
      label: "Category",
      isDebug,
    });
    if (categoryStr) parts.push(categoryStr);

    if (report.code) {
      const codeStr = formatCodeableConcepts({ concepts: [report.code], label: "Code", isDebug });
      if (codeStr) {
        parts.push(codeStr);
        hasMinimumData = true;
      }
    }

    // if (report.subject) {
    //   const subjectStr = formatReferences([report.subject], "Subject");
    //   if (subjectStr) {
    //     parts.push(subjectStr);
    //     hasMinimumData = true;
    //   }
    // }

    // if (report.encounter) {
    //   const encounterStr = formatReferences([report.encounter], "Encounter");
    //   if (encounterStr) parts.push(encounterStr);
    // }

    if (report.effectiveDateTime) {
      parts.push(
        isDebug ? `Effective Date: ${report.effectiveDateTime}` : report.effectiveDateTime
      );
    } else if (report.effectivePeriod) {
      const periodStr = formatPeriod({
        period: report.effectivePeriod,
        label: "Effective Period",
        isDebug,
      });
      if (periodStr) parts.push(periodStr);
    }

    if (report.issued) parts.push(isDebug ? `Issued: ${report.issued}` : report.issued);

    const studyStr = formatReferences({
      references: report.imagingStudy,
      label: "Imaging Study",
      isDebug,
    });
    if (studyStr) parts.push(studyStr);

    // if (report.media) {
    //   const media = report.media
    //     .map((m: DiagnosticReportMedia) => {
    //       const components = [
    //         m.comment && `Comment: ${m.comment}`,
    //         m.link && formatReferences({ references: [m.link], label: "Link", isDebug }),
    //       ].filter(Boolean);
    //       return components.join(FIELD_SEPARATOR);
    //     })
    //     .filter(Boolean);

    //   if (media.length > 0) {
    //     parts.push(`Media: ${media.join(FIELD_SEPARATOR)}`);
    //   }
    // }

    const performerStr = formatReferences({
      references: report.performer,
      label: "Performer",
      isDebug,
    });
    if (performerStr) parts.push(performerStr);

    const interpreterStr = formatReferences({
      references: report.resultsInterpreter,
      label: "Interpreter",
      isDebug,
    });
    if (interpreterStr) parts.push(interpreterStr);

    const specimenStr = formatReferences({
      references: report.specimen,
      label: "Specimen",
      isDebug,
    });
    if (specimenStr) parts.push(specimenStr);

    const presentedFormsAsText = presentedFormsToText(report);
    if (presentedFormsAsText.length > 0) {
      let idx = 0;
      for (const text of presentedFormsAsText) {
        parts.push(isDebug ? `Presented Form ${++idx}: ${singleLine(text)}` : singleLine(text));
        hasMinimumData = true;
      }
    }

    if (report.conclusion) {
      parts.push(isDebug ? `Conclusion: ${report.conclusion}` : report.conclusion);
      hasMinimumData = true;
    }

    if (report.conclusionCode) {
      const codeStr = formatCodeableConcepts({
        concepts: report.conclusionCode,
        label: "Conclusion Code",
        isDebug,
      });
      if (codeStr) parts.push(codeStr);
    }

    const textStr = formatNarrative({ narrative: report.text, label: "Text", isDebug });
    if (textStr) parts.push(textStr);

    const resultStr = formatReferences({
      references: report.result,
      label: "Result",
      isDebug,
    });
    if (resultStr) parts.push(resultStr);

    if (!hasMinimumData) return undefined;

    return parts.join(FIELD_SEPARATOR);
  }
}

function singleLine(text: string): string {
  return text.replace(/\n/g, " ").trim();
}
