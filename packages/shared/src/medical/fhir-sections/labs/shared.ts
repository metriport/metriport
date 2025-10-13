import { DiagnosticReport, Observation } from "@medplum/fhirtypes";
import { ISO_DATE } from "@metriport/shared/common/date";
import dayjs from "dayjs";
import { getValidCode, isUnknown } from "..";

const blue = "rgba(54, 162, 235, 0.35)";
const red = "rgba(235, 99, 132, 0.35)";
const green = "rgba(75, 235, 95, 0.35)";

export type ReportRowData = {
  id: string;
  name: string;
  date: string;
};

export type LabRowData = {
  id: string;
  observation: string;
  date: string;
  value: number | string;
  interpretation: string;
  referenceRange: string;
  rowColor: string | undefined;
};

export type DetailedReportRowData = {
  id: string;
  name: string;
  date: string;
  rawReport: DiagnosticReport;
  results: Observation[];
};

type DataPoint = {
  id: string;
  value: number | string;
  numericValue?: number | undefined;
  date: string;
  unit: string | undefined;
  referenceRange: string;
  interpretation: string;
  filename: string;
};

export type GroupedLabs = {
  title: string;
  mostRecentObservation: Observation;
  sortedPoints?: DataPoint[];
};

export type GroupedObservation = {
  id: string;
  date: string;
  value: number | string;
  numericValue?: number | undefined;
  unit?: string;
  interpretation: string;
  referenceRange: string;
  rawLabObs: Observation;
};

type ReferenceRange = {
  low: number | undefined;
  high: number | undefined;
  unit: string | undefined;
  text?: string;
};

export const blacklistedValues = ["see below", "see text", "see comments", "see note"];
export function getValueAndInterpretation(obs: Observation): {
  value: number | string | undefined;
  unit: string | undefined;
  interpretation: string | undefined;
  referenceRange: ReferenceRange | undefined;
} {
  let value: number | string | undefined;
  if (obs.valueQuantity) {
    value = obs.valueQuantity.value;
  } else if (obs.valueCodeableConcept) {
    value = obs.valueCodeableConcept.text;
  } else if (obs.valueString) {
    const parsedNumber = parseFloat(obs.valueString);
    value = isNaN(parsedNumber) ? obs.valueString : parsedNumber;
    if (blacklistedValues.includes(value?.toString().toLowerCase().trim())) value = undefined;
  }

  let referenceRange: ReferenceRange | undefined;

  if (obs.referenceRange) {
    const firstRefernce = obs.referenceRange[0];
    referenceRange = {
      low: firstRefernce?.low?.value,
      high: firstRefernce?.high?.value,
      unit: firstRefernce?.low?.unit?.toString() ?? firstRefernce?.high?.unit?.toString(),
      text: firstRefernce?.text?.toLowerCase().trim() ?? "",
    };
  }

  const unit = obs.valueQuantity?.unit?.toString() ?? referenceRange?.unit;

  const explicitInterpretation = getExplicitInterpretation(obs);
  const interpretation = calculateInterpretation(explicitInterpretation, value, referenceRange);

  return {
    value,
    unit: unit?.replace(/[{()}]/g, ""),
    interpretation,
    referenceRange,
  };
}

export function getExplicitInterpretation(obs: Observation): string | undefined {
  const interpretationText =
    obs.interpretation?.[0]?.text === "unknown" ? undefined : obs.interpretation?.[0]?.text;

  return (
    interpretationText ??
    obs.interpretation?.[0]?.coding?.[0]?.display ??
    obs.interpretation?.[0]?.coding?.[0]?.code
  );
}

const highInterpretations = ["high", "critical"];
const lowInterpretations = ["low"];
const normalInterpretations = ["normal", "negative", "none seen", "not detected", "neg"];
const abnormalInterpretations = ["abnormal", "positive"];

