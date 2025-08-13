import { DiagnosticReport } from "@medplum/fhirtypes";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import {
  DeduplicationResult,
  assignMostDescriptiveStatus,
  combineResources,
  createKeysFromObjectArray,
  createKeysFromObjectArrayAndBits,
  createRef,
  fillL1L2Maps,
  getDateFromResource,
  isUnknownCoding,
  isUselessDisplay,
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

function preprocessStatus(existing: DiagnosticReport, target: DiagnosticReport) {
  return assignMostDescriptiveStatus(statusRanking, existing, target);
}

export function deduplicateDiagReports(
  diagReports: DiagnosticReport[]
): DeduplicationResult<DiagnosticReport> {
  const { diagReportsMap, refReplacementMap, danglingReferences } =
    groupSameDiagnosticReports(diagReports);
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
 * - references to the result or presented form
 * - codes / display identifiers:
 *   - if datetime is present, we use the identifier + date, or identifier + 1 date bit
 *   - if datetime is not present, we use the identifier + 0 date bit
 */
export function groupSameDiagnosticReports(diagReports: DiagnosticReport[]): {
  diagReportsMap: Map<string, DiagnosticReport>;
  refReplacementMap: Map<string, string>;
  danglingReferences: Set<string>;
} {
  const l1ReportsMap = new Map<string, string>();
  const l2ReportsMap = new Map<string, DiagnosticReport>();
  const refReplacementMap = new Map<string, string>();
  const danglingReferences = new Set<string>();

  for (const diagReport of diagReports) {
    const datetime = getDateFromResource(diagReport, "datetime");
    const isPresentedFormPresent = diagReport.presentedForm
      ? diagReport.presentedForm?.length > 0
      : false;
    const isResultPresent = diagReport.result ? diagReport.result?.length > 0 : false;

    // If a diagnostic report does not contain any results or doctor's notes, it is useless and can be removed
    if (!isPresentedFormPresent && !isResultPresent) {
      danglingReferences.add(createRef(diagReport));
      continue;
    }

    const getterKeys: string[] = [];
    const setterKeys: string[] = [];

    if (isResultPresent) {
      const resultUuid = createUuidFromText(JSON.stringify(diagReport.result?.sort()));
      const key = JSON.stringify({ resultUuid });
      setterKeys.push(key);
      getterKeys.push(key);
    }

    if (isPresentedFormPresent) {
      const presentedFormUuid = createUuidFromText(JSON.stringify(diagReport.presentedForm));
      const key = JSON.stringify({ presentedFormUuid });
      setterKeys.push(key);
      getterKeys.push(key);
    }

    const identifiers: { key: string }[] = [];
    if (diagReport.code) {
      diagReport.code.coding?.forEach(c => {
        if (isUnknownCoding(c)) return;

        const { code, display, system } = c;
        const normalizedSystem = system?.toLowerCase().replace("urn:oid:", "").trim();

        if (code) {
          identifiers.push({ key: `${code.toLowerCase().trim()}|${normalizedSystem}` });
        }

        if (display && !isUselessDisplay(display)) {
          identifiers.push({ key: display.toLowerCase().trim() });
        }
      });

      const text = diagReport.code.text;
      if (text && !isUselessDisplay(text)) {
        identifiers.push({ key: text.toLowerCase().trim() });
      }
    }

    if (datetime) {
      // flagging the report with each unique identifier + date
      setterKeys.push(...createKeysFromObjectArray({ datetime }, identifiers));
      // flagging the report with each unique identifier + 1 date bit
      setterKeys.push(...createKeysFromObjectArrayAndBits(identifiers, [1]));

      // the report will dedup using each unique identifier with the same date
      getterKeys.push(...createKeysFromObjectArray({ datetime }, identifiers));
      // the report will dedup against ones that don't have the date
      getterKeys.push(...createKeysFromObjectArrayAndBits(identifiers, [0]));
    }

    if (!datetime) {
      // flagging the report with each unique identifier + 0 date bit
      setterKeys.push(...createKeysFromObjectArrayAndBits(identifiers, [0]));

      // the report will dedup against ones that might or might not have the date
      getterKeys.push(...createKeysFromObjectArrayAndBits(identifiers, [0]));
      getterKeys.push(...createKeysFromObjectArrayAndBits(identifiers, [1]));
    }

    if (diagReport.id) {
      const idKey = JSON.stringify({ id: diagReport.id });
      setterKeys.push(idKey);
      getterKeys.push(idKey);
    }

    if (setterKeys.length > 0) {
      fillL1L2Maps({
        map1: l1ReportsMap,
        map2: l2ReportsMap,
        getterKeys,
        setterKeys,
        targetResource: diagReport,
        refReplacementMap,
        onPremerge: preprocessStatus,
      });
    } else {
      danglingReferences.add(createRef(diagReport));
    }
  }

  return {
    diagReportsMap: l2ReportsMap,
    refReplacementMap,
    danglingReferences,
  };
}
