import { DiagnosticReport } from "@medplum/fhirtypes";
import { LOINC_CODE, LOINC_OID } from "../../util/constants";
import {
  DeduplicationResult,
  combineResources,
  createRef,
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

const statusRanking: Record<DiagnosticReportStatus, number> = {
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

export function deduplicateDiagReports(
  medications: DiagnosticReport[]
): DeduplicationResult<DiagnosticReport> {
  const { diagReportsMap, refReplacementMap, danglingReferences } =
    groupSameDiagnosticReports(medications);
  return {
    combinedResources: combineResources({
      combinedMaps: [diagReportsMap],
    }),
    refReplacementMap,
    danglingReferences,
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
  refReplacementMap: Map<string, string>;
  danglingReferences: string[];
} {
  const diagReportsMap = new Map<string, DiagnosticReport>();
  const refReplacementMap = new Map<string, string>();
  const danglingReferencesSet = new Set<string>();

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
    if (filtered && filtered.length) {
      master.code = {
        ...code,
        coding: filtered,
      };
    }

    master.status = pickMostDescriptiveStatus(statusRanking, existing.status, target.status);
    return master;
  }

  for (const diagReport of diagReports) {
    const datetime = getDateFromResource(diagReport, "datetime");
    const isPresentedFormPresent = diagReport.presentedForm?.length;
    const isResultPresent = diagReport.result?.length;
    if (datetime && (isPresentedFormPresent || isResultPresent)) {
      const key = JSON.stringify({ datetime });
      fillMaps(
        diagReportsMap,
        key,
        diagReport,
        refReplacementMap,
        undefined,
        removeCodesAndAssignStatus
      );
    } else {
      danglingReferencesSet.add(createRef(diagReport));
    }
  }

  return {
    diagReportsMap,
    refReplacementMap,
    danglingReferences: [...danglingReferencesSet],
  };
}