export function calculateInterpretation(
  explicitInterpretation: string | undefined,
  value: number | string | undefined,
  referenceRange: ReferenceRange | undefined
): string | undefined {
  if (explicitInterpretation) {
    return normalizeStringInterpretation(explicitInterpretation);
  }

  if (typeof value === "number" && referenceRange) {
    const low = referenceRange.low;
    const high = referenceRange.high;

    if (low != undefined && value >= low && high != undefined && value <= high) {
      return "normal";
    } else if (low != undefined && value < low) {
      return "low";
    } else if (low != undefined && value > low) {
      return "normal";
    } else if (high != undefined && value < high) {
      return "normal";
    } else if (high != undefined && value > high) {
      return "high";
    }
  } else if (typeof value === "string") {
    const normalizedValue = value.toLowerCase().trim();
    if (highInterpretations.includes(normalizedValue)) return "high";
    if (lowInterpretations.includes(normalizedValue)) return "low";
    if (normalInterpretations.includes(normalizedValue)) return "normal";
    if (abnormalInterpretations.includes(normalizedValue)) return "abnormal";
  }

  if (highInterpretations.includes(explicitInterpretation?.toLowerCase() ?? "")) return "high";
  return undefined;
}

export function normalizeStringInterpretation(interpretation: string): string {
  const lowerInterp = interpretation.toLowerCase().trim();
  if (lowerInterp.includes("low")) {
    return "low";
  } else if (lowerInterp.includes("high") || lowerInterp.includes("positive")) {
    return "high";
  } else if (lowerInterp.includes("normal") || lowerInterp.includes("negative")) {
    return "normal";
  } else if (lowerInterp.includes("abnormal")) return "abnormal";
  return interpretation;
}

export function getRenderValue(
  value: number | string | undefined,
  unit: number | string | undefined
): string {
  if (typeof value === "number") {
    return formatNumber(value) + (unit ? ` ${unit}` : "");
  }
  return value ?? "-";
}

export function getLabReports(diagReports: DiagnosticReport[]): DiagnosticReport[] {
  return diagReports.filter(isLabReport);
}

function isLabReport(diagReport: DiagnosticReport): boolean {
  if (!Array.isArray(diagReport.category)) return false;

  return (
    diagReport.category?.some(cat =>
      cat.coding?.some(
        coding =>
          coding.code === "30954-2" || coding.display?.toLowerCase().includes("diagnostic tests")
      )
    ) ?? false
  );
}

export function getLabs(observations: Observation[]): Observation[] {
  return observations.filter(isLaboratory);
}

function isLaboratory(observation: Observation): boolean {
  return (
    observation.category?.some(cat => cat.coding?.[0]?.code?.toLowerCase() === "laboratory") ??
    false
  );
}

export function filterOutCaseReports(observations: Observation[]): Observation[] {
  return observations.filter(isNotCaseReport);
}

function isNotCaseReport(observation: Observation): boolean {
  return observation.code?.text?.toLowerCase().trim() !== "case report";
}

export function renderLabReferenceRange(
  range: ReferenceRange | undefined,
  explicitUnit: string | undefined
): string {
  const unit = explicitUnit ? explicitUnit : range?.unit ?? "";

  if (range?.low != undefined && range?.high != undefined) {
    return `${range?.low} - ${range?.high} ${unit}`;
  } else if (range?.low != undefined) {
    return `>= ${range?.low} ${unit}`;
  } else if (range?.high != undefined) {
    return `<= ${range?.high} ${unit}`;
  } else if (range?.text && range?.text !== "unknown") {
    return range?.text;
  } else {
    return "-";
  }
}

export function getLabsDate(vitals: Observation): string {
  return dayjs(vitals.effectiveDateTime).format(ISO_DATE);
}

export function getColorForInterpretation(interpretation: string | undefined): string | undefined {
  switch (interpretation) {
    case "low":
      return blue;
    case "high":
      return red;
    case "abnormal":
      return red;
    case "normal":
      return green;
    default:
      return undefined;
  }
}

function formatNumber(num: number): number {
  return parseFloat(num.toFixed(3));
}

export function getReportName(report: DiagnosticReport): string | undefined {
  const text = isUnknown(report.code?.text) ? undefined : report.code?.text?.trim();
  const textFromCoding = report.code?.coding?.flatMap(coding => {
    const trimmedDisplay = coding.display?.trim();
    if (trimmedDisplay && trimmedDisplay.length > 0 && !isUnknown(trimmedDisplay))
      return trimmedDisplay;
    return [];
  });

  if (text) return text;
  if (textFromCoding) return textFromCoding.join(", ");

  return undefined;
}

export function getLabsDisplay(labs: Observation): string {
  const codings = getValidCode(labs.code?.coding);
  const displays = codings.map(coding => coding.display);

  if (displays.length) {
    return displays.join(", ");
  } else if (labs.code?.text) {
    return labs.code.text;
  }

  return "-";
}
