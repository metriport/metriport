export function isSsnValid(ssn: string): boolean {
  if (!ssn) return false;
  if (ssn.length < 9) return false;
  if (!ssn.match(/^[0-9-]+$/)) return false;
  if (ssn.includes("-") && ssn.split("-").length > 3) return false;
  return true;
}

export function normalizeSsnSafe(ssn: string): string | undefined {
  const trimmedSsn = ssn.trim();
  if (!isSsnValid(trimmedSsn)) return undefined;
  const trimmedSsnNumbers = trimmedSsn.split("-").join("");
  if (!isSsnValid(trimmedSsnNumbers)) return undefined;
  if (trimmedSsnNumbers.length === 9) return trimmedSsnNumbers;
  return trimmedSsnNumbers.slice(0, 9);
}

export function normalizeSsn(ssn: string): string {
  const ssnOrUndefined = normalizeSsnSafe(ssn);
  if (!ssnOrUndefined) throw new Error("Invalid ssn.");
  return ssnOrUndefined;
}
