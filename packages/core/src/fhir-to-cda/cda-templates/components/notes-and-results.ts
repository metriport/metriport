import { Bundle, DiagnosticReport, Observation, Procedure } from "@medplum/fhirtypes";
import {
  findResourceInBundle,
  isDiagnosticReport,
  isProcedure,
} from "../../../external/fhir/shared";
import { isLoinc } from "../commons";
import { AssembledNote } from "./augmented-resources";
import { buildResultsSection } from "./results";
// import { base64ToString } from "../../../util/base64";
// import { NotesSection } from "../../cda-types/sections";
// import { ConcernActEntry, TextUnstructured } from "../../cda-types/shared-types";
// import { buildAuthor } from "../clinical-document/author";
// import {
//   buildCodeCe,
//   buildCodeCvFromCodeableConcept,
//   buildInstanceIdentifier,
//   buildTemplateIds,
//   formatDateToCdaTimestamp,
//   getDisplaysFromCodeableConcepts,
//   withoutNullFlavorObject,
// } from "../commons";
// import { extensionValue2015, oids, placeholderOrgOid } from "../constants";
// import { buildResponsibleParty } from "./encompassing-encounter";
// import { mapEncounterStatusCode } from "./encounters";
// import { AssembedNote } from "./augmented-resources";

export const notesCodingMap = new Map<string, string>([
  ["34111-5", "ED Notes"],
  ["10164-2", "Progress Notes"],
  ["34117-2", "H&P Notes"],
]);

export function buildVariousNotesAndResults(fhirBundle: Bundle) {
  const assembledNotes = buildAssembledNotes(fhirBundle);
  return buildSectionsFromAssembledNotes(assembledNotes);
}

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

type SectionDetails = {
  sectionName: string;
  reportCodes: string[];
  display?: string;
  templateId?: string;
};

