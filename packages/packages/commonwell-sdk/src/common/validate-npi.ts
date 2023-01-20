/**
 * Checks if the specified NPI is valid as per ISO standard mod 10 Luhn algorithm.
 *
 * @param npi The npi number to validate, must be 10 digits.
 * @returns true if valid; false otherwise.
 */
export function validateNPI(npi: string): boolean {
  if (npi.length !== 10) {
    return false;
  }

  let sum = 0;
  let isEven = false;
  for (let i = npi.length - 1; i >= 0; i--) {
    let digit = parseInt(npi.charAt(i), 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}
