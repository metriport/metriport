import { Attachment, DiagnosticReport } from "@medplum/fhirtypes";
import { base64ToString } from "@metriport/shared/util";

// If a note is more than 200 characters, it's likely not a useless note.
const NOTE_FILTERING_MIN_LENGTH = 200;

const uselessTextIndicators = [
  "not on file",
  "no data found",
  "no information",
  "no data available",
  "no results",
  "this patient has no known assessments",
  "no assessment recorded",
  "no past plan information found",
  "no current plan information found",
];

export function normalizeDiagnosticReports(diagReports: DiagnosticReport[]): DiagnosticReport[] {
  return diagReports.map(diagReport => {
    const presentedForms = diagReport.presentedForm;
    if (presentedForms) {
      const filteredPresentedForms = presentedForms.filter(isNotUselessNote);
      return { ...diagReport, presentedForm: filteredPresentedForms };
    }

    return diagReport;
  });
}

function isNotUselessNote(presentedForm: Attachment): boolean {
  if (presentedForm.data) {
    const text = base64ToString(presentedForm.data);
    return text.length >= NOTE_FILTERING_MIN_LENGTH || !isUselessText(text);
  }
  return false;
}

function isUselessText(text: string): boolean {
  return uselessTextIndicators.some(indicator => text.toLowerCase().includes(indicator));
}
