import {
  Composition,
  DiagnosticReport,
  DocumentReference,
  Organization,
  Practitioner,
  Procedure,
  Reference,
} from "@medplum/fhirtypes";

/**
 * LOINC code to note type category mappings
 * Aligned with backend sectionMap for consistency
 * Reference: Backend section mapping
 */
export const LOINC_NOTE_TYPE_MAPPING = {
  // Results Section
  "57021-8": "Results",
  "30954-2": "Results",

  // History & Physical Notes
  "34117-2": "H&P Notes",

  // Progress Notes
  "11506-3": "Progress Notes",
  "10164-2": "Progress Notes",

  // Emergency Department Notes
  "34111-5": "ED Notes",

  // Telephone encounters (prioritized over miscellaneous)
  "34748-4": "Telephone Encounter",

  // Additional common note types not in backend mapping yet
  // Consultation/Referral Notes
  "11488-4": "Consult",
  "34749-2": "Consult",
  "34877-1": "Consult",
  "34100-8": "Consult",

  // Additional telephone/virtual encounters
  "57053-1": "Telephone Encounter",
  "57054-9": "Telephone Encounter",

  // Discharge Summaries
  "18842-5": "Discharge Summary",
  "28655-9": "Discharge Summary",
  "34105-7": "Discharge Summary",
  "11490-0": "Discharge Summary",

  // Procedure Notes
  "28570-0": "Procedure Note",
  "34895-3": "Procedure Note",
  "28634-4": "Procedure Note",
  "28577-5": "Procedure Note",

  // Operative Notes
  "11504-8": "Operative Note",
  "34896-1": "Operative Note",
  "11502-2": "Operative Note",

  // Additional Progress Notes
  "11507-1": "Progress Notes",
  "28579-1": "Progress Notes",
  "34904-3": "Progress Notes",

  // Additional H&P Notes
  "34774-0": "H&P Notes",

  // Additional Results
  "33747-0": "Results",

  // Generic Note (will be caught by fallback anyway)
  "34109-9": "Miscellaneous Notes",
} as const;

/**
 * Note type categories with keyword patterns for fallback matching
 * Aligned with backend section mapping categories
 */
export const NOTE_TYPE_CATEGORIES = {
  // Primary backend categories
  Results: [
    "results",
    "laboratory",
    "lab",
    "diagnostic",
    "test",
    "labs",
    "pathology",
    "culture",
    "specimen",
  ],
  "H&P Notes": [
    "history and physical",
    "h&p",
    "h & p",
    "admission",
    "initial",
    "intake",
    "examination",
    "physical exam",
  ],
  "Progress Notes": [
    "progress",
    "follow-up",
    "followup",
    "follow up",
    "visit",
    "interim",
    "status",
    "update",
    "present illness",
  ],
  "ED Notes": [
    "emergency",
    "trauma",
    "urgent",
    "acute",
    "er",
    "ed",
    "critical",
    "emergent",
    "emergency department",
  ],
  "Miscellaneous Notes": ["misc", "miscellaneous", "general"],

  // Additional categories not yet in backend
  Consult: [
    "consultation",
    "consult",
    "referral",
    "specialist",
    "opinion",
    "evaluation",
    "assessment",
    "recommendation",
  ],
  "Telephone Encounter": [
    "telephone encounter",
    "phone encounter",
    "telehealth encounter",
    "virtual encounter",
    "telephone",
    "phone",
    "telehealth",
    "virtual",
    "telemedicine",
    "remote",
    "call",
    "video",
  ],
  "Discharge Summary": [
    "discharge",
    "summary",
    "disposition",
    "release",
    "dismissal",
    "departure",
    "home",
    "transfer",
  ],
  "Procedure Note": [
    "procedure",
    "intervention",
    "treatment",
    "therapy",
    "biopsy",
    "injection",
    "aspiration",
  ],
  "Operative Note": [
    "operative",
    "surgery",
    "surgical",
    "operation",
    "post-op",
    "post-operative",
    "intraoperative",
  ],
} as const;

/**
 * CPT code ranges that indicate imaging procedures
 */
