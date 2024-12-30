import { DiagnosticReport } from "@medplum/fhirtypes";
import crypto from "crypto";
import { LOINC_CODE, LOINC_OID } from "../../util/constants";
import {
  DeduplicationResult,
  combineResources,
  createKeysFromObjectArray,
  createRef,
  fetchCodingCodeOrDisplayOrSystem,
  fillL1L2Maps,
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
  danglingReferences: Set<string>;
} {
  const l1ReportsMap = new Map<string, string>();
  const l2ReportsMap = new Map<string, DiagnosticReport>();
  const refReplacementMap = new Map<string, string>();
  const danglingReferences = new Set<string>();

  function removeCodesAndAssignStatus(
    master: DiagnosticReport,
    existing: DiagnosticReport,
    target: DiagnosticReport
  ): DiagnosticReport {
    const code = master.code;
    const filtered = code?.coding?.filter(coding => {
      const system = fetchCodingCodeOrDisplayOrSystem(coding, "system");
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
    const isPresentedFormPresent = diagReport.presentedForm
      ? diagReport.presentedForm?.length > 0
      : false;
    const isResultPresent = diagReport.result ? diagReport.result?.length > 0 : false;

    // If a diagnostic report does not contain any results or doctor's notes, it is useless and can be removed
    if (!isPresentedFormPresent && !isResultPresent) {
      danglingReferences.add(createRef(diagReport));
      continue;
    }

    const practitionerRefsSet = new Set<string>();

    const getterKeys: string[] = [];
    const setterKeys: string[] = [];

    diagReport.performer?.forEach(perf => {
      const ref = perf.reference;
      if (ref && ref.includes("Practitioner")) {
        practitionerRefsSet.add(ref);
        return;
      }
    });

    const practitionerRefs = Array.from(practitionerRefsSet).map(p => ({ practitioner: p }));

    if (isResultPresent) {
      const resultUuid = createUuidFromText(JSON.stringify(diagReport.result));
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

    if (datetime) {
      if (practitionerRefs.length > 0) {
        const practitionerAndDateKeys = createKeysFromObjectArray({ datetime }, practitionerRefs);
        setterKeys.push(...practitionerAndDateKeys);
        getterKeys.push(...practitionerAndDateKeys);
      }

      if (practitionerRefs.length === 0) {
        const dateKey = JSON.stringify({ datetime });
        setterKeys.push(dateKey);
        getterKeys.push(dateKey);
      }
    } else {
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
        applySpecialModifications: removeCodesAndAssignStatus,
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

function createUuidFromText(input: string) {
  const hash = crypto.createHash("sha256").update(input).digest("hex");

  const uuid = [
    hash.substring(0, 8),
    hash.substring(8, 12),
    hash.substring(12, 16),
    hash.substring(16, 20),
    hash.substring(20, 32),
  ].join("-");

  return uuid;
}
