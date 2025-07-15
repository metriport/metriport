import { BadRequestError } from "@metriport/shared";

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
): { units: string; codeKey: string; value: number | string } | undefined {
  const { targetUnits, codeKey } = loincCodeMap.get(loincCode) ?? {};
  if (!targetUnits || !codeKey) return undefined;
  const baseParams = { units: targetUnits, codeKey };
  const baseValue = typeof value === "string" ? value.trim() : value;
  if (inputUnits === targetUnits) return { ...baseParams, value: baseValue };
  if (targetUnits === "kg") {
    // https://hl7.org/fhir/R4/valueset-ucum-bodyweight.html
    const valueNumber = convertValueToNumber(baseValue);
    if (isKg(inputUnits)) {
      return { ...baseParams, value: valueNumber };
    }
    if (isG(inputUnits)) {
      return { ...baseParams, value: convertGramsToKg(valueNumber) };
    }
    if (isLbs(inputUnits)) {
      return { ...baseParams, value: convertLbsToKg(valueNumber) };
    }
  }
  if (targetUnits === "g") {
    // https://hl7.org/fhir/R4/valueset-ucum-bodyweight.html
    const valueNumber = convertValueToNumber(baseValue);
    if (isG(inputUnits)) {
      return { ...baseParams, value: valueNumber };
    }
    if (isKg(inputUnits)) {
      return { ...baseParams, value: convertKiloGramsToGrams(valueNumber) };
    }
    if (isLbs(inputUnits)) {
      return { ...baseParams, value: convertLbsToGrams(valueNumber) };
    }
  }
  if (targetUnits === "lb_av") {
    // https://hl7.org/fhir/R4/valueset-ucum-bodyweight.html
    const valueNumber = convertValueToNumber(baseValue);
    if (isLbs(inputUnits)) {
      return { ...baseParams, value: valueNumber };
    }
    if (isKg(inputUnits)) {
      return { ...baseParams, value: convertKgToLbs(valueNumber) };
    }
    if (isG(inputUnits)) {
      return { ...baseParams, value: convertGramsToLbs(valueNumber) };
    }
  }
  if (targetUnits === "cm") {
    // https://hl7.org/fhir/R4/valueset-ucum-bodylength.html
    const valueNumber = convertValueToNumber(baseValue);
    if (isCm(inputUnits)) {
      return { ...baseParams, value: valueNumber };
    }
    if (isIn(inputUnits)) {
      return { ...baseParams, value: convertInchesToCm(valueNumber) };
    }
  }
  if (targetUnits === "in_i") {
    const valueNumber = convertValueToNumber(baseValue);
    if (isIn(inputUnits)) {
      return { ...baseParams, value: valueNumber };
    }
    if (isCm(inputUnits)) {
      return { ...baseParams, value: convertCmToInches(valueNumber) };
    }
  }
  if (targetUnits === "degf") {
    // https://hl7.org/fhir/R4/valueset-ucum-bodytemp.html
    const valueNumber = convertValueToNumber(baseValue);
    if (isDegf(inputUnits)) {
      return { ...baseParams, value: valueNumber };
    }
    if (isCel(inputUnits)) {
      return { ...baseParams, value: convertCelciusToFahrenheit(valueNumber) };
    }
  }
  if (targetUnits === "kg/m2") {
    // https://hl7.org/fhir/R4/valueset-ucum-bodybmi.html
    const valueNumber = convertValueToNumber(baseValue);
    if (isKgPerM2(inputUnits)) {
      return { ...baseParams, value: valueNumber };
    }
  }
  throw new BadRequestError("Unknown units", undefined, {
    units: inputUnits,
    loincCode,
    value,
  });
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
  return units === "degf" || units === "f" || units.includes("fahrenheit");
}

function isCel(units: string): boolean {
  return units === "cel" || units === "c" || units.includes("celsius");
}

function isKgPerM2(units: string): boolean {
  return units === "kg/m2" || units === "kg_m2";
}
