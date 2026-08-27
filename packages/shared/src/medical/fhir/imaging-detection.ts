import {
  DiagnosticReport,
  Encounter,
  Organization,
  Practitioner,
  Procedure,
  Reference,
  Composition,
  DocumentReference,
} from "@medplum/fhirtypes";
import { CPT_URL } from "./constants";
import { getLoincCodeClass, isLoincCoding } from "./coding";
import { PROCEDURE_TYPE_RANGES } from "./procedure-type";

type ProcedureReportRef = Reference<Composition | DiagnosticReport | DocumentReference>;
/**
 * Imaging procedure ranges - filtered from PROCEDURE_TYPE_RANGES where modality exists
 */
export const IMAGING_PROCEDURE_RANGES = PROCEDURE_TYPE_RANGES.filter(
  (range): range is typeof range & { modality: string } => "modality" in range && !!range.modality
);

/**
 * Check if a CPT code is in the imaging range
 */
export function isImagingCptCode(cptCode: string): boolean {
  const numericCode = parseInt(cptCode, 10);
  if (isNaN(numericCode)) return false;
  return IMAGING_PROCEDURE_RANGES.some(
    range => numericCode >= range.start && numericCode <= range.end
  );
}

/**
 * Check if a Procedure is an imaging procedure based on CPT codes
 */
function isImagingProcedure(procedure: Procedure): boolean {
  if (!procedure.code?.coding) return false;
  for (const c of procedure.code.coding) {
    const isImaging = c.system === CPT_URL && c.code && isImagingCptCode(c.code);
    if (isImaging) return true;
  }
  return false;
}

function isReferenceDiagnosticReport(
  reference?: ProcedureReportRef
): reference is Reference<DiagnosticReport> {
  if (!reference) return false;
  return (
    reference.type === "DiagnosticReport" || !!reference.reference?.startsWith("DiagnosticReport/")
  );
}

/**
 * Extract ID from a reference
 */
function getReferenceId(reference: Reference<DiagnosticReport>): string {
  return reference.id || reference.reference?.split("/").pop() || "";
}

/**
 * Get set of DiagnosticReport IDs that are linked to imaging Procedures
 * This is the PRIMARY method for identifying imaging reports
 */
export function getImagingReportIdsFromProcedures(procedures: Procedure[]): Set<string> {
  if (procedures.length === 0) return new Set();
  return new Set(
    procedures
      .filter(isImagingProcedure)
      .flatMap(p => p.report ?? [])
      .filter(isReferenceDiagnosticReport)
      .map(getReferenceId)
      .filter(id => id.length > 0)
  );
}

// LOINC codes for specific imaging types
const ECHO_LOINC_CODES = [
  "59282-4", // Cardiac stress echo study
  "34552-0", // Cardiac 2D echo panel
  "18010-9", // Aorta Diameter by US
  "85475-2", // US Heart Transesophageal
  "18106-5", // Cardiac echo study Procedure
];

const PFT_LOINC_CODES = [
  "52485-0", // Pulmonary Function Tests
  "81459-0", // Spirometry panel
  "20080-8", // Pulmonary function test method
  "81458-2", // Pulmonary function test panel
];

const CT_LOINC_CODES = [
  "46305-9", // CT Whole body
  "24725-4", // CT Head
  "24627-2", // CT Chest
  "24727-0", // CT Head W contrast IV
  "41806-1", // CT Abdomen
  "29252-4", // CT Chest WO contrast
  "30799-1", // CT Head WO contrast
];

const MRI_LOINC_CODES = [
  "30657-1", // MR Brain WO contrast
  "30794-2", // MR Breast
  "36046-1", // MR Liver
  "24589-4", // MR Brain W contrast IV
  "24557-1", // MR Abdomen WO and W contrast IV
  "24587-8", // MR Brain WO and W contrast IV
  "24556-3", // MR Abdomen
];

const XR_LOINC_CODES = [
  "24722-1", // XR Hand 3 Views
  "24799-9", // XR Abdomen AP
  "36643-5", // XR Chest 2 Views
  "22030-1", // Xray/Scan.total Narrative
  "24664-5", // XR Clavicle Views
  "37616-0", // XR Pelvis Single view
];

const US_LOINC_CODES = [
  "55034-6", // US Abdomen
  "24531-6", // US Retroperitoneum
  "34813-6", // US Kidney
  "59640-3", // US Pelvis Transvaginal
  "46298-6", // US Breast
  "24857-5", // US Thyroid
];

/**
 * Check if a report is an Echocardiogram imaging report
 */
function isEchoImagingReport(report: DiagnosticReport): boolean {
  const codings = report.code?.coding ?? [];
  function includesEchoInName(s: string): boolean {
    const lower = s.toLowerCase();
    return lower.includes("echo") || lower.includes("echocardiogram");
  }
  const hasEchoInName = codings.some(
    coding => coding.display && includesEchoInName(coding.display)
  );
  const isEchoLoincCode = codings.some(
    coding => coding.code && ECHO_LOINC_CODES.includes(coding.code)
  );
  return hasEchoInName || isEchoLoincCode;
}

