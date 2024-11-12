import { Condition, DiagnosticReport, Encounter, Location, Practitioner } from "@medplum/fhirtypes";
import dayjs from "dayjs";
import { toTitleCase } from "@metriport/shared/common/titleCase";
import { createSectionHeader } from "../shared/section-header";
import {
  MappedConsolidatedResources,
  Filter,
  getResourcesFromBundle,
  ISO_DATE,
} from "../../shared";
import { UNKNOWN_DISPLAY } from "../../../../../../fhir-deduplication/shared";

export type Report = {
  encounter: Encounter;
  participants: Practitioner[];
  locations: Location[];
  diagnoses: Condition[];
  diagnosticReports: DiagnosticReport[];
};

export function createNotesSections(
  mappedResources: MappedConsolidatedResources,
  filter: Filter
): string {
  const reports = getEncounterNotesFromBundle(mappedResources);
  console.log(filter);
  return `
    <div id="notes" class="section">
      ${createSectionHeader("Notes", "fa-sticky-note")}

      ${reports.map(createNoteSection).join("")}
    </div>
  `;
}

function createNoteSection(report: Report): string {
  const reportType = getReportTypeByLoinc(report.diagnosticReports);
  const date = dayjs(report.encounter.period?.start).format(ISO_DATE);
  return `
    <div class="note">
      <div class="note-header">
        <div class="note-locations">
          ${createLocationsSection(report.locations)}
        </div>
        <h3 class="note-title">${reportType}</h3>
        ${createMetaSection(report.participants, date)}
      </div>

      <div class="note-content">
        ${createReportsSections(report.diagnosticReports)}
      </div>

      ${createDiagnosisList(report.diagnoses)}
    </div>
  `;
}

function createLocationsSection(locations: Location[]): string {
  return locations
    .map(location => {
      return `
      <div class="note-location">
        <i class="fas fa-map-marker-alt"></i>
        ${location.name}
      </div>
    `;
    })
    .join("");
}

function createMetaSection(participants: Practitioner[], date: string): string {
  const validParticipants = participants.filter(
    participant => participant.name?.[0]?.given?.[0] && participant.name?.[0]?.family
  );

  if (!validParticipants.length) {
    return `
      <div class="note-meta">
        <div class="provider-avatar">
          <i class="fas fa-user-md"></i>
        </div>
        <span>${date}</span>
      </div>
    `;
  }

  const names = validParticipants
    .map(participant => {
      return `${participant.name?.[0]?.given?.[0]} ${participant.name?.[0]?.family}`;
    })
    .join(", ");

  return `
    <div class="note-meta">
      <div class="provider-avatar">
        <i class="fas fa-user-md"></i>
      </div>
      <span>${names}</span>
      <span>•</span>
      <span>${date}</span>
    </div>
  `;
}

export function createReportsSections(reports: DiagnosticReport[]) {
  return `
    <div class="note-text">
      ${reports.map(report => createReportSection(report)).join("")}
    </div>
  `;
}

export function createReportSection(report: DiagnosticReport) {
  const cleanNote = getCleanNoteFromReport(report).trimStart();

  if (!cleanNote) {
    return null;
  }

  return `${cleanNote}`;
}

export function createDiagnosisList(diagnoses: Condition[]): string {
  if (!diagnoses.length) {
    return "";
  }

  return `
    <div class="diagnosis-box">
      <div class="diagnosis-title">Outcome Diagnosis:</div>
      <ul class="diagnosis-list">
        ${diagnoses
          .map(diagnosis => `<li class="diagnosis-item">${diagnosis.code?.text}</li>`)
          .join("")}
      </ul>
    </div>
  `;
}

