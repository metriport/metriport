import { BadRequestError } from "../../error/bad-request";

function isSsnValid(ssn: string): boolean {
  if (!ssn) return false;
  if (ssn.length < 9) return false;
  if (!ssn.match(/^[0-9-]+$/)) return false;
  if (ssn.includes("-") && ssn.split("-").length > 3) return false;
  return true;
}

function isSsnNumbersValid(ssn: string): boolean {
  if (!ssn) return false;
  if (ssn.length < 9) return false;
  if (!ssn.match(/^[0-9]+$/)) return false;
  return true;
}

function noramlizeSsnBase(ssn: string): string {
  return ssn.trim();
}

export function normalizeSsnSafe(
  ssn: string,
  normalizeBase: (ssn: string) => string = noramlizeSsnBase
): string | undefined {
  const baseSsn = normalizeBase(ssn);
  if (!isSsnValid(baseSsn)) return undefined;
  const baseSsnNumbers = baseSsn.split("-").join("");
  if (!isSsnNumbersValid(baseSsnNumbers)) return undefined;
  if (baseSsnNumbers.length === 9) return baseSsnNumbers;
  return baseSsnNumbers.slice(0, 9);
}

export function normalizeSsn(ssn: string): string {
  const ssnOrUndefined = normalizeSsnSafe(ssn);
  if (!ssnOrUndefined) {
    throw new BadRequestError("Invalid ssn", undefined, { ssn });
  }
  return ssnOrUndefined;
}