/**
 * Check if a report is a PFT (Pulmonary Function Test) imaging report
 */
function isPFTImagingReport(report: DiagnosticReport): boolean {
  const codings = report.code?.coding ?? [];
  function includesPftInName(s: string): boolean {
    const lower = s.toLowerCase();
    return lower.includes("pulmonary") || lower.includes("spirometry") || lower.includes("pft");
  }
  const hasPftInName = codings.some(coding => coding.display && includesPftInName(coding.display));
  const isPftLoincCode = codings.some(
    coding => coding.code && PFT_LOINC_CODES.includes(coding.code)
  );
  return hasPftInName || isPftLoincCode;
}

/**
 * Check if a report is a CT (Computed Tomography) imaging report
 */
function isCTImagingReport(report: DiagnosticReport): boolean {
  const codings = report.code?.coding ?? [];
  function includesCtInName(s: string): boolean {
    return s.toLowerCase().startsWith("ct ") || s.toLowerCase().includes(" ct ");
  }
  const hasCtInName = codings.some(coding => coding.display && includesCtInName(coding.display));
  const isCtLoincCode = codings.some(coding => coding.code && CT_LOINC_CODES.includes(coding.code));
  return hasCtInName || isCtLoincCode;
}

/**
 * Check if a report is an MRI (Magnetic Resonance Imaging) report
 */
function isMRIImagingReport(report: DiagnosticReport): boolean {
  const codings = report.code?.coding ?? [];
  function includesMriInName(s: string): boolean {
    return (
      s.toLowerCase().startsWith("mr ") ||
      s.toLowerCase().includes(" mr ") ||
      s.toLowerCase().includes("mri")
    );
  }
  const hasMriInName = codings.some(coding => coding.display && includesMriInName(coding.display));
  const isMriLoincCode = codings.some(
    coding => coding.code && MRI_LOINC_CODES.includes(coding.code)
  );
  return hasMriInName || isMriLoincCode;
}

/**
 * Check if a report is an XR (X-Ray) imaging report
 */
function isXRImagingReport(report: DiagnosticReport): boolean {
  const codings = report.code?.coding ?? [];
  function includesXrInName(s: string): boolean {
    return s.toLowerCase().startsWith("xr ") || s.toLowerCase().includes(" xr ");
  }
  const hasXrInName = codings.some(coding => coding.display && includesXrInName(coding.display));
  const isXrLoincCode = codings.some(coding => coding.code && XR_LOINC_CODES.includes(coding.code));
  return hasXrInName || isXrLoincCode;
}

/**
 * Check if a report is an Ultrasound imaging report
 */
function isUltrasoundImagingReport(report: DiagnosticReport): boolean {
  const codings = report.code?.coding ?? [];
  function includesUsInName(s: string): boolean {
    return (
      s.toLowerCase().startsWith("us ") ||
      s.toLowerCase().includes(" us ") ||
      s.toLowerCase().startsWith("us-") ||
      s.toLowerCase().includes("ultrasound")
    );
  }
  const hasUsInName = codings.some(coding => coding.display && includesUsInName(coding.display));
  const isUsLoincCode = codings.some(coding => coding.code && US_LOINC_CODES.includes(coding.code));
  return hasUsInName || isUsLoincCode;
}

/**
 * Check if a report is an imaging report based on display value parsing
 * This is a fallback for when the report is not categorized by a LOINC code
 */
export function isImagingReportBasedOnDisplayValueParsing(report: DiagnosticReport): boolean {
  return (
    isEchoImagingReport(report) ||
    isPFTImagingReport(report) ||
    isCTImagingReport(report) ||
    isMRIImagingReport(report) ||
    isXRImagingReport(report) ||
    isUltrasoundImagingReport(report)
  );
}

export type ImagingDetectionContext = {
  practitioners: Practitioner[];
  organizations: Organization[];
  encounters: Encounter[];
};

/**
 * Get practitioners referenced by a DiagnosticReport
 */
function getReportPractitioners(
  report: DiagnosticReport,
  practitionerMap: Map<string, Practitioner>
): Practitioner[] {
  const practitioners: Practitioner[] = [];
  for (const performer of report.performer ?? []) {
    if (performer.reference?.startsWith("Practitioner/")) {
      const id = performer.reference.split("/")[1];
      const practitioner = id ? practitionerMap.get(id) : undefined;
      if (practitioner) practitioners.push(practitioner);
    }
  }
  return practitioners;
}

/**
 * Get organizations referenced by a DiagnosticReport
 */
function getReportOrganizations(
  report: DiagnosticReport,
  organizationMap: Map<string, Organization>
): Organization[] {
  const organizations: Organization[] = [];
  for (const performer of report.performer ?? []) {
    if (performer.reference?.startsWith("Organization/")) {
      const id = performer.reference.split("/")[1];
      const organization = id ? organizationMap.get(id) : undefined;
      if (organization) organizations.push(organization);
    }
  }
  return organizations;
}

/**
 * Get practitioners from an Encounter
 */
