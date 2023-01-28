/**
 * Checks if the specified 10 digit NPI is valid as per ISO standard mod 10 Luhn algorithm.
 *
 * See: https://www.cms.gov/Regulations-and-Guidance/Administrative-Simplification/NationalProvIdentStand/Downloads/NPIcheckdigit.pdf
 *
 * @param npi The npi number to validate, must be 10 digits.
 * @returns true if valid; false otherwise.
 */
export function validateNPI(npi: string): boolean {
  if (npi.length !== 10) {
    return false;
  }

  let sum = 0;
  let shouldDouble = true;
  for (let i = 0; i < npi.length - 1; i++) {
    let digit = parseInt(npi.charAt(i), 10);

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  // account for NPI prefix
  sum += 24;

  const checkDigit = 10 - (sum % 10);
  const lastNPIDigit = parseInt(npi.charAt(npi.length - 1), 10);
  return checkDigit === lastNPIDigit;
}
