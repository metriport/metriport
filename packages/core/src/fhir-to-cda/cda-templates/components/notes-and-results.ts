import { Bundle, DiagnosticReport, Observation, Procedure } from "@medplum/fhirtypes";
import {
  findResourceInBundle,
  isDiagnosticReport,
  isProcedure,
} from "../../../external/fhir/shared";
import { isLoinc } from "../commons";
import { AssembledNote } from "./augmented-resources";
import { buildNotes } from "./notes";
import { buildResultsSection } from "./results";

export const notesCodingMap = new Map<string, string>([
  ["34111-5", "ED Notes"],
  ["10164-2", "Progress Notes"],
  ["34117-2", "H&P Notes"],
]);

export function buildVariousNotesAndResults(fhirBundle: Bundle) {
  const assembledNotes = buildAssembledNotes(fhirBundle);
  return buildSectionsFromAssembledNotes(assembledNotes);
}

export type SectionDetails = {
  sectionName: string;
  reportCodes: string[];
  display?: string;
  templateId?: string;
};

const sectionMap = new Map<string, SectionDetails>([
  [
    "30954-2",
    {
      sectionName: "Results",
      reportCodes: ["57021-8", "30954-2"],
      display: "Relevant diagnostic tests/laboratory data Narrative",
      // in entries, organizer (2.16.840.1.113883.10.20.22.4.1) with components (observation/procedure) with different codes (some LOINC unk)
    },
  ],
  [
    "34117-2",
    {
      sectionName: "H&P Notes",
      reportCodes: ["34117-2"],
      display: "History and physical note",
      templateId: "2.16.840.1.113883.10.20.22.2.65",
      // in entries, entries > act (2.16.840.1.113883.10.20.22.4.202)
    },
  ],
  [
    "10164-2",
    {
      sectionName: "Progress Notes",
      reportCodes: ["11506-3", "10164-2"],
      display: "History of Present Illness",
      templateId: "1.3.6.1.4.1.19376.1.5.3.1.3.4",
      // in entries, many entries > act (2.16.840.1.113883.10.20.22.4.202) with code 34109-9 (?????)
    },
  ],
  [
    "34111-5",
    {
      sectionName: "ED Notes",
      reportCodes: ["34111-5"],
      display: "Emergency department Note",
      templateId: "2.16.840.1.113883.10.20.22.2.65",
      // in entries, entries > act (2.16.840.1.113883.10.20.22.4.202) with code ("34109-9")
    },
  ],
  [
    "34109-9",
    {
      sectionName: "Miscellaneous Notes",
      reportCodes: ["34748-4", "34109-9"],
      display: "Note",
      templateId: "2.16.840.1.113883.10.20.22.2.65",
    },
    // in entries, many entries > act (2.16.840.1.113883.10.20.22.4.202) with code 34109-9
  ],
]);

function findKeyInMapByReportCode(reportCode: string): string | undefined {
  for (const [key, sectionDetails] of sectionMap.entries()) {
    if (sectionDetails.reportCodes.includes(reportCode)) {
      return key;
    }
  }
  return undefined;
}

function buildAssembledNotes(fhirBundle: Bundle) {
  const assembledNotes: AssembledNote[] = [];
  const diagnosticReports: DiagnosticReport[] =
    fhirBundle.entry?.flatMap(entry =>
      isDiagnosticReport(entry.resource) ? [entry.resource] : []
    ) || [];

  diagnosticReports.forEach(report => {
    const sectionName = assignSectionName(report);
    const observations = getReferencedObservations(report, fhirBundle);
    const addedObservation = createObsFromDiagReport(report);
    const combinedObservations = combineObs(observations, addedObservation);
    const procedures = getProceduresWithReference(fhirBundle, report.id);
    assembledNotes.push(new AssembledNote(sectionName, report, combinedObservations, procedures));
  });

  return assembledNotes;
}

function assignSectionName(report: DiagnosticReport) {
  let sectionName;

  const reportCodes = report.code?.coding?.flatMap(coding => {
    if (!isLoinc(coding.system) || !coding.code) return [];
    return coding.code.trim();
  });
  if (reportCodes?.length) {
    for (const code of reportCodes) {
      if (code !== "34109-9") {
        sectionName = findKeyInMapByReportCode(code);
        if (sectionName) return sectionName;
      }
    }
  }

  return sectionName ?? "34109-9";
}

