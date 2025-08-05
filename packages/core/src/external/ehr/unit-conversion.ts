import { capture } from "../../util/notifications";

const gToLbs = 0.00220462;
const gToKg = 1 / 1000;
const kgToLbs = 2.20462;
const kgToG = 1000;
const lbsToG = 453.592;
const lbsToKg = lbsToG * gToKg;
const cmToInches = 0.393701;
const inchesToCm = 1 / cmToInches;

export function convertCodeAndValue(
  loincCode: string,
  loincCodeMap: Map<string, { targetUnits: string; codeKey: string }>,
  value: number | string,
  inputUnits: string
): { units: string; codeKey: string; value: number } | undefined {
  const { targetUnits, codeKey } = loincCodeMap.get(loincCode) ?? {};
  if (!targetUnits || !codeKey) return undefined;
  const baseParams = { units: targetUnits, codeKey };
  const baseValue = typeof value === "string" ? value.trim() : value;
  const baseInputUnits = inputUnits.trim().toLowerCase();
  const valueNumber = convertValueToNumber(baseValue);
  if (baseInputUnits === targetUnits) return { ...baseParams, value: valueNumber };
  if (targetUnits === "kg") {
    // https://hl7.org/fhir/R4/valueset-ucum-bodyweight.html
    if (isKg(baseInputUnits)) {
      return { ...baseParams, value: valueNumber };
    }
    if (isG(baseInputUnits)) {
      return { ...baseParams, value: convertGramsToKg(valueNumber) };
    }
    if (isLbs(baseInputUnits)) {
      return { ...baseParams, value: convertLbsToKg(valueNumber) };
    }
  }
  if (targetUnits === "g") {
    // https://hl7.org/fhir/R4/valueset-ucum-bodyweight.html
    if (isG(baseInputUnits)) {
      return { ...baseParams, value: valueNumber };
    }
    if (isKg(baseInputUnits)) {
      return { ...baseParams, value: convertKiloGramsToGrams(valueNumber) };
    }
    if (isLbs(baseInputUnits)) {
      return { ...baseParams, value: convertLbsToGrams(valueNumber) };
    }
  }
  if (targetUnits === "lb_av") {
    // https://hl7.org/fhir/R4/valueset-ucum-bodyweight.html
    const valueNumber = convertValueToNumber(baseValue);
    if (isLbs(baseInputUnits)) {
      return { ...baseParams, value: valueNumber };
    }
    if (isKg(baseInputUnits)) {
      return { ...baseParams, value: convertKgToLbs(valueNumber) };
    }
    if (isG(baseInputUnits)) {
      return { ...baseParams, value: convertGramsToLbs(valueNumber) };
    }
  }
  if (targetUnits === "cm") {
    // https://hl7.org/fhir/R4/valueset-ucum-bodylength.html
    if (isCm(baseInputUnits)) {
      return { ...baseParams, value: valueNumber };
    }
    if (isIn(baseInputUnits)) {
      return { ...baseParams, value: convertInchesToCm(valueNumber) };
    }
  }
  if (targetUnits === "in_i") {
    // https://hl7.org/fhir/R4/valueset-ucum-bodylength.html
    if (isIn(baseInputUnits)) {
      return { ...baseParams, value: valueNumber };
    }
    if (isCm(baseInputUnits)) {
      return { ...baseParams, value: convertCmToInches(valueNumber) };
    }
  }
  if (targetUnits === "degf") {
    // https://hl7.org/fhir/R4/valueset-ucum-bodytemp.html
    if (isDegf(baseInputUnits)) {
      return { ...baseParams, value: valueNumber };
    }
    if (isCel(baseInputUnits)) {
      return { ...baseParams, value: convertCelciusToFahrenheit(valueNumber) };
    }
  }
  if (targetUnits === "kg/m2") {
    if (isKgPerM2(baseInputUnits)) {
      return { ...baseParams, value: valueNumber };
    }
  }
  if (targetUnits === "mmHg") {
    if (isMmHg(baseInputUnits)) {
      return { ...baseParams, value: valueNumber };
    }
  }
  if (targetUnits === "bpm") {
    if (isBpm(baseInputUnits)) {
      return { ...baseParams, value: valueNumber };
    }
  }
  if (targetUnits === "%") {
    if (isPercent(baseInputUnits)) {
      return { ...baseParams, value: valueNumber };
    }
  }
  capture.message("Unknown units", {
    extra: {
      units: baseInputUnits,
      targetUnits,
      loincCode,
      value,
      context: "ehr.unit-conversion",
    },
    level: "warning",
  });
  return undefined;
}

function convertValueToNumber(value: number | string): number {
  return typeof value === "string" ? +value : value;
}

function convertGramsToLbs(value: number): number {
  return value * gToLbs;
}

function convertKgToLbs(value: number): number {
  return value * kgToLbs;
}

function convertGramsToKg(value: number): number {
  return value * gToKg;
}

function convertLbsToKg(value: number): number {
  return value * lbsToKg;
}

function convertLbsToGrams(value: number): number {
  return value * lbsToG;
}

function convertKiloGramsToGrams(value: number): number {
  return value * kgToG;
}

function convertCmToInches(value: number): number {
  return value * cmToInches;
}

function convertInchesToCm(value: number): number {
  return value * inchesToCm;
}

function convertCelciusToFahrenheit(value: number): number {
  return value * (9 / 5) + 32;
}

function isKg(units: string): boolean {
  return units === "kg" || units === "kilogram" || units === "kilograms";
}

function isG(units: string): boolean {
  return units === "g" || units === "gram" || units === "grams";
}

function isLbs(units: string): boolean {
  return units === "lb_av" || units.includes("pound");
}

function isCm(units: string): boolean {
  return units === "cm" || units === "centimeter";
}

function isIn(units: string): boolean {
  return units === "in_i" || units.includes("inch");
}

function isDegf(units: string): boolean {
  return units === "degf" || units === "[degf]" || units === "f" || units.includes("fahrenheit");
}

function isCel(units: string): boolean {
  return units === "cel" || units === "c" || units.includes("celsius");
}

function isKgPerM2(units: string): boolean {
  return units === "kg/m2";
}

function isMmHg(units: string): boolean {
  return (
    units === "mmhg" || units === "millimeter of mercury" || units === "mm hg" || units === "mm[hg]"
  );
}

function isBpm(units: string): boolean {
  return units === "bpm" || units === "/min" || units === "beats/min" || units === "per minute";
}

function isPercent(units: string): boolean {
  return units === "%";
}

export function formatNumberAsString(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2);
}
