import { Attachment, CodeableConcept, DiagnosticReport } from "@medplum/fhirtypes";
import { DIAGNOSTIC_SERVICE_SECTIONS_URL } from "@metriport/shared/medical";
import { cleanUpNote } from "../../../domain/ai-brief/modify-resources";
import { base64ToString } from "../../../util/base64";
import { removeHtmlTags } from "../../html/remove-tags";

export function presentedFormsToText(report: DiagnosticReport): string[] {
  if (!report.presentedForm) return [];
  const res = report.presentedForm.flatMap(form => {
    const text = attachmentToText(form);
    if (text) return [text];
    return [];
  });
  return res;
}

/**
 * Consider:
 * - convert based on `contentType`
 * - download the attachment and convert to text?
 */
export function attachmentToText(attachment: Attachment): string | undefined {
  if (!attachment.data) return undefined;
  if (attachment.language && !attachment.language.startsWith("en")) return undefined;
  const formTextRaw = base64ToString(attachment.data);
  const text = cleanUpNote(formTextRaw);
  const extraCleanText = additionalNoteCleanup(text);
  return extraCleanText;
}

function additionalNoteCleanup(text: string): string {
  const htmlRemoved = removeHtmlTags({ contents: text });
  return htmlRemoved.replace(/\?{3,}/g, "");
}

// https://build.fhir.org/valueset-diagnostic-service-sections.html
export const DIAGNOSTIC_SERVICE_SECTIONS_CODES = [
  "AU",
  "BG",
  "BLB",
  "CG",
  "CUS",
  "CTH",
  "CT",
  "CH",
  "CP",
  "EC",
  "EN",
  "GE",
  "HM",
  "IMG",
  "ICU",
  "IMM",
  "LAB",
  "MB",
  "MCB",
  "MYC",
  "NMS",
  "NMR",
  "NRS",
  "OUS",
  "OT",
  "OTH",
  "OSL",
  "PAR",
  "PHR",
  "PAT",
  "PT",
  "PHY",
  "PF",
  "RAD",
  "RX",
  "RUS",
  "RC",
  "RT",
  "SR",
  "SP",
  "TX",
  "VUS",
  "VR",
  "URN",
  "XRC",
] as const;
export type DiagnosticServiceSectionCode = (typeof DIAGNOSTIC_SERVICE_SECTIONS_CODES)[number];

export const diagnosticServiceSectionsDisplay: Record<DiagnosticServiceSectionCode, string> = {
  AU: "Audiology",
  BG: "Blood Gases",
  BLB: "Blood Bank",
  CG: "Cytogenetics",
  CUS: "Cardiac Ultrasound",
  CTH: "Cardiac Catheterization",
  CT: "CAT Scan",
  CH: "Chemistry",
  CP: "Cytopathology",
  EC: "Electrocardiac",
  EN: "Electroneuro",
  GE: "Genetics",
  HM: "Hematology",
  IMG: "Diagnostic Imaging",
  ICU: "Bedside ICU Monitoring",
  IMM: "Immunology",
  MB: "Microbiology",
  MCB: "Mycobacteriology",
  MYC: "Mycology",
  NMS: "Nuclear Medicine Scan",
  NMR: "Nuclear Magnetic Resonance",
  NRS: "Nursing Service Measures",
  OUS: "OB Ultrasound",
  OT: "Occupational Therapy",
  OTH: "Other",
  OSL: "Outside Lab",
  PAR: "Parasitology",
  PAT: "Pathology",
  PT: "Physical Therapy",
  PHY: "Physician",
  PF: "Pulmonary Function",
  RAD: "Radiology",
  RX: "Radiograph",
  RUS: "Radiology Ultrasound",
  RC: "Respiratory Care",
  RT: "Radiation Therapy",
  SR: "Serology",
  SP: "Surgical Pathology",
  TX: "Toxicology",
  VUS: "Vascular Ultrasound",
  VR: "Virology",
  URN: "Urinalysis",
  XRC: "Cineradiograph",
  PHR: "Pharmacy",
  LAB: "Laboratory",
};

export function getDiagnosticReportCategory(code: DiagnosticServiceSectionCode): CodeableConcept {
  return {
    coding: [
      {
        system: DIAGNOSTIC_SERVICE_SECTIONS_URL,
        code,
        display: diagnosticServiceSectionsDisplay[code],
      },
    ],
  };
}
