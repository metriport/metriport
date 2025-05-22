const npiNumberRegex = /^\d{10}$/;

export function isValidNpiNumber(npiNumber: string): boolean {
  return npiNumberRegex.test(npiNumber);
}
