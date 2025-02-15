import { stripNonNumericChars } from "../../common/string";

export function normalizeSsn(ssn: string): string {
  return stripNonNumericChars(ssn).slice(-9);
}
