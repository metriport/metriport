import { DiagnosticReport } from "@medplum/fhirtypes";
import dayjs from "dayjs";

export const ISO_DATE = "YYYY-MM-DD";
export const MISSING_DATE_KEY = "N/A";
export const MISSING_DATE_TEXT = "not available";

type EncounterTypes =
  | "labs"
  | "progressNotes"
  | "afterInstructions"
  | "reasonForVisit"
  | "documentation";

/**
 * EncounterSection is a map of strings to DiagnosticReport arrays.
 * NOTE: don't assume key is a date, it might be MISSING_DATE_KEY, in case the date is not available.
 */
type EncounterSection = {
  [key: string]: {
    [k in EncounterTypes]?: DiagnosticReport[];
  };
};

export function formatDateForDisplay(date: Date): string;
export function formatDateForDisplay(date?: string | undefined): string;
export function formatDateForDisplay(date?: Date | string | undefined): string {
  const dateStr = typeof date === "string" ? date : date?.toISOString();
  return dateStr ? dayjs(dateStr).format(ISO_DATE) : "";
}

/**
 * @returns EncounterSection - NOTE: don't assume key is a date, it might be MISSING_DATE_KEY, in
 * case the date is not available. See EncounterSection type for more details.
 */
export function buildEncounterSections(
  encounterSections: EncounterSection,
  diagnosticReports: DiagnosticReport[]
): EncounterSection {
  for (const report of diagnosticReports) {
    const time = report.effectiveDateTime ?? report.effectivePeriod?.start;
    const reportDate =
      time && time !== MISSING_DATE_KEY ? formatDateForDisplay(time) : MISSING_DATE_KEY;

    if (!encounterSections[reportDate]) {
      encounterSections[reportDate] = {};
    }

    let diagnosticReportsType: EncounterTypes | undefined = "documentation";

    if (report.category) {
      for (const iterator of report.category) {
        if (iterator.text?.toLowerCase() === "lab") {
          diagnosticReportsType = "labs";
        }
      }
    }

    let isReportDuplicate = false;

    if (encounterSections[reportDate]?.[diagnosticReportsType]) {
      const isDuplicate = encounterSections[reportDate]?.[diagnosticReportsType]?.find(
        reportInside => {
          const reportInsideTime =
            reportInside.effectiveDateTime ?? reportInside.effectivePeriod?.start;
          const reportInsideDate = formatDateForDisplay(reportInsideTime);
          const isDuplicateDate = reportInsideDate === reportDate;

          const hasSamePresentedForm = report.presentedForm?.some(pf =>
            reportInside.presentedForm?.some(ripf => pf.data === ripf.data)
          );

          return isDuplicateDate && hasSamePresentedForm;
        }
      );

      isReportDuplicate = !!isDuplicate;
    }

    if (!encounterSections?.[reportDate]?.[diagnosticReportsType]) {
      encounterSections[reportDate] = {
        ...encounterSections[reportDate],
        [diagnosticReportsType]: [],
      };
    }

    if (!isReportDuplicate) {
      encounterSections[reportDate]?.[diagnosticReportsType]?.push(report);
    }
  }

  return encounterSections;
}