function getEncounterPractitioners(
  encounter: Encounter,
  practitionerMap: Map<string, Practitioner>
): Practitioner[] {
  const practitioners: Practitioner[] = [];
  for (const participant of encounter.participant ?? []) {
    if (participant.individual?.reference?.startsWith("Practitioner/")) {
      const id = participant.individual.reference.split("/")[1];
      const practitioner = id ? practitionerMap.get(id) : undefined;
      if (practitioner) practitioners.push(practitioner);
    }
  }
  return practitioners;
}

/**
 * Get organizations from an Encounter
 */
function getEncounterOrganizations(
  encounter: Encounter,
  organizationMap: Map<string, Organization>
): Organization[] {
  const organizations: Organization[] = [];
  if (encounter.serviceProvider?.reference?.startsWith("Organization/")) {
    const id = encounter.serviceProvider.reference.split("/")[1];
    const organization = id ? organizationMap.get(id) : undefined;
    if (organization) organizations.push(organization);
  }
  return organizations;
}

type PrecomputedMaps = {
  practitionerMap: Map<string, Practitioner>;
  organizationMap: Map<string, Organization>;
  encounterMap: Map<string, Encounter>;
};

function buildContextMaps(context: ImagingDetectionContext): PrecomputedMaps {
  const practitionerMap = new Map<string, Practitioner>();
  for (const p of context.practitioners) {
    if (p.id) practitionerMap.set(p.id, p);
  }

  const organizationMap = new Map<string, Organization>();
  for (const o of context.organizations) {
    if (o.id) organizationMap.set(o.id, o);
  }

  const encounterMap = new Map<string, Encounter>();
  for (const e of context.encounters) {
    if (e.id) encounterMap.set(e.id, e);
  }

  return { practitionerMap, organizationMap, encounterMap };
}

/**
 * Main function to determine if a DiagnosticReport is an imaging report
 * This is the primary logic used to split DiagnosticReports into Imaging vs Clinical Notes
 */
export function isImagingReport(
  report: DiagnosticReport,
  imagingReportIds: Set<string>,
  context: ImagingDetectionContext,
  maps?: PrecomputedMaps
): boolean {
  // 1. Check if report ID is in the set of imaging report IDs (from Procedures)
  if (report.id && imagingReportIds.has(report.id)) {
    return true;
  }

  // 2. Check LOINC code class - if abbreviation is "RAD" (Radiology)
  const loincCoding = report.code?.coding?.find(isLoincCoding);
  if (loincCoding && loincCoding.code) {
    const loincClass = getLoincCodeClass(loincCoding.code);
    if (loincClass?.abbreviation === "RAD") {
      return true;
    }
  }

  // 3. Check display value parsing (fallback for uncategorized reports)
  if (isImagingReportBasedOnDisplayValueParsing(report)) {
    return true;
  }

  const { practitionerMap, organizationMap, encounterMap } = maps ?? buildContextMaps(context);

  // Get the encounter for the report
  const encounterId = report.encounter?.reference?.split("/").pop();
  const encounter = encounterId ? encounterMap.get(encounterId) : undefined;

  // 4. Check practitioner qualifications
  const reportPractitioners = getReportPractitioners(report, practitionerMap);
  const encounterPractitioners = encounter
    ? getEncounterPractitioners(encounter, practitionerMap)
    : [];
  const allPractitioners = [...reportPractitioners, ...encounterPractitioners];

  for (const practitioner of allPractitioners) {
    if (practitioner.qualification) {
      for (const qualification of practitioner.qualification) {
        if (qualification.code?.text) {
          const qualificationText = qualification.code.text.toLowerCase();
          if (qualificationText.includes("radiology") || qualificationText.includes("imaging")) {
            return true;
          }
        }
        if (qualification.code?.coding) {
          for (const coding of qualification.code.coding) {
            const display = coding.display?.toLowerCase();
            if (display && (display.includes("radiology") || display.includes("imaging"))) {
              return true;
            }
          }
        }
      }
    }
  }

  // 5. Check organization names
  const reportOrganizations = getReportOrganizations(report, organizationMap);
  const encounterOrganizations = encounter
    ? getEncounterOrganizations(encounter, organizationMap)
    : [];
  const allOrganizations = [...reportOrganizations, ...encounterOrganizations];

  for (const organization of allOrganizations) {
    const name = organization.name?.toLowerCase();
    if (name && (name.includes("radiology") || name.includes("imaging"))) {
      return true;
    }
  }

  return false;
}

/**
 * Split diagnostic reports into imaging reports and clinical notes
 */
export function splitDiagnosticReports(
  diagnosticReports: DiagnosticReport[],
  procedures: Procedure[],
  context: ImagingDetectionContext
): { imagingReports: DiagnosticReport[]; clinicalNotes: DiagnosticReport[] } {
  const imagingReportIds = getImagingReportIdsFromProcedures(procedures);
  const maps = buildContextMaps(context);

  const imagingReports: DiagnosticReport[] = [];
  const clinicalNotes: DiagnosticReport[] = [];

  for (const report of diagnosticReports) {
    if (isImagingReport(report, imagingReportIds, context, maps)) {
      imagingReports.push(report);
    } else {
      clinicalNotes.push(report);
    }
  }

  return { imagingReports, clinicalNotes };
}
