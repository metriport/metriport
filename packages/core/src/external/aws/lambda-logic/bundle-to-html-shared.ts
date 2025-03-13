import { DiagnosticReport, FamilyMemberHistory } from "@medplum/fhirtypes";
import dayjs from "dayjs";
import { Brief } from "../../../command/ai-brief/brief";

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
export type EncounterSection = {
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
export function buildEncounterSections(diagnosticReports: DiagnosticReport[]): EncounterSection {
  const encounterSections: EncounterSection = {};
  for (const report of diagnosticReports) {
    const time = report.effectiveDateTime ?? report.effectivePeriod?.start;
    const reportDate =
      time && time !== MISSING_DATE_KEY ? formatDateForDisplay(time) : MISSING_DATE_KEY;

    if (!encounterSections[reportDate]) {
      encounterSections[reportDate] = {};
    }

    let diagnosticReportsType: EncounterTypes | undefined = "documentation";

    if (report.category) {
      const categories = Array.isArray(report.category) ? report.category : [report.category];
      for (const iterator of categories) {
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

export function createBrief(brief?: Brief): string {
  if (!brief || !brief.content) return ``;
  const { link, content } = brief;
  const briefContents = `
  <div class="brief-section-content">
    <div class="beta-flag">BETA</div>
    <table><tbody><tr><td>${content.replace(/\n/g, "<br/>")}</td></tr></tbody></table>
    <div class="brief-warning">
      <div class="brief-warning-contents">
        <div class="brief-warning-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C11.448 2 11 2.448 11 3V11C11 11.552 11.448 12 12 12C12.552 12 13 11.552 13 11V3C13 2.448 12.552 2 12 2ZM11 15C11 14.448 11.448 14 12 14C12.552 14 13 14.448 13 15V17C13 17.552 12.552 18 12 18C11.448 18 11 17.552 11 17V15Z" fill="#FFCC00"/>
            <path fill-rule="evenodd" clip-rule="evenodd" d="M22 20C22 21.1046 21.1046 22 20 22H4C2.89543 22 2 21.1046 2 20V4C2 2.89543 2.89543 2 4 2H20C21.1046 2 22 2.89543 22 4V20ZM20 4H4V20H20V4Z" fill="#FFCC00"/>
          </svg>
        </div>
        <div>
          <strong style="color: #FF6F00;">Warning:</strong>
        </div>
      </div>
      <div class="brief-warning-message">
        This Medical Record Brief was generated using AI technologies using the last year of the patient's medical history.
        The information contained within might contain errors.
        DO NOT use this as a single source of truth and verify this information with the data below.
        Provide feedback about the AI-generated brief <a href="${link}" target="_blank">here</a>.
      </div>
    </div>
  </div>
  `;
  return createSection("Brief (AI-generated)", briefContents, "ai-brief");
}

export function createSection(title: string, tableContents: string, id?: string) {
  return `
    <div id="${id ?? title.toLowerCase().replace(/\s+/g, "-")}" class="section">
      <div class="section-title">
        <h3 id="${title}" title="${title}">&#x276F; ${title}</h3>
        <a href="#mr-header">&#x25B2; Back to Top</a>
      </div>
      <div class="section-content">
          ${tableContents}
      </div>
    </div>
  `;
}

function asYesNo(value: boolean): "yes" | "no" {
  return value ? ("yes" as const) : ("no" as const);
}

export const getDeceasedStatus = (familyMemberHistory: FamilyMemberHistory): "yes" | "no" | "" => {
  const deceasedBoolean = familyMemberHistory.deceasedBoolean;
  if (deceasedBoolean !== undefined) {
    return asYesNo(deceasedBoolean);
  }

  const conditionContributedToDeath = familyMemberHistory.condition?.find(
    condition => condition.contributedToDeath
  );

  if (conditionContributedToDeath?.contributedToDeath !== undefined) {
    return asYesNo(conditionContributedToDeath.contributedToDeath);
  }

  return "";
};