function getReferencedObservations(
  report: DiagnosticReport,
  fhirBundle: Bundle
): Observation[] | undefined {
  return report.result?.flatMap(result => {
    if (result.reference?.includes("Observation")) {
      const referencedObs = findResourceInBundle(fhirBundle, result.reference);
      if (referencedObs) return referencedObs as Observation;
    }
    return [];
  });
}

function combineObs(
  observations: Observation[] | undefined,
  addedObs: Observation | undefined
): Observation[] {
  const combined: Observation[] = [];
  if (addedObs) combined.push(addedObs);
  if (observations) combined.push(...observations);
  return combined;
}

function createObsFromDiagReport(report: DiagnosticReport): Observation | undefined {
  if (!report.presentedForm?.length) return undefined;

  return {
    resourceType: "Observation",
    status: "final",
    code: {
      coding: [
        {
          system: "http://loinc.org",
          code: "34109-9",
          display: "Note",
        },
      ],
    },
    ...(report.effectiveDateTime && { effectiveDateTime: report.effectiveDateTime }),
  };
}

function getProceduresWithReference(
  fhirBundle: Bundle,
  referencedReportId: string | undefined
): Procedure[] | undefined {
  if (!referencedReportId) return undefined;
  const procedures: Procedure[] =
    fhirBundle.entry?.flatMap(entry => (isProcedure(entry.resource) ? [entry.resource] : [])) || [];

  return procedures.filter(procedure =>
    procedure.report?.filter(
      report => report.reference === `DiagnosticReport/${referencedReportId}`
    )
  );
}

function groupAssembledNotesBySection(assembledNotes: AssembledNote[]) {
  const groupedNotes = new Map<string, AssembledNote[]>();
  assembledNotes.forEach(note => {
    const sectionName = note.sectionName;
    if (!groupedNotes.has(sectionName)) {
      groupedNotes.set(sectionName, [note]);
    } else {
      groupedNotes.get(sectionName)?.push(note);
    }
  });
  return groupedNotes;
}

function buildSectionsFromAssembledNotes(assembledNotes: AssembledNote[]) {
  const groupedNotes = groupAssembledNotesBySection(assembledNotes);
  const sections = [];
  for (const [sectionCode, notes] of groupedNotes.entries()) {
    const sectionDetails = sectionMap.get(sectionCode);
    if (!sectionDetails) continue;
    const section = buildNotesSections(notes, sectionCode, sectionDetails);
    sections.push(section);
  }
  return sections;
}

function buildNotesSections(
  notes: AssembledNote[],
  sectionCode: string,
  sectionDetails: SectionDetails
) {
  const allNotesSections = [];
  if (sectionCode === "30954-2") {
    const results = buildResultsSection(notes, sectionDetails, sectionCode);
    allNotesSections.push(results);
  } else {
    const notesSection = buildNotes(notes, sectionDetails, sectionCode);
    allNotesSections.push(notesSection);
  }
  return allNotesSections;
}

// ADDITIONAL NOTES FOR REFERENCE:
// ____________________________________

// const sectionCodes = [
//   ["18842-5", "Discharge Summary",],
//   ["34748-4", "Telephone encounter Note"],
//   ["11506-3", "Progress note"],
//   ["34109-9", "Note"],
//   ["36235-0", "???"],
//   ["57021-8", "???"],
//   ["24322-0", "???"],
//   ["2890-2", "???"],
//   ["3040-3", "???"],
// ]

// const codeToSectionMap = new Map<string, SectionDetails>([
//   ["34109-9", "Note"],
//   ["34748-4", "Telephone encounter Note"],
//   ["11506-3", "Progress note"],
//   ["36235-0", "unknown"],
//   ["57021-8", "CBC W Auto Differential panel - Blood"],
//   ["24322-0", "unknown"],
//   ["2890-2", "unknown"],
//   ["3040-3", "unknown"],
//   ["24357-6", "unknown"],
//   ["2112-1", "unknown"],
//   ["94309-2", "unknown"],
//   ["630-4", "unknown"],
//   ["34117-2", "History and physical note"],
//   ["95942-9", "unknown"],
//   ["718-7", "unknown"],
//   ["3016-3", "unknown"],
//   ["62292-8", "unknown"],
//   ["24323-8", "unknown"],
//   ["24331-1", "unknown"],
//   ["4548-4", "unknown"],
//   ["14733-0", "unknown"],
//   ["21198-7", "unknown"],
//   ["8098-6", "unknown"],
//   ["8099-4", "unknown"],
// ]);
