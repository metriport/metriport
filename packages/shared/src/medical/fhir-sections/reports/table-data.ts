import {
  Condition,
  DiagnosticReport,
  Encounter as FHIREncounter,
  Location,
  Organization,
  Practitioner,
  Procedure,
} from "@medplum/fhirtypes";
import dayjs from "dayjs";
import { ISO_DATE } from "../../../common/date";
import {
  MappedConsolidatedResources,
  SectionKey,
  UNKNOWN_DISPLAY,
  getResourcesFromBundle,
} from "..";
import { getImagingReportIdsFromProcedures, getNoteCategory } from "./note-type-utils";
import { getSpecialtyForReport } from "./specialty-utils";
import { toTitleCase } from "../../../common/title-case";

export type Report = {
  encounter: FHIREncounter;
  participants: Practitioner[];
  locations?: Location[];
  organizations?: Organization[];
  diagnoses: Condition[];
  diagnosticReports: DiagnosticReport[];
};

// Serializable version without circular references for JSON compression
export type SerializableReport = {
  encounter: { id?: string; period?: FHIREncounter["period"] };
  participants: Array<{ id?: string; name?: Practitioner["name"] }>;
  locations?: Array<{ id?: string; name?: string }>;
  organizations?: Array<{ id?: string; name?: string }>;
  diagnoses: Array<{ id?: string; code?: Condition["code"]; text?: string }>;
  diagnosticReports: Array<{
    id?: string;
    code?: DiagnosticReport["code"];
    effectiveDateTime?: string;
  }>;
};

type NoteData = {
  encounterText: string | undefined;
  date: string | undefined;
};

export type ReportRowData = {
  id: string;
  report: SerializableReport;
  typeOfReport: string;
  noteCategory: string;
  reasonForVisit: string;
  location: string;
  specialty: string;
  date: string;
  originalData: NoteData;
  ehrAction?: string;
};

export function reportTableData({ bundle }: { bundle: MappedConsolidatedResources }) {
  const reports = getEncounterNotesFromBundle(bundle);
  const procedures = getResourcesFromBundle<Procedure>(bundle, "Procedure");
  const imagingReportIds = getImagingReportIdsFromProcedures(procedures);

  return {
    key: "reports" as SectionKey,
    rowData: getReportRowData({ reports, imagingReportIds }),
  };
}

export function getEncounterNotesFromBundle(
  bundle: MappedConsolidatedResources | undefined
): Report[] {
  const encounters = getResourcesFromBundle<FHIREncounter>(bundle, "Encounter");

  const reports: Report[] = [];

  if (!bundle) {
    return reports;
  }

  const allDiagnosticReports = getResourcesFromBundle<DiagnosticReport>(bundle, "DiagnosticReport");

  for (const encounter of encounters) {
    const participants: Practitioner[] = [];
    const organizations: Organization[] = [];
    const locations: Location[] = [];
    const diagnoses: Condition[] = [];

    const participantIds =
      encounter.participant?.map(p => p.individual?.reference?.split("/").pop()) ?? [];
    const organizationId = encounter.serviceProvider?.reference?.split("/").pop();
    const locationIds = encounter.location?.map(l => l.location?.reference?.split("/").pop()) ?? [];
    const diagnosisIds =
      encounter.diagnosis?.map(d => d.condition?.reference?.split("/").pop()) ?? [];

    for (const participantId of participantIds) {
      if (!participantId) {
        continue;
      }

      const practitioner = bundle["Practitioner"]?.[participantId];

      if (practitioner) {
        participants.push(practitioner as Practitioner);
      }
    }

    if (organizationId) {
      const organization = bundle["Organization"]?.[organizationId];
      if (organization) organizations.push(organization as Organization);
    }

    for (const locationId of locationIds) {
      if (!locationId) {
        continue;
      }

      const location = bundle["Location"]?.[locationId];

      if (location) {
        locations.push(location as Location);
      }
    }

    for (const diagnosisId of diagnosisIds) {
      if (!diagnosisId) {
        continue;
      }

      const diagnosis = bundle["Condition"]?.[diagnosisId];

      if (diagnosis) {
        diagnoses.push(diagnosis as Condition);
      }
    }

    for (const diagnosticReport of allDiagnosticReports) {
      if (diagnosticReport.encounter?.reference?.split("/").pop() === encounter.id) {
        // Get participants from diagnostic report first, fall back to encounter participants
        const diagnosticReportParticipants: Practitioner[] = [];
        const practitionerIds =
          diagnosticReport.performer?.flatMap(({ reference }) =>
            reference?.startsWith("Practitioner/") ? [reference.split("/").pop()] : []
          ) ?? [];

        practitionerIds?.forEach(practId => {
          if (!practId) return;

          const practitioner = bundle["Practitioner"]?.[practId];
          if (practitioner) diagnosticReportParticipants.push(practitioner as Practitioner);
        });

        // Use diagnostic report participants if available, otherwise fall back to encounter participants
        const finalParticipants =
          diagnosticReportParticipants.length > 0 ? diagnosticReportParticipants : participants;

        reports.push({
          encounter,
          participants: finalParticipants,
          organizations,
          locations,
          diagnoses,
          diagnosticReports: [diagnosticReport],
        });
      }
    }
  }

  // Deal with DiagReports that don't reference Encounters
  allDiagnosticReports
    .filter(report => report.encounter == undefined)
    .forEach(report => {
      // If the diagnostic report doesn't have any notes to display, we shouldn't create a table entry for it
      if (!report.presentedForm) return;

      const encounter: FHIREncounter = {
        resourceType: "Encounter",
        id: report.id ?? "",
        period: report.effectivePeriod ?? { start: report.effectiveDateTime ?? "" },
      };
      const participants: Practitioner[] = [];
      const organizations: Organization[] = [];

      const practitionerIds = report.performer
        ?.filter(perf => perf.reference?.startsWith("Practitioner"))
        .flatMap(perf => perf.reference?.split("/").pop() || []);

      practitionerIds?.forEach(practId => {
        const practitioner = bundle["Practitioner"]?.[practId];

        if (practitioner) {
          participants.push(practitioner as Practitioner);
        }
      });

      const organizationIds = report.performer
        ?.filter(perf => perf.reference?.startsWith("Organization"))
        .flatMap(perf => perf.reference?.split("/").pop() || []);

      organizationIds?.forEach(orgId => {
        const organization = bundle["Organization"]?.[orgId];

        if (organization) {
          organizations.push(organization as Organization);
        }
      });

      reports.push({
        encounter,
        participants,
        organizations,
        diagnoses: [],
        diagnosticReports: [report],
      });
    });

  return reports;
}

