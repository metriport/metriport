import { DiagnosticReport } from "@medplum/fhirtypes";
import { presentedFormsToText } from "../../../resources/diagnostic-report";
import { formatCodeableConcepts } from "../shared/codeable-concept";
import { checkDeny } from "../shared/deny";
import { formatIdentifiers } from "../shared/identifier";
import { formatReferences } from "../shared/reference";
import { FIELD_SEPARATOR } from "../shared/separator";
import { FHIRResourceToString } from "../types";

/**
 * Converts a FHIR DiagnosticReport resource to a string representation
 */
export class DiagnosticReportToString implements FHIRResourceToString<DiagnosticReport> {
  toString(report: DiagnosticReport): string | undefined {
    let hasRelevantData = false;
    const parts: string[] = [];

    const identifierStr = formatIdentifiers(report.identifier);
    if (identifierStr) parts.push(identifierStr);

    if (report.status) {
      const status = checkDeny(report.status);
      if (status) parts.push(`Status: ${status}`);
    }

    const categoryStr = formatCodeableConcepts(report.category, "Category");
    if (categoryStr) parts.push(categoryStr);

    if (report.code) {
      const codeStr = formatCodeableConcepts([report.code], "Code");
      if (codeStr) {
        parts.push(codeStr);
        hasRelevantData = true;
      }
    }

    if (report.effectiveDateTime) {
      parts.push(`Effective: ${report.effectiveDateTime}`);
    } else if (report.effectivePeriod) {
      const start = report.effectivePeriod.start ?? "unknown";
      const end = report.effectivePeriod.end ?? "ongoing";
      parts.push(`Effective: ${start} to ${end}`);
    }

    if (report.issued) parts.push(`Issued: ${report.issued}`);

    const presentedFormsAsText = presentedFormsToText(report);
    if (presentedFormsAsText.length > 0) {
      let idx = 0;
      for (const text of presentedFormsAsText) {
        parts.push(`Presented Form ${++idx}: ${singleLine(text)}`);
        hasRelevantData = true;
      }
    }

    if (report.conclusion) {
      parts.push(`Conclusion: ${report.conclusion}`);
      hasRelevantData = true;
    }

    const performerStr = formatReferences(report.performer, "Performer");
    if (performerStr) parts.push(performerStr);

    const interpreterStr = formatReferences(report.resultsInterpreter, "Interpreter");
    if (interpreterStr) parts.push(interpreterStr);

    const specimenStr = formatReferences(report.specimen, "Specimen");
    if (specimenStr) parts.push(specimenStr);

    const resultStr = formatReferences(report.result, "Result");
    if (resultStr) parts.push(resultStr);

    if (!hasRelevantData) return undefined;

    return parts.join(FIELD_SEPARATOR);
  }
}

function singleLine(text: string): string {
  return text.replace(/\n/g, " ").trim();
}
