import { DiagnosticReport, Reference } from "@medplum/fhirtypes";

export interface DiagnosticReportParams {
  subject: NonNullable<DiagnosticReport["subject"]>;
  performer: NonNullable<DiagnosticReport["performer"]>;
  extractedFrom: Reference<DiagnosticReport>;
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

  return {
    subject,
    performer,
    effectiveDateTime,
    extractedFrom: createDiagnosticReportReference(diagnosticReport),
  };
}

function createDiagnosticReportReference(
  diagnosticReport: DiagnosticReport
): Reference<DiagnosticReport> {
  return {
    reference: "DiagnosticReport/" + diagnosticReport.id,
  };
}