export const IMAGING_CPT_RANGES = [
  { start: 70010, end: 79999, category: "Radiology" },
  { start: 93000, end: 93010, category: "Electrocardiography" },
  { start: 93015, end: 93018, category: "Cardiovascular stress testing" },
  { start: 93224, end: 93278, category: "Ambulatory ECG monitoring" },
  { start: 93303, end: 93355, category: "Echocardiography" },
  { start: 93451, end: 93533, category: "Cardiac catheterization" },
  { start: 93561, end: 93572, category: "Intracardiac electrophysiology procedures" },
  { start: 93880, end: 93998, category: "Non-invasive vascular studies" },
  { start: 92133, end: 92136, category: "Optical Coherence Tomography" },
  { start: 92225, end: 92287, category: "Extended ophthalmoscopy and specialized imaging" },
  { start: 95812, end: 95857, category: "Electroencephalography" },
  { start: 95860, end: 95913, category: "Electromyography and nerve conduction" },
  { start: 95800, end: 95811, category: "Sleep studies" },
  { start: 92550, end: 92597, category: "Audiologic function tests" },
  { start: 91110, end: 91299, category: "Gastroenterology procedures with imaging" },
  { start: 94010, end: 94799, category: "Pulmonary function tests with imaging" },
  { start: 95004, end: 95199, category: "Allergy testing with imaging" },
  { start: 96900, end: 96999, category: "Dermatology procedures with imaging" },
] as const;

function getImagingCategory(
  diagnosticReports: DiagnosticReport[],
  imagingReportIds: Set<string>,
  practitioners?: Practitioner[],
  organizations?: Organization[]
): string {
  if (diagnosticReports.length === 0) return "Unknown";

  const withImaging = diagnosticReports.find(r => r.id && imagingReportIds.has(r.id));
  if (withImaging) return "Imaging";

  if (practitioners) {
    for (const practitioner of practitioners) {
      if (practitioner.qualification) {
        for (const qualification of practitioner.qualification) {
          if (qualification.code?.text) {
            const qualificationText = qualification.code.text.toLowerCase();
            if (qualificationText.includes("radiology") || qualificationText.includes("imaging")) {
              return "Imaging";
            }
          }
          if (qualification.code?.coding) {
            for (const coding of qualification.code.coding) {
              const display = coding.display?.toLowerCase();
              if (display && (display.includes("radiology") || display.includes("imaging"))) {
                return "Imaging";
              }
            }
          }
        }
      }
    }
  }

  if (organizations) {
    for (const organization of organizations) {
      const name = organization.name?.toLowerCase();
      if (name && (name.includes("radiology") || name.includes("imaging"))) {
        console.log("return is imaging organization", organization);
        return "Imaging";
      }
    }
  }

  return "Unknown";
}

/**
 * Categorize note type from DiagnosticReport LOINC codes
 * Prioritizes more specific codes over generic ones
 */
export function getLoincCategory(diagnosticReports: DiagnosticReport[]): string {
  if (diagnosticReports.length === 0) {
    return "Unknown";
  }

  const foundCategories: string[] = [];

  for (const report of diagnosticReports) {
    if (report.code?.coding) {
      for (const coding of report.code.coding) {
        if (coding.system === "http://loinc.org" && coding.code) {
          const category =
            LOINC_NOTE_TYPE_MAPPING[coding.code as keyof typeof LOINC_NOTE_TYPE_MAPPING];
          if (category) {
            foundCategories.push(category);
          }
        }
      }
    }
  }

  if (foundCategories.length === 0) {
    return "Unknown";
  }

  // Priority order: more specific categories first, generic ones last
  const priorityOrder = [
    "Telephone Encounter",
    "Consult",
    "Discharge Summary",
    "Procedure Note",
    "Operative Note",
    "ED Notes",
    "H&P Notes",
    "Progress Notes",
    "Results",
    "Miscellaneous Notes", // Generic - lowest priority
  ];

  // Return the highest priority category found
  for (const priority of priorityOrder) {
    if (foundCategories.includes(priority)) {
      return priority;
    }
  }

  return foundCategories[0] || "Unknown";
}

/**
 * Categorize note type from display text using keyword matching
 */