const sectionMap = new Map<string, SectionDetails>([
  [
    "34117-2",
    {
      sectionName: "H&P Notes",
      reportCodes: ["34117-2"],
      display: "History and physical note",
      templateId: "2.16.840.1.113883.10.20.22.2.65",
    },
  ],
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

function findKeyInMapByReportCode(reportCode: string): string | undefined {
  for (const [key, sectionDetails] of sectionMap.entries()) {
    if (sectionDetails.reportCodes.includes(reportCode)) {
      return key;
    }
  }
  return undefined;
}

// The plan for mapping is as follows:
// 1. Get all diagnostic reports
// 2. For each diagnostic report, get all the codings
// 3. For each coding, check if it is a LOINC code
// 4. If it is a LOINC code, check if it is in the sectionMap
// 5. If it is in the sectionMap, add it to the corresponding section
// 6. If it is not in the sectionMap, add it to the Miscellaneous Notes section
// 7. For each DiagnosticReport, create an AssembledNote object
// 8. Group assembled notes by section
// 9. Create a section for each group
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
    console.log("report", report.id, "is in", sectionName);
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

  const obs: Observation = {
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
    // effectiveDateTime: report.effectiveDateTime,
  };

  return obs;
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
  for (const [sectionName, notes] of groupedNotes.entries()) {
    const sectionDetails = sectionMap.get(sectionName);
    if (!sectionDetails) continue;
    const section = buildNotesSections(notes, sectionName, sectionDetails);
    sections.push(section);
  }
  return sections;
}

function buildNotesSections(
  notes: AssembledNote[],
  sectionName: string,
  sectionDetails: SectionDetails
) {
  const allNotesSections = [];
  if (sectionName === "30954-2") {
    console.log("sectionName", sectionName, notes.length, sectionDetails);
    const results = buildResultsSection(notes);
    console.log("RES", results);
    allNotesSections.push(results);
  }
  return allNotesSections;
}

// function buildNotesSection(diagnosticReport: DiagnosticReport, fhirBundle: Bundle): NotesSection {
//   const text = getTextItemsFromDiagnosticReports(diagnosticReport);
//   const code = diagnosticReport.code;
//   const primaryCoding = code?.coding?.[0];
//   const primaryCode = primaryCoding?.code;
//   const title = primaryCode
//     ? notesCodingMap.get(primaryCode)
//     : getDisplaysFromCodeableConcepts(code);
//   return {
//     templateId: buildInstanceIdentifier({
//       root: oids.notesSection,
//     }),
//     code: buildCodeCe({
//       code: primaryCoding?.code,
//       codeSystem: primaryCoding?.system,
//       displayName: primaryCoding?.display,
//     }),
//     title: title ?? "Notes",
//     text,
//     entry: buildEntriesFromDiagnosticReport(diagnosticReport, fhirBundle),
//   };
// }

// export function getTextItemsFromDiagnosticReports(
//   report: DiagnosticReport
// ): string | TextUnstructured {
//   const contentLines = report.presentedForm?.[0]?.data
//     ? base64ToString(report.presentedForm[0].data).split(/\n/)
//     : [];

//   if (contentLines.length > 0) {
//     const contentObjects = contentLines.map(line => ({
//       br: line,
//     }));

//     if (contentLines.some(line => line.includes("<table>"))) {
//       return contentObjects.map(o => o.br.trim()).join("");
//     }

//     return [
//       {
//         content: {
//           _ID: `_${report.id}`,
//           br: contentObjects.map(o => o.br),
//         },
//       },
//     ];
//   }
//   return "Not on file";
// }

// export function buildEntriesFromDiagnosticReport(
//   report: DiagnosticReport,
//   fhirBundle: Bundle
// ): ConcernActEntry {
//   const categoryCodes = report.category?.flatMap(
//     category => buildCodeCvFromCodeableConcept(category) || []
//   );
//   const codeCodes = report.code?.coding?.map(coding =>
//     buildCodeCe({
//       code: coding.code,
//       codeSystem: coding.system,
//       displayName: coding.display,
//     })
//   );

//   const authorOrgs = report.performer?.flatMap(performer => {
//     const orgId = performer.reference?.includes("Organization") ? performer.reference : undefined;
//     if (!orgId) return [];
//     return fhirBundle.entry?.map(e => e.resource).find(isOrganization) || [];
//   });
//   const primaryOrganization = authorOrgs?.[0];
//   const author = primaryOrganization && buildAuthor(primaryOrganization);

//   const practitioners = report.performer?.flatMap(performer => {
//     const practitionerId = performer.reference?.includes("Practitioner")
//       ? performer.reference
//       : undefined;
//     if (!practitionerId) return [];
//     return fhirBundle.entry?.map(e => e.resource).find(isPractitioner) || [];
//   });

//   const primaryPractitioner = practitioners?.[0];
//   const practitioner = buildResponsibleParty(primaryPractitioner);

//   return {
//     act: {
//       _classCode: "ACT",
//       _moodCode: "EVN",
//       templateId: buildTemplateIds({
//         root: oids.noteActivity,
//         extension: extensionValue2015,
//       }),
//       id: buildInstanceIdentifier({
//         root: placeholderOrgOid,
//         extension: report.id,
//       }),
//       code:
//         categoryCodes?.[0] ??
//         codeCodes?.[0] ??
//         buildCodeCe({ code: "10164-2", codeSystem: "2.16.840.1.113883.6.1" }),
//       statusCode: {
//         _code: mapEncounterStatusCode(report.status),
//       },
//       effectiveTime: withoutNullFlavorObject(
//         formatDateToCdaTimestamp(report.effectiveDateTime),
//         "_value"
//       ),
//       author,
//       informant: practitioner,
//     },
//   };
// }

// function diagReportStatusToActStatus() {
//   {{#if (eq code 'registered')}}
// 	"registered"
// {{else if (eq code 'received')}}
// 	"registered"
// {{else if (eq code 'preliminary')}}
// 	"preliminary"
// {{else if (eq code 'final')}}
// 	"final"
// {{else if (eq code 'completed')}}
// 	"final"
// {{else if (eq code 'amended')}}
// 	"amended"
// {{else if (eq code 'corrected')}}
// 	"corrected"
// {{else if (eq code 'appended')}}
// 	"appended"
// {{else if (eq code 'cancelled')}}
// 	"cancelled"
// {{else if (eq code 'abandoned')}}
// 	"cancelled"
// {{else if (eq code 'entered-in-error')}}
// 	"entered-in-error"
// {{else if (eq code 'error')}}
// 	"entered-in-error"
// {{else if (eq code 'unknown')}}
// 	"unknown"
// {{else}}
//     "unknown"
// {{/if}}
// }