export function getEncounterNotesFromBundle(
  bundle: MappedConsolidatedResources | undefined
): Report[] {
  const encounters = getResourcesFromBundle<Encounter>(bundle, "Encounter");

  const reports: Report[] = [];

  if (!bundle) {
    return reports;
  }

  for (const encounter of encounters) {
    const participants: Practitioner[] = [];
    const locations: Location[] = [];
    const diagnoses: Condition[] = [];
    const diagnosticReports: DiagnosticReport[] = [];

    const participantIds =
      encounter.participant?.map(p => p.individual?.reference?.split("/").pop()) ?? [];
    const locationIds = encounter.location?.map(l => l.location?.reference?.split("/").pop()) ?? [];
    const diagnosisIds =
      encounter.diagnosis?.map(d => d.condition?.reference?.split("/").pop()) ?? [];
    const allDiagnosticReports = getResourcesFromBundle<DiagnosticReport>(
      bundle,
      "DiagnosticReport"
    );

    for (const participantId of participantIds) {
      if (!participantId) {
        continue;
      }

      const practitioner = bundle.Practitioner?.[participantId];

      if (practitioner) {
        participants.push(practitioner as Practitioner);
      }
    }

    for (const locationId of locationIds) {
      if (!locationId) {
        continue;
      }

      const location = bundle.Location?.[locationId];

      if (location) {
        locations.push(location as Location);
      }
    }

    for (const diagnosisId of diagnosisIds) {
      if (!diagnosisId) {
        continue;
      }

      const diagnosis = bundle.Condition?.[diagnosisId];

      if (diagnosis) {
        diagnoses.push(diagnosis as Condition);
      }
    }

    for (const diagnosticReport of allDiagnosticReports) {
      if (diagnosticReport.encounter?.reference?.split("/").pop() === encounter.id) {
        diagnosticReports.push(diagnosticReport);
      }
    }

    reports.push({
      encounter,
      participants,
      locations,
      diagnoses,
      diagnosticReports,
    });
  }

  return reports
    .filter(report => report.diagnosticReports.length)
    .sort((a, b) => {
      return (
        new Date(b.encounter.period?.start || "").getTime() -
        new Date(a.encounter.period?.start || "").getTime()
      );
    });
}

export function getReportTypeByLoinc(diagnosticReports: DiagnosticReport[]): string {
  const type = diagnosticReports.flatMap(report => {
    let reportType: string | undefined;
    let notePresent;

    report.code?.coding?.forEach(coding => {
      const display = coding.display?.toLowerCase().trim();
      if (display === "note") {
        notePresent = true;
      }
      if (display !== UNKNOWN_DISPLAY) {
        reportType = display;
      }
    });

    const text = report.code?.text?.toLowerCase().trim();
    if (!reportType && !notePresent && text !== UNKNOWN_DISPLAY) reportType = text;

    return (reportType && toTitleCase(reportType)) || (notePresent ? "Note" : []);
  });

  const typeDisplay = Array.from(new Set(type)).join(", ");
  return typeDisplay?.length ? typeDisplay : "Note";
}

export function getCleanNoteFromReport(report: DiagnosticReport): string {
  const note = report.presentedForm?.[0]?.data || "";
  const noJunkNote = removeEncodedStrings(note);
  const decodeNote = atob(noJunkNote);
  return cleanUpNote(decodeNote);
}

const REMOVE_FROM_NOTE = [
  "xLabel",
  "5/5",
  "Â°F",
  "â¢",
  "documented in this encounter",
  "xnoIndent",
  "Formatting of this note might be different from the original.",
  "<content>",
  "</content>",
  "<root>",
  "</root>",
  "&lt;",
  "&gt;",
];

function cleanUpNote(note: string): string {
  return note
    .trim()
    .replace(new RegExp(REMOVE_FROM_NOTE.join("|"), "g"), "")
    .replace(/<ID>.*?<\/ID>/g, "")
    .replace(/<styleCode>.*?<\/styleCode>/g, "");
}

function removeEncodedStrings(valueString: string): string {
  return valueString.replace(/&#x3D;/g, "").trim();
}