function getReportRowData({
  reports,
  imagingReportIds,
}: {
  reports: Report[];
  imagingReportIds: Set<string>; // used to set Note to Imaging Category
}): ReportRowData[] {
  return reports
    ?.filter(report => report.diagnosticReports.length !== 0)
    .map(report => {
      const encounter = report.encounter;

      const reasonForVisitString = report.diagnoses.map(getDiagnosisText).filter(Boolean);

      const typeOfReport = getReportTypeByLoinc(report.diagnosticReports);

      const specialty = getSpecialtyForReport(report.participants, report.organizations);

      const noteCategory = getNoteCategory(
        report.diagnosticReports,
        imagingReportIds,
        report.participants,
        report.organizations
      );

      const locations = Array.from(new Set(report.locations?.map(location => location.name))).join(
        ", "
      );

      const organizations = Array.from(new Set(report.organizations?.map(org => org.name))).join(
        ", "
      );

      return {
        id: encounter.id ?? "",
        report: createSerializableReport(report),
        typeOfReport,
        noteCategory,
        specialty,
        reasonForVisit: reasonForVisitString.length
          ? toTitleCase(reasonForVisitString.join(", "))
          : "-",
        location: locations.length > 0 ? locations : organizations,
        date: encounter.period?.start ? dayjs(encounter.period.start).format(ISO_DATE) : "-",
        originalData: {
          encounterText: report.diagnosticReports
            .flatMap(report => getCleanNotesFromReport(report).join("\n"))
            .join("\n"),
          date: encounter.period?.start,
        },
      };
    });
}

function createSerializableReport(report: Report): SerializableReport {
  return {
    encounter: {
      id: report.encounter.id ?? "",
      ...(report.encounter.period ? { period: report.encounter.period } : {}),
    },
    participants: report.participants.map(p => ({
      id: p.id ?? "",
      name: p.name,
    })),
    locations: (report.locations ?? []).map(l => ({
      id: l.id ?? "",
      name: l.name ?? "",
    })),
    organizations: (report.organizations ?? []).map(o => ({
      id: o.id ?? "",
      name: o.name ?? "",
    })),
    diagnoses: report.diagnoses.map(d => ({
      id: d.id ?? "",
      ...(d.code ? { code: d.code } : {}),
      text: d.code?.text ?? "",
    })),
    diagnosticReports: (report.diagnosticReports ?? []).map(dr => ({
      id: dr.id ?? "",
      ...(dr.code ? { code: dr.code } : {}),
      effectiveDateTime: dr.effectiveDateTime ?? "",
    })),
  };
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
  return typeDisplay?.length ? typeDisplay : "-";
}

export function getCleanNotesFromReport(report: DiagnosticReport): string[] {
  const presentedForms = report.presentedForm || [];
  return presentedForms
    .map(form => {
      const note = form.data || "";
      const noJunkNote = removeEncodedStrings(note);
      const decodeNote = atob(noJunkNote);
      return cleanUpNote(decodeNote);
    })
    .filter(note => note.trim().length > 0);
}

const REMOVE_FROM_NOTE = [
  "xLabel",
  "5/5",
  "Â°F",
  "Â",
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

export function getDiagnosisText(diagnosis: Condition): string | undefined {
  const displayText = diagnosis.code?.coding
    ?.flatMap(coding => coding.display?.trim() || [])
    .join(", ");
  return (
    diagnosis.code?.text ??
    (displayText && displayText.length ? toTitleCase(displayText) : undefined)
  );
}
