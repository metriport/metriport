import { stripNonNumericChars } from "../../common/string";
import { MetriportError } from "../../error/metriport-error";

const numberOfDigits = 9;

export function normalizeSsnSafe(ssn: string): string | undefined {
  const normalizedSsn = stripNonNumericChars(ssn).slice(0, numberOfDigits);
  if (normalizedSsn.length < numberOfDigits) return undefined;
  return normalizedSsn;
}

export function normalizeSsn(ssn: string): string {
  const normalized = normalizeSsnSafe(ssn);
  if (!normalized) throw new MetriportError(`Invalid SSN`, undefined, { ssn });
  return normalized;
}