export function getTextCategory(diagnosticReports: DiagnosticReport[]): string {
  if (diagnosticReports.length === 0) {
    return "Unknown";
  }

  for (const report of diagnosticReports) {
    if (report.code?.coding) {
      for (const coding of report.code.coding) {
        if (coding.display) {
          const category = matchNoteTypeByKeywords(coding.display);
          if (category !== "Unknown") {
            return category;
          }
        }
      }
    }
    if (report.code?.text) {
      const category = matchNoteTypeByKeywords(report.code.text);
      if (category !== "Unknown") {
        return category;
      }
    }
  }

  return "Unknown";
}

/**
 * Match note type by keywords in text
 * Order matters: more specific categories are checked first
 */
function matchNoteTypeByKeywords(text: string): string {
  const lowerText = text.toLowerCase().trim();

  // Define the priority order for checking categories
  // More specific categories should come before more general ones
  const priorityOrder = [
    "Telephone Encounter", // Most specific telephone-related
    "Consult",
    "Discharge Summary",
    "Procedure Note",
    "Operative Note",
    "ED Notes",
    "H&P Notes",
    "Progress Notes",
    "Results",
    "Miscellaneous Notes", // Most general - check last
  ];

  // Check categories in priority order
  for (const category of priorityOrder) {
    const keywords = NOTE_TYPE_CATEGORIES[category as keyof typeof NOTE_TYPE_CATEGORIES];
    if (keywords) {
      for (const keyword of keywords) {
        if (lowerText.includes(keyword)) {
          return category;
        }
      }
    }
  }

  return "Unknown";
}

export function getNoteCategory(
  reports: DiagnosticReport[],
  imgReportIds: Set<string>,
  prcts?: Practitioner[],
  orgs?: Organization[]
): string {
  if (!reports || reports.length === 0) {
    return "Unknown";
  }

  const imagingCategory = getImagingCategory(reports, imgReportIds, prcts, orgs);
  if (imagingCategory !== "Unknown") return imagingCategory;

  const loincCategory = getLoincCategory(reports);
  if (loincCategory !== "Unknown") return loincCategory;

  const textCategory = getTextCategory(reports);
  if (textCategory !== "Unknown") return textCategory;

  // Fallback - check if it's a generic note
  for (const report of reports) {
    if (report.code?.coding) {
      for (const coding of report.code.coding) {
        if (coding.display?.toLowerCase().includes("note")) {
          return "Miscellaneous Notes";
        }
      }
    }
    if (report.code?.text?.toLowerCase().includes("note")) {
      return "Miscellaneous Notes";
    }
  }

  return "Unknown";
}

export function getImagingReportIdsFromProcedures(procedures: Procedure[]): Set<string> {
  if (procedures.length === 0) return new Set();
  const reports = procedures
    .filter(isImagingProcedure)
    .flatMap(p => p.report)
    .filter(isReferenceDiagnosticReport) as Reference<DiagnosticReport>[];

  return new Set(reports.map(getReferenceId));
}

function isImagingProcedure(procedure: Procedure): boolean {
  if (!procedure.code?.coding) return false;
  for (const c of procedure.code.coding) {
    const isImaging =
      c.system === "http://www.ama-assn.org/go/cpt" && c.code && isCptCodeInImagingRange(c.code);
    if (isImaging) return true;
  }
  return false;
}

function isReferenceDiagnosticReport(
  reference?: Reference<DiagnosticReport | DocumentReference | Composition>
): boolean {
  if (!reference) return false;
  return (
    reference.type === "DiagnosticReport" ||
    reference.resource?.resourceType === "DiagnosticReport" ||
    !!reference.reference?.includes("DiagnosticReport")
  );
}

function getReferenceId(reference: Reference<DiagnosticReport>): string {
  return reference.id || reference.reference?.split("/").pop() || reference.resource?.id || "";
}

function isCptCodeInImagingRange(cptCode: string): boolean {
  const numericCode = parseInt(cptCode, 10);
  if (isNaN(numericCode)) return false;
  return IMAGING_CPT_RANGES.some(range => numericCode >= range.start && numericCode <= range.end);
}
