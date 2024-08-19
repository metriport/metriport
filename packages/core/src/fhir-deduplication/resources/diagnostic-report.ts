import { DiagnosticReport } from "@medplum/fhirtypes";
import { combineResources, fillMaps, getDateFromResource } from "../shared";

export function deduplicateDiagReports(medications: DiagnosticReport[]): {
  combinedDiagnosticReports: DiagnosticReport[];
  refReplacementMap: Map<string, string[]>;
} {
  const { diagReportsMap, remainingDiagReports, refReplacementMap } =
    groupSameDiagnosticReports(medications);
  return {
    combinedDiagnosticReports: combineResources({
      combinedMaps: [diagReportsMap],
      remainingResources: remainingDiagReports,
    }),
    refReplacementMap,
  };
}

/**
 * Approach:
 * 1 map, where the key is made of:
 * - status
 * - date
 * - code ??
 */
export function groupSameDiagnosticReports(diagReports: DiagnosticReport[]): {
  diagReportsMap: Map<string, DiagnosticReport>;
  remainingDiagReports: DiagnosticReport[];
  refReplacementMap: Map<string, string[]>;
} {
  const diagReportsMap = new Map<string, DiagnosticReport>();
  const refReplacementMap = new Map<string, string[]>();
  const remainingDiagReports: DiagnosticReport[] = [];

  for (const diagReport of diagReports) {
    const date = getDateFromResource(diagReport, "date");
    const status = diagReport.status;

    if (date) {
      const key = JSON.stringify({ date, status });
      fillMaps(diagReportsMap, key, diagReport, refReplacementMap);
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
