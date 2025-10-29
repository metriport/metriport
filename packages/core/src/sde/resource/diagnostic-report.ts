import { DiagnosticReport, Extension, Meta, Reference } from "@medplum/fhirtypes";
import { findDocIdExtension } from "../../external/fhir/shared/extensions/doc-id-extension";

export interface DiagnosticReportParams {
  subject: NonNullable<DiagnosticReport["subject"]>;
  performer: NonNullable<DiagnosticReport["performer"]>;
  extractedFrom: Reference<DiagnosticReport>;
  meta?: Meta | undefined;
  docIdExtension?: Extension | undefined;
  effectiveDateTime: string;
}

export function getDiagnosticReportParams(
  diagnosticReport: DiagnosticReport
): DiagnosticReportParams | undefined {
  if (!diagnosticReport.subject || !diagnosticReport.performer) {
    return undefined;
  }
  const subject = diagnosticReport.subject;
  const performer = diagnosticReport.performer;
  const effectiveDateTime =
    diagnosticReport.effectiveDateTime ?? diagnosticReport.effectivePeriod?.start;
  if (!effectiveDateTime) return undefined;

  const docIdExtension = findDocIdExtension(diagnosticReport.extension ?? []);

  return {
    subject,
    performer,
    effectiveDateTime,
    docIdExtension,
    meta: diagnosticReport.meta,
    extractedFrom: createDiagnosticReportReference(diagnosticReport),
  };
}

export function createDiagnosticReportReference(
  diagnosticReport: DiagnosticReport
): Reference<DiagnosticReport> {
  return {
    reference: "DiagnosticReport/" + diagnosticReport.id,
  };
}
