import { DiagnosticReport } from "@medplum/fhirtypes";
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
    const parts: string[] = [];
    let hasRelevantData = false;

    // Add identifier
    const identifierStr = formatIdentifiers(report.identifier);
    if (identifierStr) {
      parts.push(identifierStr);
    }

    // Add status
    if (report.status) {
      const status = checkDeny(report.status);
      if (status) {
        parts.push(`Status: ${status}`);
      }
    }

    // Add category
    const categoryStr = formatCodeableConcepts(report.category, "Category");
    if (categoryStr) {
      parts.push(categoryStr);
      hasRelevantData = true;
    }

    // Add code
    if (report.code) {
      const codeStr = formatCodeableConcepts([report.code], "Code");
      if (codeStr) {
        parts.push(codeStr);
        hasRelevantData = true;
      }
    }

    // Add effective time
    if (report.effectiveDateTime) {
      parts.push(`Effective: ${report.effectiveDateTime}`);
    } else if (report.effectivePeriod) {
      const start = report.effectivePeriod.start ?? "unknown";
      const end = report.effectivePeriod.end ?? "ongoing";
      parts.push(`Effective: ${start} to ${end}`);
    }

    // Add issued
    if (report.issued) {
      parts.push(`Issued: ${report.issued}`);
    }

    // Add performer
    const performerStr = formatReferences(report.performer, "Performer");
    if (performerStr) {
      parts.push(performerStr);
    }

    // Add results interpreter
    const interpreterStr = formatReferences(report.resultsInterpreter, "Interpreter");
    if (interpreterStr) {
      parts.push(interpreterStr);
    }

    // Add specimen
    const specimenStr = formatReferences(report.specimen, "Specimen");
    if (specimenStr) {
      parts.push(specimenStr);
    }

    // Add result
    const resultStr = formatReferences(report.result, "Result");
    if (resultStr) {
      parts.push(resultStr);
    }

    if (!hasRelevantData) return undefined;

    return parts.join(FIELD_SEPARATOR);
  }
}
