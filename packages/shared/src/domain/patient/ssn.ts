import { stripNonNumericChars } from "../../common/string";
import { BadRequestError } from "../../error/bad-request";

const numberOfDigits = 9;
const minLengthToPad = 2;

export function normalizeSsnSafe(ssn: string, padZeros = false): string | undefined {
  const normalized = stripNonNumericChars(ssn);
  if (normalized.length === numberOfDigits) return normalized;
  if (normalized.length < minLengthToPad) return undefined;
  if (normalized.length < numberOfDigits) {
    if (padZeros) return normalized.padStart(numberOfDigits, "0");
    return undefined;
  }
  return normalized.slice(0, numberOfDigits);
}

export function normalizeSsn(ssn: string, padZeros?: boolean): string {
  const normalized = normalizeSsnSafe(ssn, padZeros);
  if (!normalized) throw new BadRequestError(`Invalid SSN`, undefined, { ssn });
  return normalized;
}
