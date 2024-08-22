import { DiagnosticReport } from "@medplum/fhirtypes";
import { LOINC_CODE, LOINC_OID } from "../../util/constants";
import {
  combineResources,
  fillMaps,
  getDateFromResource,
  pickMostDescriptiveStatus,
} from "../shared";

const diagnosticReportStatus = [
  "entered-in-error",
  "unknown",
  "registered",
  "partial",
  "preliminary",
  "final",
  "amended",
  "corrected",
  "appended",
  "cancelled",
] as const;
export type DiagnosticReportStatus = (typeof diagnosticReportStatus)[number];

const statusRanking = {
  "entered-in-error": 0,
  unknown: 0,
  registered: 0,
  partial: 0,
  preliminary: 0,
  final: 0,
  amended: 0,
  corrected: 0,
  appended: 0,
  cancelled: 0,
};

export function deduplicateDiagReports(medications: DiagnosticReport[]): {
  combinedDiagnosticReports: DiagnosticReport[];
  refReplacementMap: Map<string, string[]>;
} {
  const { diagReportsMap, refReplacementMap } = groupSameDiagnosticReports(medications);
  return {
    combinedDiagnosticReports: combineResources({
      combinedMaps: [diagReportsMap],
    }),
    refReplacementMap,
  };
}

/**
 * Approach:
 * 1 map, where the key is made of:
 * - date
 * - code - not sure we want to be using codes as a part of the key.
 *          The thing with them is that they very often contain a bunch of different ones, almost always containing the one for "Note" - 34109-9.
 */
export function groupSameDiagnosticReports(diagReports: DiagnosticReport[]): {
  diagReportsMap: Map<string, DiagnosticReport>;
  remainingDiagReports: DiagnosticReport[];
  refReplacementMap: Map<string, string[]>;
} {
  const diagReportsMap = new Map<string, DiagnosticReport>();
  const refReplacementMap = new Map<string, string[]>();
  const remainingDiagReports: DiagnosticReport[] = [];

  function removeCodesAndAssignStatus(
    master: DiagnosticReport,
    existing: DiagnosticReport,
    target: DiagnosticReport
  ): DiagnosticReport {
    const code = master.code;
    const filtered = code?.coding?.filter(coding => {
      const system = coding.system?.toLowerCase();
      return system?.includes(LOINC_CODE) || system?.includes(LOINC_OID);
    });
    if (filtered) {
      master.code = {
        ...code,
        coding: filtered,
      };
    }

    master.status = pickMostDescriptiveStatus(statusRanking, existing.status, target.status);
    return master;
  }

  for (const diagReport of diagReports) {
    const date = getDateFromResource(diagReport, "date-hm");
    const isPresentedFormPresent = diagReport.presentedForm?.length;
    const isResultPresent = diagReport.result?.length;
    if (date && (isPresentedFormPresent || isResultPresent)) {
      const key = JSON.stringify({ date });
      fillMaps(
        diagReportsMap,
        key,
        diagReport,
        refReplacementMap,
        undefined,
        removeCodesAndAssignStatus
      );
    } else {
      remainingDiagReports.push(diagReport);
    }
  }

  return {
    diagReportsMap,
    remainingDiagReports,
    refReplacementMap,
  };
}
